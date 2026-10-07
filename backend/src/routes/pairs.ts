import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getPairByUser, getDeviceByUserAndPlatform } from '../services/database';
import { localDay, readStoredStreak, rebuildPairStreak } from '../services/streak';
import { initiatePairing, completePairing, createPairForUsers, createInvite, joinByInvite, getPairingStatus } from '../services/pairing';
import { telegramAuthMiddleware, requireTelegramAuth } from '../middleware/auth';
import { userRateLimit } from '../middleware/rateLimit';

const pairingCompleteRateLimit = userRateLimit({ key: 'pairing-complete', max: 10, timeWindowMs: 60_000 });
const pairingInitiateRateLimit = userRateLimit({ key: 'pairing-initiate', max: 10, timeWindowMs: 60_000 });
const streakRateLimit = userRateLimit({ key: 'streak', max: 10, timeWindowMs: 60_000 });

// Minutes east of UTC (the same convention /api/recap uses). Optional everywhere,
// so an old client that sends nothing keeps the previous UTC behaviour.
const tzQuerySchema = z.object({
  tz_offset_minutes: z.coerce.number().int().min(-840).max(840).default(0),
});

function tzOffsetMinutesFrom(query: unknown): number {
  const parsed = tzQuerySchema.safeParse(query ?? {});
  return parsed.success ? parsed.data.tz_offset_minutes : 0;
}

const createPairSchema = z.object({
  partner_telegram_id: z.number().int().positive(),
});

const joinInviteSchema = z.object({
  code: z.string().min(6).max(12),
});

const completePairingSchema = z.object({
  token: z.string().uuid(),
  platform: z.enum(['ios', 'android']),
  push_token: z.string().min(1),
});

export async function pairsRoutes(app: FastifyInstance) {
  const privateRoutes = { preHandler: [telegramAuthMiddleware, requireTelegramAuth] };

  app.get('/me', privateRoutes, async (request, reply) => {
    const userId = request.telegramUser!.id;
    const pair = await getPairByUser(userId);
    if (!pair) {
      return reply.code(404).send({ error: 'Pair not found' });
    }
    const androidPaired = !!(await getDeviceByUserAndPlatform(pair.id, userId, 'android').catch(() => null));
    return { pair, pairing: { android_paired: androidPaired } };
  });

  app.get('/streak', privateRoutes, async (request, reply) => {
    const pair = await getPairByUser(request.telegramUser!.id);
    if (!pair) {
      return reply.code(404).send({ error: 'Pair not found' });
    }

    // O(1) read: the stored run is only alive while the pair was active today or
    // yesterday (in the caller's timezone), otherwise it is already zero.
    const today = localDay(new Date(), tzOffsetMinutesFrom(request.query));
    let { current, max } = readStoredStreak(pair, today);

    // `last_active_date IS NULL` means the pair was never anchored by migration
    // 027 (drifted legacy row). Rebuild once so the fast path takes over instead of
    // re-detecting the drift on every single request.
    if (!pair.last_active_date) {
      const rebuilt = await rebuildPairStreak(pair.id, tzOffsetMinutesFrom(request.query), {
        current: pair.current_streak,
        max: pair.max_streak,
      });
      current = rebuilt.current;
      max = rebuilt.max;
    }

    return { streak: { current, max } };
  });

  // Explicit resync: rebuilds the run from `valentines` in one SQL statement and
  // re-anchors `last_active_date`. Kept as the public repair endpoint -- it can
  // only ever agree with history, it cannot be used to inflate a number.
  app.patch(
    '/streak',
    { ...privateRoutes, preHandler: [...privateRoutes.preHandler, streakRateLimit] },
    async (request, reply) => {
      const pair = await getPairByUser(request.telegramUser!.id);
      if (!pair) {
        return reply.code(404).send({ error: 'Pair not found' });
      }

      const tzOffset = tzOffsetMinutesFrom(request.body ?? request.query);
      const rebuilt = await rebuildPairStreak(pair.id, tzOffset, {
        current: pair.current_streak,
        max: pair.max_streak,
      });
      return { streak: { current: rebuilt.current, max: rebuilt.max } };
    }
  );

  app.post('/', privateRoutes, async (request, reply) => {
    const body = createPairSchema.parse(request.body);
    const userId = request.telegramUser!.id;

    if (body.partner_telegram_id === userId) {
      return reply.code(400).send({ error: 'Cannot pair with yourself' });
    }

    try {
      const pairId = await createPairForUsers(userId, request.telegramUser!.first_name, body.partner_telegram_id, null);
      return { pair_id: pairId };
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message });
    }
  });

  app.post('/invite', privateRoutes, async (request, reply) => {
    try {
      const result = await createInvite(request.telegramUser!.id, request.telegramUser!.first_name);
      return result;
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message });
    }
  });

  app.post('/join', privateRoutes, async (request, reply) => {
    const body = joinInviteSchema.parse(request.body);
    try {
      const pairId = await joinByInvite(body.code, request.telegramUser!.id, request.telegramUser!.first_name);
      return { pair_id: pairId };
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message });
    }
  });

  app.post('/pairing/initiate', { preHandler: [...privateRoutes.preHandler, pairingInitiateRateLimit] }, async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('tma ')) {
      return reply.code(401).send({ error: 'Missing initData' });
    }

    const initData = authHeader.slice(4);
    try {
      const result = await initiatePairing(initData);
      return result;
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message });
    }
  });

  app.post('/pairing/complete', { preHandler: [pairingCompleteRateLimit], config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const body = completePairingSchema.parse(request.body);
    try {
      const result = await completePairing(body.token, body.platform, body.push_token);
      return result;
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message });
    }
  });

  app.get('/pairing/:token/status', async (request, reply) => {
    const params = z.object({ token: z.string().uuid() }).parse(request.params);
    try {
      const result = await getPairingStatus(params.token);
      return result;
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message });
    }
  });
}