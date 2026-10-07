import { getPairById, getDueReminders, getUnnotifiedEvents, markReminderSent, releaseReminderClaim, rescheduleRecurringReminder, markCoupleEventNotified, releaseEventClaim, getPairsForMovieReminder, getMovies, claimMovieReminder } from './database';
import { dispatchReminderPushes, dispatchEventPushes, dispatchMoviePushes } from './pushDispatcher';
import { sendReminderNotification, sendEventReminderNotification, sendMovieReminderNotification } from './telegramNotifier';

const REMINDER_TICK_MS = 60 * 1000;
const EVENT_TICK_MS = 10 * 60 * 1000;
const MOVIE_REMINDER_TICK_MS = 4 * 60 * 60 * 1000;
const EVENT_CLAIM_LIMIT = 50;

function nextRecurrence(recurrence: string, from: Date): Date {
  const next = new Date(from);
  if (recurrence === 'yearly') {
    next.setUTCFullYear(next.getUTCFullYear() + 1);
  } else if (recurrence === 'monthly') {
    next.setUTCMonth(next.getUTCMonth() + 1);
  }
  return next;
}

async function dispatchPairTelegram(pairId: string, send: (chatId: number) => Promise<void>): Promise<boolean> {
  const pair = await getPairById(pairId);
  if (!pair) return false;
  const results = await Promise.allSettled([
    send(pair.telegram_user_a),
    send(pair.telegram_user_b),
  ]);
  return results.some((r) => r.status === 'fulfilled');
}

async function processDueReminders(): Promise<void> {
  // Rows are claimed atomically (SKIP LOCKED + claimed_at). We mark them sent
  // only when the dispatch actually succeeded; failed deliveries are released
  // so the next sweep retries them.
  const reminders = await getDueReminders();
  for (const reminder of reminders) {
    let delivered = false;
    try {
      const telegram = await dispatchPairTelegram(reminder.pair_id, (chatId) =>
        sendReminderNotification(chatId, { title: reminder.title, message: reminder.message }),
      );
      const pushes = await dispatchReminderPushes(reminder);
      delivered = telegram || pushes;
    } catch (error) {
      console.error(`Scheduler: reminder ${reminder.id} failed:`, error);
    }

    if (!delivered) {
      await releaseReminderClaim(reminder.id).catch((e) =>
        console.error(`Scheduler: release reminder ${reminder.id} claim failed:`, e),
      );
      continue;
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

/** Calendar arithmetic on a `YYYY-MM-DD` date, unaffected by the host's DST rules. */
function shiftIsoDate(isoDate: string, days: number): string {
  const shifted = new Date(`${isoDate}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

/**
 * Today on the local calendar the window is judged against, as `YYYY-MM-DD`.
 *
 * Exported because it is the other half of the contract with migration 030:
 * `claim_unnotified_events(p_today => ...)` receives exactly this string, and
 * both sides have to read the same day or the claim is released right back.
 */
export function localToday(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Is the reminder for this event inside its window today?
 *
 * Pure calendar arithmetic rather than a walk through local midnights: the
 * column is a `date` with no timezone attached, and comparing it through the
 * host clock made the answer depend on whether local midnight happened to
 * exist on a DST transition day — which is one more way for the claim to hand
 * over a row this function then rejects. The SQL mirror of this predicate
 * lives in migration 030.
 */
export function remindersAreDue(
  event: { event_date: string; remind_days_before: number },
  today: string = localToday(),
): boolean {
  return event.event_date >= today && shiftIsoDate(event.event_date, -event.remind_days_before) <= today;
}

async function processUpcomingEvents(): Promise<void> {
  // Hand the window to the claim itself: rows outside it used to be claimed
  // first (they sort by event_date), rejected by remindersAreDue() below,
  // released, and re-claimed on every sweep — which starved anything that was
  // actually due once those rows filled the claim's LIMIT.
  const today = localToday();
  const events = await getUnnotifiedEvents(EVENT_CLAIM_LIMIT, today);
  for (const event of events) {
    if (!remindersAreDue(event, today)) {
      await releaseEventClaim(event.id).catch((e) =>
        console.error(`Scheduler: release event ${event.id} claim failed:`, e),
      );
      continue;
    }
    let delivered = false;
    try {
      const telegram = await dispatchPairTelegram(event.pair_id, (chatId) => sendEventReminderNotification(chatId, event));
      const pushes = await dispatchEventPushes(event.pair_id, event);
      delivered = telegram || pushes;
    } catch (error) {
      console.error(`Scheduler: event ${event.id} failed:`, error);
    }

    if (delivered) {
      await markCoupleEventNotified(event.id);
    } else {
      // Failed: release claim so a later sweep retries. No throw so the sweep continues.
      await releaseEventClaim(event.id).catch((e) =>
        console.error(`Scheduler: release event ${event.id} claim failed:`, e),
      );
    }
  }
}

async function processMovieReminders(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const pairIds = await getPairsForMovieReminder(today);
  for (const pairId of pairIds) {
    try {
      // Claim first: only the instance that atomically logs the reminder for
      // today actually dispatches; concurrent instances skip the pair.
      const claimed = await claimMovieReminder(pairId, today);
      if (!claimed) continue;

      const pair = await getPairById(pairId);
      if (!pair) continue;
      const movies = await getMovies(pairId);
      const pending = movies.filter((m) => m.status === 'want_to_watch');
      if (pending.length === 0) continue;
      const titles = pending.map((m) => m.year ? `${m.title} (${m.year})` : m.title);
      const sent1 = sendMovieReminderNotification(pair.telegram_user_a, titles, pending.length);
      const sent2 = sendMovieReminderNotification(pair.telegram_user_b, titles, pending.length);
      const push1 = dispatchMoviePushes(pairId, null, {
        event: 'reminder',
        title: 'Фильмы на вечер',
        message: `У вас ${pending.length} фильм(ов) в списке`,
      });
      await Promise.allSettled([sent1, sent2, push1]);
    } catch (error) {
      console.error(`Scheduler: movie reminder for pair ${pairId} failed:`, error);
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

  const movieReminderTimer = setInterval(() => {
    processMovieReminders().catch((e) => console.error('Scheduler: movie reminder sweep failed:', e));
  }, MOVIE_REMINDER_TICK_MS);

  // Run once shortly after startup as well.
  setTimeout(() => {
    void processDueReminders().catch((e) => console.error('Scheduler: initial reminder sweep failed:', e));
    void processUpcomingEvents().catch((e) => console.error('Scheduler: initial event sweep failed:', e));
    void processMovieReminders().catch((e) => console.error('Scheduler: initial movie reminder sweep failed:', e));
  }, 5_000);

  return [reminderTimer, eventTimer, movieReminderTimer];
}