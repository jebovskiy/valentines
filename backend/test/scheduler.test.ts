import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localToday, remindersAreDue } from '../src/services/notificationScheduler';

function shift(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * The predicate migration 030 pushes into `claim_unnotified_events`, written
 * out independently of the implementation: two calendar dates compared as
 * strings, one of them `remind_days_before` days earlier. `remindersAreDue()`
 * is the TypeScript half of the same window, and it is what decides whether a
 * claimed row is dispatched or released — if the two ever disagree, the claim
 * keeps handing over rows nobody wants and starving the ones that are due.
 */
function sqlWouldClaim(
  event: { event_date: string; remind_days_before: number },
  today: string,
): boolean {
  return event.event_date >= today && shift(event.event_date, -event.remind_days_before) <= today;
}

test('the SQL claim window and the scheduler check agree on every offset', () => {
  const today = localToday();
  for (const offset of [-45, -8, -2, -1, 0, 1, 2, 8, 45, 400]) {
    for (const remindDaysBefore of [0, 1, 3, 7, 30]) {
      const event = { event_date: shift(today, offset), remind_days_before: remindDaysBefore };
      assert.equal(
        remindersAreDue(event, today),
        sqlWouldClaim(event, today),
        `offset ${offset}, remind ${remindDaysBefore}d`,
      );
    }
  }
});

test('an event already in the past is never claimed', () => {
  const today = localToday();
  assert.equal(remindersAreDue({ event_date: shift(today, -1), remind_days_before: 0 }, today), false);
  // ...not even when its window opened long ago: this is exactly the row that
  // used to sit in the claim slot forever, because the old claim selected the
  // oldest unnotified rows with no window at all.
  assert.equal(remindersAreDue({ event_date: shift(today, -1), remind_days_before: 30 }, today), false);
});

test('an event whose window has not opened yet is not claimed', () => {
  const today = localToday();
  assert.equal(remindersAreDue({ event_date: shift(today, 3), remind_days_before: 1 }, today), false);
  assert.equal(remindersAreDue({ event_date: shift(today, 400), remind_days_before: 7 }, today), false);
});

test('an event inside its window is claimed', () => {
  const today = localToday();
  assert.equal(remindersAreDue({ event_date: today, remind_days_before: 0 }, today), true);
  assert.equal(remindersAreDue({ event_date: today, remind_days_before: 5 }, today), true);
  // Tomorrow, with one day of notice, is due today.
  assert.equal(remindersAreDue({ event_date: shift(today, 1), remind_days_before: 1 }, today), true);
  // Tomorrow with no notice at all still waits for tomorrow.
  assert.equal(remindersAreDue({ event_date: shift(today, 1), remind_days_before: 0 }, today), false);
});

test('localToday reads the local calendar, not UTC', () => {
  const today = localToday();
  assert.match(today, /^\d{4}-\d{2}-\d{2}$/);
  const now = new Date();
  assert.equal(Number(today.slice(8, 10)), now.getDate());
  assert.equal(Number(today.slice(5, 7)), now.getMonth() + 1);
  assert.equal(Number(today.slice(0, 4)), now.getFullYear());
});
