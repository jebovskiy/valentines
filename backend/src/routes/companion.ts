import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { updateDevicePushToken, updateDevicePushPermission, updateDeviceWidgetAdded, getDeviceBySecretHash, hashDeviceSecret, getValentinesByPair, getValentinesSince, getValentineById, getPairById } from '../services/database';
import type { Device, Valentine } from '../services/database';
import { advanceStreamCursor, cursorFromRow } from '../services/streamCursor';
import { onCompanionValentine } from '../services/companionEvents';
import { fetchWithTimeout } from '../utils/http';
import { resolvePhotoUrl } from '../utils/storage';

declare module 'fastify' {
  interface FastifyRequest {
    companionDevice?: Device;
  }
}

/**
 * Authenticates a companion device by its Bearer secret. The device_id alone is
 * not a credential: it is a uuid that also travels inside push payloads and
 * logs, so anyone who saw one could read the pair's valentines and rewrite its
 * push token. Only the SHA-256 hash of the secret is stored server-side.
 */
export async function companionAuth(request: FastifyRequest, reply: FastifyReply) {
  const header = request.headers.authorization;
  const secret = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!secret) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
  const device = await getDeviceBySecretHash(hashDeviceSecret(secret));
  if (!device) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
  request.companionDevice = device;
}

const GITHUB_REPO = process.env.GITHUB_REPO || 'jebovskiy/valentines';
const RELEASE_CACHE_TTL_MS = 10 * 60 * 1000;
// Fallback poll for streams that live in a process other than the one that
// handled the insert; same-process delivery is event-driven (companionEvents).
const STREAM_POLL_MS = 30_000;
// A burst bigger than this is not dropped, it is simply drained over several
// polls: the anchor only advances as far as the page actually returned.
const STREAM_BATCH = 50;

/** Header values arrive as string | string[]; only the first one matters here. */
function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** A resume id that is not a uuid can never resolve, so reject it up front. */
function asUuid(value: string | undefined): string | null {
  if (!value) return null;
  const parsed = z.string().uuid().safeParse(value);
  return parsed.success ? parsed.data : null;
}

interface ReleaseInfo {
  version_code: number;
  version_name: string;
  download_url: string;
}

let releaseCache: { at: number; info: ReleaseInfo | null } | null = null;
let releaseFetching: Promise<ReleaseInfo | null> | null = null;

async function getLatestRelease(): Promise<ReleaseInfo | null> {
  if (releaseCache && Date.now() - releaseCache.at < RELEASE_CACHE_TTL_MS) {
    return releaseCache.info;
  }

  // Single-flight: when the cache is cold, concurrent callers share one
  // upstream fetch instead of stampeding GitHub with N requests.
  if (!releaseFetching) {
    releaseFetching = (async () => {
      try {
        const res = await fetchWithTimeout(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
          headers: { accept: 'application/vnd.github+json', 'user-agent': 'valentines-backend' },
        });
        if (!res.ok) return null;

        const release = (await res.json()) as {
          tag_name?: string;
          assets?: { name: string; browser_download_url: string }[];
        };
        const versionCode = parseInt((release.tag_name || '').replace(/^v/, ''), 10);
        const apk = (release.assets || []).find((asset) => asset.name.toLowerCase().endsWith('.apk'));
        if (!Number.isFinite(versionCode) || !apk) return null;

        return {
          version_code: versionCode,
          version_name: release.tag_name || `v${versionCode}`,
          download_url: apk.browser_download_url,
        };
      } catch (error) {
        console.error('Failed to fetch latest release:', error);
        return null;
      }
    })().finally(() => {
      releaseFetching = null;
    });
  }

  const info = await releaseFetching;
  releaseCache = { at: Date.now(), info };
  return info;
}

const pushTokenSchema = z.object({
  push_token: z.string().min(10),
});

const permissionSchema = z.object({
  granted: z.boolean(),
});

const widgetSchema = z.object({
  added: z.boolean(),
});

export async function companionRoutes(app: FastifyInstance) {
  app.post('/push-token', { preHandler: companionAuth }, async (request) => {
    const body = pushTokenSchema.parse(request.body);
    await updateDevicePushToken(request.companionDevice!.id, body.push_token);
    return { success: true };
  });

  app.post('/permission', { preHandler: companionAuth }, async (request) => {
    const body = permissionSchema.parse(request.body);
    await updateDevicePushPermission(request.companionDevice!.id, body.granted);
    return { success: true };
  });

  app.post('/widget', { preHandler: companionAuth }, async (request) => {
    const body = widgetSchema.parse(request.body);
    await updateDeviceWidgetAdded(request.companionDevice!.id, body.added);
    return { success: true };
  });

  app.post('/latest-valentine', { preHandler: companionAuth }, async (request) => {
    const device = request.companionDevice!;

    const valentines = await getValentinesByPair(device.pair_id, 1);
    if (valentines.length === 0) {
      return { valentine: null };
    }

    const valentine = valentines[0];
    const pair = await getPairById(device.pair_id);
    const fromName =
      pair && (pair.telegram_user_a === valentine.sender_telegram_id ? pair.user_a_name : pair.user_b_name);

    return {
      valentine: {
        id: valentine.id,
        from_name: fromName,
        animation_type: valentine.animation_type,
        message: valentine.message,
        photo_url: await resolvePhotoUrl(valentine.photo_url),
        sent_at: valentine.sent_at,
      },
    };
  });

  app.get('/update', async (_request, reply) => {
    const info = await getLatestRelease();
    if (!info) {
      return reply.code(404).send({ update: null });
    }
    return { update: info };
  });

  app.get('/stream', { preHandler: companionAuth }, async (request, reply) => {
    const query = z
      .object({
        // Optional: hand-rolled clients that resubscribe without the
        // `Last-Event-ID` header can pass the cursor here instead.
        last_event_id: z.string().uuid().optional(),
      })
      .parse(request.query);
    const device = request.companionDevice!;

    // Resolve the resume point before hijacking the reply: a failure here still
    // surfaces as a normal HTTP error instead of a half-open stream. An id that
    // no longer resolves, or belongs to another pair, simply means "no resume".
    const resumeId =
      asUuid(firstHeader(request.headers['last-event-id'])) ?? asUuid(query.last_event_id) ?? null;
    const resumeRow = resumeId ? await getValentineById(resumeId).catch(() => null) : null;
    let cursor = resumeRow && resumeRow.pair_id === device.pair_id ? cursorFromRow(resumeRow) : null;

    // Real-time push channel to the companion app, independent of FCM.
    reply.hijack();
    const raw = reply.raw;
    raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    raw.write('retry: 5000\n\n');

    let closed = false;
    const write = (chunk: string) => {
      if (closed) return;
      try {
        raw.write(chunk);
      } catch {
        // connection already gone
      }
    };

    const announce = (valentine: Valentine) => {
      // `id:` is what makes the browser remember the cursor at all: without it
      // no `Last-Event-ID` is ever sent and every reconnect gap stays invisible.
      write(`id: ${valentine.id}\nevent: valentine\ndata: ${JSON.stringify({ id: valentine.id })}\n\n`);
    };

    const pump = async () => {
      if (closed) return;
      try {
        if (cursor === null) {
          // Fresh connection, or a resume id that no longer resolves. Announce
          // the newest one only — the companion already knows everything older
          // than its own state, and replaying the whole history would just be
          // a reconnect storm.
          const [latest] = await getValentinesByPair(device.pair_id, 1);
          if (!latest) {
            write(': ping\n\n');
            return;
          }
          announce(latest);
          cursor = cursorFromRow(latest);
          return;
        }

        const page = await getValentinesSince(device.pair_id, cursor.ts, STREAM_BATCH);
        const { fresh, next } = advanceStreamCursor(cursor, page);
        if (fresh.length === 0) {
          write(': ping\n\n');
          return;
        }
        for (const row of fresh) announce(row);
        cursor = next;
      } catch (error) {
        write(`event: error\ndata: ${JSON.stringify({ message: 'db error' })}\n\n`);
        console.error('Companion stream poll failed:', error);
      }
    };

    // Same-process inserts are announced immediately instead of waiting for
    // the next poll tick.
    const off = onCompanionValentine(device.pair_id, (valentine) => {
      announce(valentine);
      cursor = cursorFromRow(valentine);
    });

    const timer = setInterval(() => {
      void pump();
    }, STREAM_POLL_MS);
    // The first frame should not wait a full tick, and a reconnect has to be
    // caught up with immediately rather than after a poll interval.
    void pump();

    const stop = () => {
      if (closed) return;
      closed = true;
      clearInterval(timer);
      off();
    };
    request.raw.on('close', stop);
    raw.on('error', stop);
  });
}