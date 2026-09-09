import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getPairByUser, getNotes, createNote, updateNote, deleteNote } from '../services/database';
import { telegramAuthMiddleware, requireTelegramAuth } from '../middleware/auth';

const NOTE_CATEGORIES = ['idea', 'todo', 'memory', 'wish'];

const createNoteSchema = z.object({
  content: z.string().min(1).max(2000),
  category: z.enum(['idea', 'todo', 'memory', 'wish']).default('idea'),
});

const updateNoteSchema = z.object({
  content: z.string().min(1).max(2000).optional(),
  category: z.enum(['idea', 'todo', 'memory', 'wish']).optional(),
  is_pinned: z.boolean().optional(),
});

export async function notesRoutes(app: FastifyInstance) {
  app.addHook('preHandler', telegramAuthMiddleware);

  app.get('/', { preHandler: requireTelegramAuth }, async (request, reply) => {
    const pair = await getPairByUser(request.telegramUser!.id);
    if (!pair) return reply.code(404).send({ error: 'Pair not found' });
    const notes = await getNotes(pair.id);
    return { notes };
  });

  app.post('/', { preHandler: requireTelegramAuth }, async (request, reply) => {
    const parsed = createNoteSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid note data' });

    const pair = await getPairByUser(request.telegramUser!.id);
    if (!pair) return reply.code(404).send({ error: 'Pair not found' });

    const note = await createNote(pair.id, request.telegramUser!.id, parsed.data.content, parsed.data.category);
    return reply.code(201).send({ note });
  });

  app.put('/:id', { preHandler: requireTelegramAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateNoteSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid note data' });

    const pair = await getPairByUser(request.telegramUser!.id);
    if (!pair) return reply.code(404).send({ error: 'Pair not found' });

    await updateNote(id, pair.id, parsed.data);
    return { ok: true };
  });

  app.delete('/:id', { preHandler: requireTelegramAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const pair = await getPairByUser(request.telegramUser!.id);
    if (!pair) return reply.code(404).send({ error: 'Pair not found' });

    await deleteNote(id, pair.id);
    return { ok: true };
  });
}