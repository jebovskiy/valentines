import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { telegramAuthMiddleware, requireTelegramAuth } from '../middleware/auth';
import { getPairByUser } from '../services/database';
import {
  getActiveGameSession,
  getGameSessionById,
  createGameSession,
  deleteActiveGameSessions,
  upsertGameAnswer,
  touchGameSession,
  finishGameSession,
  getGameAnswers,
  type GameSessionRow,
} from '../services/games';

const createSessionSchema = z.object({
  game_id: z.enum(['KNOW_ME', 'CHOOSE_ONE']),
  mood: z.enum(['нежное', 'веселое', 'погорячее', 'поговорить', 'спокойное']).nullable().optional(),
});

const answerSchema = z.object({
  round_index: z.number().int().min(0),
  answer: z.string(),
});

async function withAnswers(session: GameSessionRow): Promise<GameSessionRow> {
  session.answers = await getGameAnswers(session.id);
  return session;
}

export async function gamesRoutes(app: FastifyInstance) {
  app.addHook('preHandler', telegramAuthMiddleware);

  app.get('/active', { preHandler: requireTelegramAuth }, async (request, reply) => {
    const pair = await getPairByUser(request.telegramUser!.id);
    if (!pair) return reply.code(404).send({ error: 'Pair not found' });

    const session = await getActiveGameSession(pair.id);
    return { session };
  });

  app.post('/', { preHandler: requireTelegramAuth }, async (request, reply) => {
    const parsed = createSessionSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid game params' });

    const pair = await getPairByUser(request.telegramUser!.id);
    if (!pair) return reply.code(404).send({ error: 'Pair not found' });

const { game_id, mood } = parsed.data;
    await deleteActiveGameSessions(pair.id);
    const session = await createGameSession(pair.id, request.telegramUser!.id, game_id, mood ?? null);
    return reply.code(201).send({ session });
  });

  app.post('/:id/answer', { preHandler: requireTelegramAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = answerSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid answer data' });

    const pair = await getPairByUser(request.telegramUser!.id);
    if (!pair) return reply.code(404).send({ error: 'Pair not found' });

    const session = await getGameSessionById(id);
    if (!session) return reply.code(404).send({ error: 'Session not found' });
    if (session.pair_id !== pair.id) return reply.code(403).send({ error: 'Not your pair session' });
    if (session.status === 'done') {
      return reply.code(409).send({ error: 'Session already finished' });
    }

    await upsertGameAnswer(id, request.telegramUser!.id, parsed.data.round_index, parsed.data.answer);

    // If both players have answered this round, we could compute and maybe auto-advance?
    // But we follow the dates pattern: just touch the session to trigger realtime update.
    await touchGameSession(id);

    const updated = await getGameSessionById(id);
    return { session: updated ? await withAnswers(updated) : updated };
  });

  app.post('/:id/done', { preHandler: requireTelegramAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const pair = await getPairByUser(request.telegramUser!.id);
    if (!pair) return reply.code(404).send({ error: 'Pair not found' });

    const session = await getGameSessionById(id);
    if (!session || session.pair_id !== pair.id) return reply.code(404).send({ error: 'Session not found' });

    await finishGameSession(id);
    return { ok: true };
  });
}
