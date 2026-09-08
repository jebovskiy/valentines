import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { updateDevicePushToken, updateDevicePushPermission, updateDeviceWidgetAdded, getDeviceById, getValentinesByPair, getPairById } from '../services/database';

const GITHUB_REPO = process.env.GITHUB_REPO || 'jebovskiy/valentines';
const RELEASE_CACHE_TTL_MS = 10 * 60 * 1000;

interface ReleaseInfo {
  version_code: number;
  version_name: string;
  download_url: string;
}

let releaseCache: { at: number; info: ReleaseInfo | null } | null = null;

async function getLatestRelease(): Promise<ReleaseInfo | null> {
  if (releaseCache && Date.now() - releaseCache.at < RELEASE_CACHE_TTL_MS) {
    return releaseCache.info;
  }

  releaseCache = { at: Date.now(), info: null };
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
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

    releaseCache.info = {
      version_code: versionCode,
      version_name: release.tag_name || `v${versionCode}`,
      download_url: apk.browser_download_url,
    };
    return releaseCache.info;
  } catch (error) {
    console.error('Failed to fetch latest release:', error);
    return null;
  }
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

export async function companionRoutes(app: FastifyInstance) {
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
}