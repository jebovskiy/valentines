import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getValentinesByPair, createValentine, markValentineSeen, getValentineById } from '../services/database';
import { telegramAuthMiddleware, requireTelegramAuth } from '../middleware/auth';
import { config, isKnownAnimationType } from '../config';

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
    return { valentine };
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
    return { valentine };
  });

  app.post('/:id/seen', { preHandler: requireTelegramAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await markValentineSeen(id);
    return { success: true };
  });
}