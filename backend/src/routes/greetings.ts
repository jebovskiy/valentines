import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  getPairByUser,
  createGreeting,
  getLatestGreetingForType,
  getLatestGreetings,
  GreetingType,
} from '../services/database';
import { telegramAuthMiddleware, requireTelegramAuth } from '../middleware/auth';
import { isGreetingEnabledFor } from '../config';
import { dispatchGreetingPushes } from '../services/pushDispatcher';

const sendGreetingSchema = z.object({
  type: z.enum(['morning', 'night']),
});

export async function greetingsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', telegramAuthMiddleware);

  app.get('/', { preHandler: requireTelegramAuth }, async (request, reply) => {
    if (!isGreetingEnabledFor(request.telegramUser!.id)) {
      return reply.code(403).send({ error: 'Greetings are not enabled yet' });
    }
    const pair = await getPairByUser(request.telegramUser!.id);
    if (!pair) {
      return reply.code(404).send({ error: 'Pair not found' });
    }
    const greetings = await getLatestGreetings(pair.id);
    return { enabled: true, greetings };
  });

  app.post('/', { preHandler: requireTelegramAuth }, async (request, reply) => {
    if (!isGreetingEnabledFor(request.telegramUser!.id)) {
      return reply.code(403).send({ error: 'Greetings are not enabled yet' });
    }
    const body = sendGreetingSchema.parse(request.body);
    const type: GreetingType = body.type;
    const pair = await getPairByUser(request.telegramUser!.id);
    if (!pair) {
      return reply.code(404).send({ error: 'Pair not found' });
    }
    const previous = await getLatestGreetingForType(pair.id, type);
    const greeting = await createGreeting(pair.id, request.telegramUser!.id, type);

    // Notify the partner's companion apps right away (data-only push).
    void dispatchGreetingPushes(pair.id, request.telegramUser!.id, greeting.type).catch((e) => {
      app.log.error('Greeting push dispatch failed:', e);
    });

    return { greeting, previous: previous?.id ?? null };
  });
}