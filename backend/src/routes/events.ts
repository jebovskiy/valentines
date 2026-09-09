import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getPairByUser, getCoupleEvents, createCoupleEvent, deleteCoupleEvent } from '../services/database';
import { telegramAuthMiddleware, requireTelegramAuth } from '../middleware/auth';

const createEventSchema = z.object({
  name: z.string().min(1).max(200),
  event_date: z.string().min(1),
  event_type: z.enum(['first_date', 'wedding', 'birthday', 'custom']).default('custom'),
  remind_days_before: z.number().int().min(0).max(30).default(1),
});

export async function eventsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', telegramAuthMiddleware);

  app.get('/', { preHandler: requireTelegramAuth }, async (request, reply) => {
    const pair = await getPairByUser(request.telegramUser!.id);
    if (!pair) return reply.code(404).send({ error: 'Pair not found' });
    const events = await getCoupleEvents(pair.id);
    return { events };
  });

  app.post('/', { preHandler: requireTelegramAuth }, async (request, reply) => {
    const parsed = createEventSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid event data' });

    const pair = await getPairByUser(request.telegramUser!.id);
    if (!pair) return reply.code(404).send({ error: 'Pair not found' });

    const event = await createCoupleEvent({
      pair_id: pair.id,
      name: parsed.data.name,
      event_date: parsed.data.event_date,
      event_type: parsed.data.event_type,
      remind_days_before: parsed.data.remind_days_before,
    });
    return reply.code(201).send({ event });
  });

  app.delete('/:id', { preHandler: requireTelegramAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const pair = await getPairByUser(request.telegramUser!.id);
    if (!pair) return reply.code(404).send({ error: 'Pair not found' });

    await deleteCoupleEvent(id, pair.id);
    return { ok: true };
  });
}