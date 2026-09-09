import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getPairByUser, getReminders, createReminder, deleteReminder, getReminderById, markReminderSent, rescheduleRecurringReminder } from '../services/database';
import { telegramAuthMiddleware, requireTelegramAuth } from '../middleware/auth';
import { verifyWebhookSignature } from '../middleware/webhook';
import { dispatchReminderPushes } from '../services/pushDispatcher';

const createReminderSchema = z.object({
  title: z.string().min(1).max(200),
  message: z.string().max(500).optional().nullable(),
  remind_at: z.string().min(1),
  is_recurring: z.boolean().optional().default(false),
  recurrence: z.enum(['yearly', 'monthly']).optional().nullable(),
});

const dispatchSchema = z.object({
  reminder_id: z.string().uuid(),
});

function nextRecurrence(recurrence: string, from: Date): Date {
  const next = new Date(from);
  if (recurrence === 'yearly') {
    next.setUTCFullYear(next.getUTCFullYear() + 1);
  } else if (recurrence === 'monthly') {
    next.setUTCMonth(next.getUTCMonth() + 1);
  }
  return next;
}

export async function remindersRoutes(app: FastifyInstance) {
  const privateRoutes = { preHandler: [telegramAuthMiddleware, requireTelegramAuth] };

  app.get('/', privateRoutes, async (request, reply) => {
    const pair = await getPairByUser(request.telegramUser!.id);
    if (!pair) return reply.code(404).send({ error: 'Pair not found' });
    const reminders = await getReminders(pair.id);
    return { reminders };
  });

  app.post('/', privateRoutes, async (request, reply) => {
    const parsed = createReminderSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid reminder data' });

    const pair = await getPairByUser(request.telegramUser!.id);
    if (!pair) return reply.code(404).send({ error: 'Pair not found' });

    const reminder = await createReminder({
      pair_id: pair.id,
      author_id: request.telegramUser!.id,
      title: parsed.data.title,
      message: parsed.data.message ?? null,
      remind_at: parsed.data.remind_at,
      is_recurring: parsed.data.is_recurring,
      recurrence: parsed.data.recurrence ?? null,
    });
    return reply.code(201).send({ reminder });
  });

  app.delete('/:id', privateRoutes, async (request, reply) => {
    const { id } = request.params as { id: string };
    const pair = await getPairByUser(request.telegramUser!.id);
    if (!pair) return reply.code(404).send({ error: 'Pair not found' });

    await deleteReminder(id, pair.id);
    return { ok: true };
  });

  // Webhook: called by pg_cron when a reminder becomes due.
  app.post('/dispatch', { preHandler: verifyWebhookSignature }, async (request, reply) => {
    const body = dispatchSchema.parse(request.body);
    const reminder = await getReminderById(body.reminder_id);
    if (!reminder) return reply.code(404).send({ error: 'Reminder not found' });

    await dispatchReminderPushes(reminder);

    if (reminder.is_recurring && reminder.recurrence) {
      await rescheduleRecurringReminder(reminder.id, nextRecurrence(reminder.recurrence, new Date(reminder.remind_at)).toISOString());
    } else {
      await markReminderSent(reminder.id);
    }
    return { success: true };
  });
}