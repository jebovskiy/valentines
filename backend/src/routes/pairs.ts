import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getPairByUser, createPairForUsers } from '../services/database';
import { initiatePairing, completePairing } from '../services/pairing';
import { telegramAuthMiddleware, requireTelegramAuth } from '../middleware/auth';

const createPairSchema = z.object({
  partner_telegram_id: z.number().int().positive(),
});

const completePairingSchema = z.object({
  token: z.string().uuid(),
  platform: z.enum(['ios', 'android']),
  push_token: z.string().min(1),
});

export async function pairsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', telegramAuthMiddleware);

  app.get('/me', { preHandler: requireTelegramAuth }, async (request, reply) => {
    const pair = await getPairByUser(request.telegramUser!.id);
    if (!pair) {
      return reply.code(404).send({ error: 'Pair not found' });
    }
    return { pair };
  });

  app.post('/', { preHandler: requireTelegramAuth }, async (request, reply) => {
    const body = createPairSchema.parse(request.body);
    const userId = request.telegramUser!.id;

    if (body.partner_telegram_id === userId) {
      return reply.code(400).send({ error: 'Cannot pair with yourself' });
    }

    try {
      const pairId = await createPairForUsers(userId, body.partner_telegram_id);
      return { pair_id: pairId };
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message });
    }
  });

  app.post('/pairing/initiate', { preHandler: requireTelegramAuth }, async (request, reply) => {
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

  app.post('/pairing/complete', async (request, reply) => {
    const body = completePairingSchema.parse(request.body);
    try {
      const result = await completePairing(body.token, body.platform, body.push_token);
      return result;
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message });
    }
  });
}