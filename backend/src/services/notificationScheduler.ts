import { getPairById, getDueReminders, getUnnotifiedEvents, markReminderSent, rescheduleRecurringReminder, markCoupleEventNotified } from './database';
import { dispatchReminderPushes, dispatchEventPushes } from './pushDispatcher';
import { sendReminderNotification, sendEventReminderNotification } from './telegramNotifier';

const REMINDER_TICK_MS = 60 * 1000;
const EVENT_TICK_MS = 10 * 60 * 1000;

function nextRecurrence(recurrence: string, from: Date): Date {
  const next = new Date(from);
  if (recurrence === 'yearly') {
    next.setUTCFullYear(next.getUTCFullYear() + 1);
  } else if (recurrence === 'monthly') {
    next.setUTCMonth(next.getUTCMonth() + 1);
  }
  return next;
}

async function dispatchPairTelegram(pairId: string, send: (chatId: number) => Promise<void>): Promise<void> {
  const pair = await getPairById(pairId);
  if (!pair) return;
  await Promise.allSettled([
    send(pair.telegram_user_a),
    send(pair.telegram_user_b),
  ]);
}

async function processDueReminders(): Promise<void> {
  const reminders = await getDueReminders();
  for (const reminder of reminders) {
    try {
      await Promise.allSettled([
        dispatchPairTelegram(reminder.pair_id, (chatId) =>
          sendReminderNotification(chatId, { title: reminder.title, message: reminder.message }),
        ),
        dispatchReminderPushes(reminder),
      ]);
    } catch (error) {
      console.error(`Scheduler: reminder ${reminder.id} failed:`, error);
    }

    if (reminder.is_recurring && reminder.recurrence) {
      await rescheduleRecurringReminder(reminder.id, nextRecurrence(reminder.recurrence, new Date(reminder.remind_at)).toISOString()).catch((e) =>
        console.error(`Scheduler: reschedule reminder ${reminder.id} failed:`, e),
      );
    } else {
      await markReminderSent(reminder.id).catch((e) =>
        console.error(`Scheduler: mark reminder ${reminder.id} sent failed:`, e),
      );
    }
  }
}

function remindersAreDue(event: { event_date: string; remind_days_before: number }): boolean {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const eventDate = new Date(`${event.event_date}T00:00:00`);
  const remindOn = new Date(eventDate);
  remindOn.setDate(remindOn.getDate() - event.remind_days_before);
  return remindOn <= now && eventDate >= now;
}

async function processUpcomingEvents(): Promise<void> {
  const events = await getUnnotifiedEvents();
  for (const event of events) {
    if (!remindersAreDue(event)) continue;
    try {
      await Promise.allSettled([
        dispatchPairTelegram(event.pair_id, (chatId) => sendEventReminderNotification(chatId, event)),
        dispatchEventPushes(event.pair_id, event),
      ]);
      await markCoupleEventNotified(event.id);
    } catch (error) {
      console.error(`Scheduler: event ${event.id} failed:`, error);
    }
  }
}

export function startNotificationScheduler(): NodeJS.Timeout[] {
  const reminderTimer = setInterval(() => {
    processDueReminders().catch((e) => console.error('Scheduler: reminder sweep failed:', e));
  }, REMINDER_TICK_MS);

  const eventTimer = setInterval(() => {
    processUpcomingEvents().catch((e) => console.error('Scheduler: event sweep failed:', e));
  }, EVENT_TICK_MS);

  // Run once shortly after startup as well.
  setTimeout(() => {
    void processDueReminders().catch((e) => console.error('Scheduler: initial reminder sweep failed:', e));
    void processUpcomingEvents().catch((e) => console.error('Scheduler: initial event sweep failed:', e));
  }, 5_000);

  return [reminderTimer, eventTimer];
}