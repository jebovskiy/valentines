import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getPairByUser, getValentinesByPair, createValentine, markValentineSeen, getValentineById, getPartnerTelegramId } from '../services/database';
import { recordValentineActivity, rebuildPairStreak } from '../services/streak';
import { telegramAuthMiddleware, requireTelegramAuth } from '../middleware/auth';
import { userRateLimit } from '../middleware/rateLimit';
import { isKnownAnimationType } from '../config';
import { sendNewValentineNotification } from '../services/telegramNotifier';
import { dispatchDirectValentinePushes, dispatchStreakPushes } from '../services/pushDispatcher';
import { uploadValentinePhoto } from '../utils/storage';
import { Semaphore } from '../utils/concurrency';

const MAX_PHOTO_BODY_BYTES = 10 * 1024 * 1024;

// Photos are heavy (base64 inside JSON): throttle aggressive upload spam and
// bound body size at the route level, not just in the schema.
const photoRateLimit = { max: 10, timeWindow: '1 minute' };
const photoUserRateLimit = userRateLimit({ key: 'photo-upload', max: 10, timeWindowMs: 60_000 });
// The rate limit counts requests, not bytes: it still lets a full page of
// maximum-size photos land at once, each one decoded and pushed to storage
// concurrently. This bounds how many are actually in flight.
const photoUploadGate = new Semaphore(3);

// Streak-gated animations: unlock for good once the pair hits the day mark.
const STREAK_LOCKED_ANIMATIONS: Record<string, number> = {
  bloom_petals: 60,
  golden_halo: 100,
};

const sendValentineSchema = z.object({
  animation_type: z.string(),
  message: z.string().max(500).optional().nullable(),
  recipient: z.enum(['partner', 'self']).optional(),
  photo_base64: z.string().max(8 * 1024 * 1024).optional().nullable(),
  /** Minutes WEST of UTC for the sender (Date#getTimezoneOffset); picks the streak day. */
  tz_offset_minutes: z.number().int().min(-840).max(840).optional(),
});

export function valentinesRoutes(app: FastifyInstance) {
  app.addHook('preHandler', telegramAuthMiddleware);

  app.get('/', { preHandler: requireTelegramAuth }, async (request, reply) => {
    const pair = await getPairByUser(request.telegramUser!.id);
    if (!pair) {
      return reply.code(404).send({ error: 'Pair not found' });
    }

    const valentines = await getValentinesByPair(pair.id);
    return { valentines };
  });

  app.get('/:id', { preHandler: requireTelegramAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const valentine = await getValentineById(id);
    if (!valentine) {
      return reply.code(404).send({ error: 'Valentine not found' });
    }
    const pair = await getPairByUser(request.telegramUser!.id);
    if (!pair || pair.id !== valentine.pair_id) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const isOwn = valentine.sender_telegram_id === request.telegramUser!.id;
    const senderName = isOwn
      ? (pair.telegram_user_a === request.telegramUser!.id ? pair.user_a_name ?? 'Вы' : pair.user_b_name ?? 'Вы')
      : (pair.telegram_user_a === valentine.sender_telegram_id ? pair.user_a_name ?? 'Партнер' : pair.user_b_name ?? 'Партнер');
    return { valentine: { ...valentine, sender_name: senderName, is_own: isOwn } };
  });

  app.post('/', { preHandler: [requireTelegramAuth, photoUserRateLimit], bodyLimit: MAX_PHOTO_BODY_BYTES, config: { rateLimit: photoRateLimit } }, async (request, reply) => {
    const body = sendValentineSchema.parse(request.body);
    const tzOffset = body.tz_offset_minutes ?? 0;

    if (!isKnownAnimationType(body.animation_type)) {
      return reply.code(400).send({ error: 'Unknown animation type' });
    }

    const pair = await getPairByUser(request.telegramUser!.id);
    if (!pair) {
      return reply.code(404).send({ error: 'Pair not found' });
    }

    let photoUrl: string | null = null;
    if (body.photo_base64) {
      photoUrl = await photoUploadGate.run(() => uploadValentinePhoto(pair.id, body.photo_base64!));
    }

    const lockedRequirement = STREAK_LOCKED_ANIMATIONS[body.animation_type];
    if (lockedRequirement !== undefined && (pair.max_streak ?? 0) < lockedRequirement) {
      // Normally impossible: max_streak is maintained by the atomic register RPC.
      // A pair whose rows predate migration 027 can still be behind, so rebuild
      // once from history instead of rejecting an animation the pair earned.
      const refreshed = await rebuildPairStreak(pair.id, tzOffset, {
        current: pair.current_streak,
        max: pair.max_streak,
      }).catch(() => null);
      if (refreshed && refreshed.max >= lockedRequirement) {
        pair.max_streak = refreshed.max;
      } else {
        return reply
          .code(403)
          .send({ error: `Эта анимация откроется на ${lockedRequirement}-й день стрика` });
      }
    }

    const valentine = await createValentine(pair.id, request.telegramUser!.id, body.animation_type, body.message ?? null, photoUrl);

    // Стрик живёт в базе: один атомарный UPDATE вместо перечитывания всей
    // истории, и порядок вызовов больше не влияет на результат.
    try {
      const streak = await recordValentineActivity(pair.id, tzOffset, {
        current: pair.current_streak,
        max: pair.max_streak,
      });
      pair.current_streak = streak.current;
      pair.max_streak = streak.max;
      if (streak.newRecord && streak.advanced) {
        // Celebrate a new milestone with a companion push.
        void dispatchStreakPushes(pair.id, streak.max).catch((e: unknown) => {
          app.log.error('Streak push failed: %s', e);
        });
      }
    } catch (e) {
      app.log.error('Streak update failed: %s', e instanceof Error ? e.message : String(e));
    }

    // Notify the companion widget right away: pushes are dispatched inline
    // (independent of the DB trigger / push_jobs pipeline).
    void dispatchDirectValentinePushes(valentine).catch((e: unknown) => {
      app.log.error('Direct push dispatch failed: %s', e);
    });

    // Notify the recipient: partner by default, or the sender himself (recipient === 'self')
    const recipientId =
      body.recipient === 'self' ? request.telegramUser!.id : await getPartnerTelegramId(pair.id, request.telegramUser!.id);
    if (recipientId) {
      const userId = request.telegramUser!.id;
      const senderName = recipientId === userId
        ? (userId === pair.telegram_user_a ? pair.user_a_name : pair.user_b_name)
        : (pair.telegram_user_a === userId ? pair.user_a_name : pair.user_b_name);
      // Non-blocking: valentine is already saved
      await sendNewValentineNotification(recipientId, valentine.id, senderName).catch((e: unknown) => {
        app.log.error(`Telegram notification failed: %s`, e);
      });
    }

    return { valentine };
  });

  app.post('/:id/seen', { preHandler: requireTelegramAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const valentine = await getValentineById(id);
    if (!valentine) {
      return reply.code(404).send({ error: 'Valentine not found' });
    }
    const pair = await getPairByUser(request.telegramUser!.id);
    if (!pair || pair.id !== valentine.pair_id) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    await markValentineSeen(id);
    return { success: true };
  });
}
