import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isoUtcDay, shiftUtcDay, streakFromActiveDays, localDay, readStoredStreak } from '../src/services/streak';

const TODAY = '2026-03-15';

function days(count: number, endDay = TODAY): string[] {
  // count consecutive days ending at endDay (inclusive).
  return Array.from({ length: count }, (_, i) => shiftUtcDay(endDay, i - count + 1));
}

test('empty history means no streak at all', () => {
  assert.deepEqual(streakFromActiveDays([], TODAY), { current: 0, max: 0 });
});

test('activity today counts as a run of one', () => {
  assert.deepEqual(streakFromActiveDays([TODAY], TODAY), { current: 1, max: 1 });
});

test('a run is counted while it ends today', () => {
  assert.deepEqual(streakFromActiveDays(days(5), TODAY), { current: 5, max: 5 });
});

test('a run that ended yesterday still holds the streak', () => {
  const yesterday = shiftUtcDay(TODAY, -1);
  assert.deepEqual(streakFromActiveDays(days(5, yesterday), TODAY), { current: 5, max: 5 });
});

test('a two-day-old run is over', () => {
  const stale = shiftUtcDay(TODAY, -2);
  assert.deepEqual(streakFromActiveDays(days(5, stale), TODAY), { current: 0, max: 5 });
});

test('several valentines on one day count once', () => {
  const doubled = [...days(3), ...days(3)];
  assert.deepEqual(streakFromActiveDays(doubled, TODAY), { current: 3, max: 3 });
});

test('unsorted and duplicated days are handled', () => {
  const messy = [shiftUtcDay(TODAY, -2), TODAY, shiftUtcDay(TODAY, -1), TODAY, shiftUtcDay(TODAY, -2)];
  assert.deepEqual(streakFromActiveDays(messy, TODAY), { current: 3, max: 3 });
});

test('the record survives a broken run', () => {
  // Two runs: a 4-day run last week and a 2-day run that is still alive.
  const old = days(4, shiftUtcDay(TODAY, -7));
  const fresh = days(2);
  assert.deepEqual(streakFromActiveDays([...old, ...fresh], TODAY), { current: 2, max: 4 });
});

test('a long run counts without off-by-one at month and year borders', () => {
  const crossing = ['2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02'];
  assert.deepEqual(streakFromActiveDays(crossing, '2026-01-02'), { current: 4, max: 4 });

  const monthEnd = ['2026-02-27', '2026-02-28', '2026-03-01'];
  assert.deepEqual(streakFromActiveDays(monthEnd, '2026-03-01'), { current: 3, max: 3 });
});

test('a leap day does not break the run', () => {
  const leap = ['2028-02-28', '2028-02-29', '2028-03-01'];
  assert.deepEqual(streakFromActiveDays(leap, '2028-03-01'), { current: 3, max: 3 });
});

test('only today and yesterday can hold the current streak', () => {
  assert.equal(streakFromActiveDays(['2026-03-14', '2026-03-15'], '2026-03-15').current, 2);
  assert.equal(streakFromActiveDays(['2026-03-13', '2026-03-14'], '2026-03-15').current, 2);
  assert.equal(streakFromActiveDays(['2026-03-12', '2026-03-13'], '2026-03-15').current, 0);
});

test('a long streak is not capped', () => {
  const hundred = days(100);
  assert.deepEqual(streakFromActiveDays(hundred, TODAY), { current: 100, max: 100 });
});

test('day helpers round-trip across the year border', () => {
  assert.equal(shiftUtcDay('2026-12-31', 1), '2027-01-01');
  assert.equal(shiftUtcDay('2027-01-01', -1), '2026-12-31');
  assert.equal(isoUtcDay(new Date('2026-03-15T23:59:59.000Z')), '2026-03-15');
  assert.equal(isoUtcDay(new Date('2026-03-15T00:00:00.000Z')), '2026-03-15');
});

// --- localDay: same sign convention as Date#getTimezoneOffset and /api/recap ---

test('localDay defaults to UTC', () => {
  assert.equal(localDay(new Date('2026-03-15T21:30:00.000Z')), '2026-03-15');
  assert.equal(localDay(new Date('2026-03-15T21:30:00.000Z'), 0), '2026-03-15');
});

test('localDay shifts backwards for a west-of-UTC offset', () => {
  // Moscow is UTC+3, so Date#getTimezoneOffset() returns -180.
  assert.equal(localDay(new Date('2026-03-15T21:30:00.000Z'), -180), '2026-03-16');
  assert.equal(localDay(new Date('2026-03-15T02:30:00.000Z'), -180), '2026-03-15');
});

test('localDay shifts forwards for an east-of-UTC offset', () => {
  // New York is UTC-5, so Date#getTimezoneOffset() returns +300.
  assert.equal(localDay(new Date('2026-03-15T02:30:00.000Z'), 300), '2026-03-14');
  assert.equal(localDay(new Date('2026-03-15T21:30:00.000Z'), 300), '2026-03-15');
});

test('localDay lands on different calendar days either side of UTC midnight', () => {
  const instant = new Date('2026-03-15T23:45:00.000Z');
  assert.equal(localDay(instant, 0), '2026-03-15');
  assert.equal(localDay(instant, -180), '2026-03-16');
  assert.equal(localDay(instant, 300), '2026-03-15');
});

// --- readStoredStreak: O(1) read with day-boundary decay ---

test('a run anchored today is alive as-is', () => {
  assert.deepEqual(readStoredStreak({ current_streak: 12, max_streak: 40, last_active_date: TODAY }, TODAY), {
    current: 12,
    max: 40,
    alive: true,
  });
});

test('a run anchored yesterday still holds', () => {
  const stored = { current_streak: 12, max_streak: 40, last_active_date: shiftUtcDay(TODAY, -1) };
  assert.deepEqual(readStoredStreak(stored, TODAY), { current: 12, max: 40, alive: true });
});

test('a run anchored two days ago is already zero, the record survives', () => {
  const stored = { current_streak: 12, max_streak: 40, last_active_date: shiftUtcDay(TODAY, -2) };
  assert.deepEqual(readStoredStreak(stored, TODAY), { current: 0, max: 40, alive: false });
});

test('an unanchored pair reports no streak and asks for a rebuild', () => {
  assert.deepEqual(readStoredStreak({ current_streak: 0, max_streak: 7, last_active_date: null }, TODAY), {
    current: 0,
    max: 7,
    alive: false,
  });
  assert.equal(readStoredStreak({}, TODAY).alive, false);
});

test('the read path matches the derived reference implementation', () => {
  // Same input, two very different routes to the number.
  for (const size of [0, 1, 2, 5, 37]) {
    for (const lag of [0, 1, 2]) {
      const active = days(size, shiftUtcDay(TODAY, -lag));
      const derived = streakFromActiveDays(active, TODAY);
      const stored = readStoredStreak(
        {
          current_streak: derived.current,
          max_streak: derived.max,
          last_active_date: size === 0 ? null : shiftUtcDay(TODAY, -lag),
        },
        TODAY
      );
      assert.equal(stored.current, derived.current, `size=${size} lag=${lag}`);
      assert.equal(stored.max, derived.max, `size=${size} lag=${lag}`);
    }
  }
});

test('a timezone offset can move the day the streak is judged against', () => {
  const stored = { current_streak: 5, max_streak: 5, last_active_date: '2026-03-15' };
  const instant = new Date('2026-03-15T02:00:00.000Z');
  // In UTC the anchor day is still today; in Moscow it is already tomorrow.
  assert.equal(readStoredStreak(stored, localDay(instant, 0)).current, 5);
  assert.equal(readStoredStreak(stored, localDay(instant, -180)).current, 5);
  // In New York the same instant is the previous day, so the anchor is "tomorrow"
  // and the run reads as broken.
  assert.equal(readStoredStreak(stored, localDay(instant, 300)).current, 0);
});