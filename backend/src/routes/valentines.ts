import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getPairByUser, getValentinesByPair, createValentine, markValentineSeen, getValentineById, getPartnerTelegramId } from '../services/database';
import { telegramAuthMiddleware, requireTelegramAuth } from '../middleware/auth';
import { config, isKnownAnimationType } from '../config';
import { sendNewValentineNotification } from '../services/telegramNotifier';

const sendValentineSchema = z.object({
  animation_type: z.string(),
  message: z.string().max(500).optional().nullable(),
});

export async function valentinesRoutes(app: FastifyInstance) {
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

  app.post('/', { preHandler: requireTelegramAuth }, async (request, reply) => {
    const body = sendValentineSchema.parse(request.body);

    if (!isKnownAnimationType(body.animation_type)) {
      return reply.code(400).send({ error: 'Unknown animation type' });
    }

    const pair = await getPairByUser(request.telegramUser!.id);
    if (!pair) {
      return reply.code(404).send({ error: 'Pair not found' });
    }

    const valentine = await createValentine(pair.id, request.telegramUser!.id, body.animation_type, body.message ?? null);

    // Notify the partner via Telegram bot with a deep link to the valentine
    const partnerId = await getPartnerTelegramId(pair.id, request.telegramUser!.id);
    if (partnerId) {
      const senderName = pair.telegram_user_a === request.telegramUser!.id ? pair.user_a_name : pair.user_b_name;
      // Non-blocking: valentine is already saved
      await sendNewValentineNotification(partnerId, valentine.id, senderName).catch((e) => {
        app.log.error(`Telegram notification failed:`, e);
      });
    }

    return { valentine };
  });

  app.post('/:id/seen', { preHandler: requireTelegramAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await markValentineSeen(id);
    return { success: true };
  });
}