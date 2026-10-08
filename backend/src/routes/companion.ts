import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { updateDevicePushToken, updateDevicePushPermission, updateDeviceWidgetAdded, getDeviceById, getValentinesByPair, getValentinesSince, getValentineById, getPairById } from '../services/database';
import type { Valentine } from '../services/database';
import { advanceStreamCursor, cursorFromRow } from '../services/streamCursor';
import { fetchWithTimeout } from '../utils/http';

const GITHUB_REPO = process.env.GITHUB_REPO || 'jebovskiy/valentines';
const RELEASE_CACHE_TTL_MS = 10 * 60 * 1000;
const STREAM_POLL_MS = 5000;
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
  device_id: z.string().uuid(),
  push_token: z.string().min(10),
});

const permissionSchema = z.object({
  device_id: z.string().uuid(),
  granted: z.boolean(),
});

const widgetSchema = z.object({
  device_id: z.string().uuid(),
  added: z.boolean(),
});

const latestValentineSchema = z.object({
  device_id: z.string().uuid(),
});

export function companionRoutes(app: FastifyInstance) {
  app.post('/push-token', async (request, reply) => {
    const body = pushTokenSchema.parse(request.body);
    const device = await getDeviceById(body.device_id);
    if (!device) return reply.code(404).send({ error: 'Device not found' });
    await updateDevicePushToken(body.device_id, body.push_token);
    return { success: true };
  });

  app.post('/permission', async (request, reply) => {
    const body = permissionSchema.parse(request.body);
    const device = await getDeviceById(body.device_id);
    if (!device) return reply.code(404).send({ error: 'Device not found' });
    await updateDevicePushPermission(body.device_id, body.granted);
    return { success: true };
  });

  app.post('/widget', async (request, reply) => {
    const body = widgetSchema.parse(request.body);
    const device = await getDeviceById(body.device_id);
    if (!device) return reply.code(404).send({ error: 'Device not found' });
    await updateDeviceWidgetAdded(body.device_id, body.added);
    return { success: true };
  });

  app.post('/latest-valentine', async (request, reply) => {
    const body = latestValentineSchema.parse(request.body);
    const device = await getDeviceById(body.device_id);
    if (!device) return reply.code(404).send({ error: 'Device not found' });

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
        photo_url: valentine.photo_url,
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

  app.get('/stream', async (request, reply) => {
    const query = z
      .object({
        device_id: z.string().uuid(),
        // Optional: browsers resubscribe through the `Last-Event-ID` header and
        // cannot set headers with EventSource, so hand-rolled clients need a way in.
        last_event_id: z.string().uuid().optional(),
      })
      .parse(request.query);
    const device = await getDeviceById(query.device_id);
    if (!device) return reply.code(404).send({ error: 'Device not found' });

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

    const timer = setInterval(() => {
      void pump();
    }, STREAM_POLL_MS);
    // The first frame should not wait a full tick, and a reconnect has to be
    // caught up with immediately rather than after 5 seconds.
    void pump();

    const stop = () => {
      if (closed) return;
      closed = true;
      clearInterval(timer);
    };
    request.raw.on('close', stop);
    raw.on('error', stop);
  });
}