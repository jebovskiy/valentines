import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRecapAggregates,
  buildRecapPrompt,
  fallbackRecapSummary,
  fetchAllPages,
  parseRecapSummary,
  periodLabel,
  periodStartFor,
  RECAP_RESPONSE_SCHEMA,
} from '../src/services/recap';
import type { RecapAggregates, RecapRawData } from '../src/services/recap';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-03-15T12:00:00.000Z');

const PAIR = {
  telegram_user_a: 10,
  telegram_user_b: 20,
  user_a_name: 'Аня',
  user_b_name: 'Дима',
  max_streak: 12,
  current_streak: 3,
  last_active_date: '2026-03-15',
};

function raw(overrides: Partial<RecapRawData> = {}): RecapRawData {
  return {
    pair: PAIR,
    periodKey: '30d',
    periodStart: periodStartFor('30d', NOW),
    valentines: [],
    greetings: [],
    watchedMovies: [],
    reviews: [],
    insights: [],
    dateSessions: [],
    tzOffsetMinutes: 0,
    now: NOW,
    ...overrides,
  };
}

function iso(daysAgo: number, hourUtc = 12): string {
  return new Date(NOW.getTime() - daysAgo * DAY + hourUtc * 60 * 60 * 1000 - 12 * 60 * 60 * 1000).toISOString();
}

function aggregates(overrides: Partial<RecapRawData> = {}): RecapAggregates {
  return buildRecapAggregates(raw(overrides));
}

test('valentines are split between partners and counted per period only', () => {
  const agg = aggregates({
    valentines: [
      { sender_telegram_id: 10, sent_at: iso(1) },
      { sender_telegram_id: 10, sent_at: iso(2) },
      { sender_telegram_id: 20, sent_at: iso(3) },
      { sender_telegram_id: 20, sent_at: iso(90) },
    ],
  });

  assert.equal(agg.valentinesCount, 3);
  assert.equal(agg.partnerACount, 2);
  assert.equal(agg.partnerBCount, 1);
});

test('all-time period keeps the whole history', () => {
  const agg = aggregates({
    periodKey: 'all',
    periodStart: periodStartFor('all', NOW),
    valentines: [
      { sender_telegram_id: 10, sent_at: iso(1) },
      { sender_telegram_id: 20, sent_at: iso(400) },
    ],
  });

  assert.equal(agg.valentinesCount, 2);
  assert.equal(agg.periodLabel, 'за всё время');
});

test('most active hour is counted in the local timezone of the device', () => {
  const valentines = [
    { sender_telegram_id: 10, sent_at: '2026-03-14T21:00:00.000Z' },
    { sender_telegram_id: 10, sent_at: '2026-03-13T21:00:00.000Z' },
  ];

  assert.equal(aggregates({ valentines }).mostActiveHour, 21);
  // UTC+3: 21:00 UTC — это уже следующий день, 00:00 местного.
  assert.equal(aggregates({ valentines, tzOffsetMinutes: -180 }).mostActiveHour, 0);
});

test('active hour and weekday are null when there is no activity', () => {
  const agg = aggregates();
  assert.equal(agg.mostActiveHour, null);
  assert.equal(agg.mostActiveWeekday, null);
});

test('activity hour and weekday share one bucket across valentines and greetings', () => {
  const agg = aggregates({
    valentines: [{ sender_telegram_id: 10, sent_at: '2026-03-10T10:00:00.000Z' }],
    greetings: [
      { type: 'morning', sent_at: '2026-03-11T10:00:00.000Z' },
      { type: 'morning', sent_at: '2026-03-12T10:00:00.000Z' },
      { type: 'night', sent_at: '2026-03-12T23:00:00.000Z' },
    ],
  });

  assert.equal(agg.mostActiveHour, 10);
  assert.equal(agg.mostActiveWeekday, 'четверг');
  assert.deepEqual(agg.greetingsByType, { morning: 2, night: 1 });
});

test('greetings outside the period are not counted at all', () => {
  const agg = aggregates({
    greetings: [
      { type: 'morning', sent_at: iso(1) },
      { type: 'care', sent_at: iso(60) },
    ],
  });

  assert.deepEqual(agg.greetingsByType, { morning: 1 });
});

test('movie compatibility averages only insights of movies watched in the period', () => {
  const agg = aggregates({
    watchedMovies: [
      { id: 'm1', watched_at: iso(2), added_at: iso(10) },
      { id: 'm2', watched_at: iso(5), added_at: iso(10) },
      { id: 'm3', watched_at: iso(100), added_at: iso(100) },
    ],
    insights: [
      { movie_id: 'm1', result: { compatibility_percent: 82 } },
      { movie_id: 'm2', result: { compatibility_percent: 88 } },
      { movie_id: 'm3', result: { compatibility_percent: 10 } },
    ],
  });

  assert.equal(agg.moviesWatched, 2);
  assert.equal(agg.avgMovieCompatibility, 85);
});

test('movie compatibility is null when there is nothing to average', () => {
  assert.equal(aggregates().avgMovieCompatibility, null);
});

test('movie without watched_at falls back to added_at for the period window', () => {
  const agg = aggregates({
    watchedMovies: [{ id: 'm1', watched_at: null, added_at: iso(4) }],
    insights: [{ movie_id: 'm1', result: { compatibility_percent: 70 } }],
  });

  assert.equal(agg.moviesWatched, 1);
  assert.equal(agg.avgMovieCompatibility, 70);
});

function review(movieId: string, author: number, scores: Partial<Record<string, number>>) {
  return {
    movie_id: movieId,
    author_telegram_id: author,
    visuals: 5,
    plot: 5,
    acting: 5,
    music: 5,
    atmosphere: 5,
    humor: 5,
    ...scores,
  } as never;
}

test('biggest taste gap is the aspect with the largest average difference', () => {
  const agg = aggregates({
    watchedMovies: [
      { id: 'm1', watched_at: iso(2), added_at: iso(2) },
      { id: 'm2', watched_at: iso(3), added_at: iso(3) },
    ],
    reviews: [
      review('m1', 10, { humor: 1, music: 5 }),
      review('m1', 20, { humor: 5, music: 5 }),
      review('m2', 10, { humor: 2, music: 3 }),
      review('m2', 20, { humor: 5, music: 5 }),
    ],
  });

  assert.equal(agg.moviesScoredByBoth, 2);
  assert.equal(agg.biggestMovieGap, 'юмор');
});

test('taste gap ignores movies scored by only one partner', () => {
  const agg = aggregates({
    watchedMovies: [{ id: 'm1', watched_at: iso(2), added_at: iso(2) }],
    reviews: [review('m1', 10, { humor: 1 })],
  });

  assert.equal(agg.moviesScoredByBoth, 0);
  assert.equal(agg.biggestMovieGap, null);
});

test('only matched date sessions inside the period count', () => {
  const agg = aggregates({
    dateSessions: [
      { match: { matched: true }, created_at: iso(1) },
      { match: { matched: 'true' }, created_at: iso(2) },
      { match: { matched: false }, created_at: iso(3) },
      { match: null, created_at: iso(3) },
      { match: { matched: true }, created_at: iso(80) },
    ],
  });

  assert.equal(agg.datesMatched, 2);
});

test('the streak is read from the pair row, so it cannot drift from /api/pairs/streak', () => {
  // The stored run is maintained atomically by register_valentine_activity; the
  // recap must show exactly that number rather than deriving its own from the
  // (period-filtered) valentines it happens to have loaded.
  const agg = aggregates({
    valentines: [
      { sender_telegram_id: 10, sent_at: iso(0) },
      { sender_telegram_id: 20, sent_at: iso(1) },
      { sender_telegram_id: 10, sent_at: iso(2) },
    ],
  });

  assert.equal(agg.currentStreak, 3);
  // Рекорд из pairs остаётся полом: расхождение вниз не откатывает историю.
  assert.equal(agg.maxStreak, 12);
});

test('a long streak survives a short period instead of being clamped to it', () => {
  // Regression: the streak used to be derived from the period-filtered rows, so a
  // 120-day run showed as "7 дней" on the 7d tab.
  const longRun = {
    current_streak: 120,
    max_streak: 120,
    last_active_date: '2026-03-15',
  };

  for (const periodKey of ['7d', '30d', '90d', 'all'] as const) {
    const agg = aggregates({
      pair: { ...PAIR, ...longRun },
      periodKey,
      periodStart: periodStartFor(periodKey, NOW),
      // Only the rows inside the window are loaded -- exactly the old bug.
      valentines: [{ sender_telegram_id: 10, sent_at: iso(1) }],
    });
    assert.equal(agg.currentStreak, 120, `period ${periodKey} clamped the streak`);
    assert.equal(agg.maxStreak, 120);
  }
});

test('a broken run keeps the record but drops the current streak', () => {
  const agg = aggregates({
    pair: { ...PAIR, max_streak: 30, current_streak: 4, last_active_date: '2026-03-13' },
    valentines: [
      { sender_telegram_id: 10, sent_at: iso(20) },
      { sender_telegram_id: 10, sent_at: iso(0) },
    ],
  });

  // last_active_date is two days old, so the run is over no matter what the
  // loaded rows look like.
  assert.equal(agg.currentStreak, 0);
  assert.equal(agg.maxStreak, 30);
});

test('an unanchored pair shows no streak rather than a stale number', () => {
  const agg = aggregates({
    pair: { ...PAIR, current_streak: 9, max_streak: 9, last_active_date: null },
  });
  assert.equal(agg.currentStreak, 0);
  assert.equal(agg.maxStreak, 9);
});

test('the recap streak is judged in the client timezone', () => {
  // 22:00Z is already the next day in Moscow (offset -180) and the previous
  // evening in New York (offset +300).
  const instant = new Date('2026-03-15T22:00:00.000Z');
  const anchored = { ...PAIR, current_streak: 4, max_streak: 4, last_active_date: '2026-03-15' };

  assert.equal(
    aggregates({ pair: anchored, tzOffsetMinutes: 0, now: instant }).currentStreak,
    4
  );
  // Moscow: "today" is 2026-03-16, so 2026-03-15 is yesterday -- still alive.
  assert.equal(
    aggregates({ pair: anchored, tzOffsetMinutes: -180, now: instant }).currentStreak,
    4
  );
  // New York: "today" is still 2026-03-15 in UTC terms for this anchor.
  assert.equal(
    aggregates({ pair: anchored, tzOffsetMinutes: 300, now: instant }).currentStreak,
    4
  );
});

test('period labels are natural and periodStartFor honours the window', () => {
  assert.equal(periodLabel('7d'), 'за последние 7 дней');
  assert.equal(periodLabel('30d'), 'за последние 30 дней');
  assert.equal(periodLabel('all'), 'за всё время');
  assert.equal(periodStartFor('all', NOW), null);
  assert.equal(periodStartFor('7d', NOW)?.toISOString(), new Date(NOW.getTime() - 7 * DAY).toISOString());
});

test('the prompt carries the agreed numbers and never a guessed one', () => {
  const prompt = buildRecapPrompt(aggregates());
  assert.match(prompt, /Валентинок отправлено: 0/);
  assert.match(prompt, /Самый частый час активности: нет данных/);
  assert.match(prompt, /Средняя % совместимости по фильмам за период: нет данных/);
  assert.match(prompt, /Никогда не придумывай цифры/);
  assert.match(prompt, /Не упоминай, что текст сгенерирован автоматически/);
  assert.match(prompt, /за последние 30 дней/);
});

test('the response schema demands every field of the card', () => {
  assert.deepEqual(RECAP_RESPONSE_SCHEMA.required, [
    'headline',
    'highlight_number',
    'insight',
    'fun_fact',
    'closing_line',
  ]);
});

test('parseRecapSummary accepts a full answer', () => {
  const parsed = parseRecapSummary(
    JSON.stringify({
      headline: '🔥 42 валентинки',
      highlight_number: '7 свиданий за месяц.',
      insight: 'Вы отправляли друг другу валентинки каждый вторник.',
      fun_fact: 'Оба проснулись в 9 утра — вы вообще спали?',
      closing_line: 'В следующем месяце ждём рекорд.',
    })
  );

  assert.ok(parsed);
  assert.equal(parsed!.headline, '🔥 42 валентинки');
  assert.equal(parsed!.fun_fact, 'Оба проснулись в 9 утра — вы вообще спали?');
});

test('parseRecapSummary rejects broken payloads instead of showing garbage', () => {
  assert.equal(parseRecapSummary(null), null);
  assert.equal(parseRecapSummary('не json'), null);
  assert.equal(parseRecapSummary(JSON.stringify({ headline: 'только один' })), null);
  assert.equal(parseRecapSummary(JSON.stringify({ headline: '', highlight_number: '1', insight: 'a', fun_fact: 'b', closing_line: 'c' })), null);
});

test('parseRecapSummary keeps the headline within the promised length', () => {
  const long = 'А'.repeat(120);
  const parsed = parseRecapSummary(
    JSON.stringify({ headline: long, highlight_number: '1', insight: 'a', fun_fact: 'b', closing_line: 'c' })
  );

  assert.equal(parsed?.headline.length, 40);
});

test('fallback text for an empty period stays honest', () => {
  const summary = fallbackRecapSummary(aggregates());

  assert.match(summary.headline, /Пока тихо/);
  assert.match(summary.highlight_number, /^0/);
  assert.ok(summary.insight.length > 0 && summary.fun_fact.length > 0 && summary.closing_line.length > 0);
});

test('fallback text reuses only numbers from the aggregates', () => {
  const agg = aggregates({
    valentines: [
      { sender_telegram_id: 10, sent_at: iso(1) },
      { sender_telegram_id: 10, sent_at: iso(2) },
      { sender_telegram_id: 20, sent_at: iso(3) },
    ],
    greetings: [{ type: 'morning', sent_at: iso(2) }],
    watchedMovies: [{ id: 'm1', watched_at: iso(2), added_at: iso(2) }],
    insights: [{ movie_id: 'm1', result: { compatibility_percent: 91 } }],
    dateSessions: [{ match: { matched: true }, created_at: iso(4) }],
  });

  const summary = fallbackRecapSummary(agg);
  assert.match(summary.headline, /3 валентинки/);
  assert.ok(summary.headline.length <= 40, `headline too long: ${summary.headline}`);
  assert.match(summary.highlight_number, /3 валентинки/);
  assert.match(summary.highlight_number, /1 свидание/);
  assert.match(summary.highlight_number, /1 фильм/);
  assert.match(summary.insight, /Аня/);
  assert.match(summary.insight, /67%/);
  assert.match(summary.insight, /91%/);
  assert.match(summary.insight, /на 3 дня/);
});

test('an even split does not claim a leader', () => {
  const agg = aggregates({
    valentines: [
      { sender_telegram_id: 10, sent_at: iso(1) },
      { sender_telegram_id: 20, sent_at: iso(2) },
    ],
  });

  assert.match(fallbackRecapSummary(agg).insight, /поровну/);
});

test('fetchAllPages reads a whole period instead of only the newest page', async () => {
  const all = Array.from({ length: 1200 }, (_, i) => ({ id: `row-${i}` }));
  const offsets: number[] = [];

  const rows = await fetchAllPages<{ id: string }>((offset, limit) => {
    offsets.push(offset);
    return Promise.resolve({ data: all.slice(offset, offset + limit), error: null });
  }, 'valentines');

  assert.equal(rows.length, 1200);
  assert.deepEqual(
    rows.map((r) => r.id),
    all.map((r) => r.id),
    'pages must come back in the order the query promised',
  );
  assert.deepEqual(offsets, [0, 500, 1000]);
});

test('fetchAllPages stops on a short page', async () => {
  const rows = await fetchAllPages<{ id: string }>(
    (offset) => Promise.resolve({ data: [{ id: `row-${offset}` }], error: null }),
    'valentines',
  );
  assert.equal(rows.length, 1);
});

test('fetchAllPages surfaces a page error rather than half a period', async () => {
  const full = Array.from({ length: 500 }, (_, i) => ({ id: `row-${i}` }));

  try {
    await fetchAllPages<{ id: string }>(
      (offset) =>
        Promise.resolve(
          offset === 0 ? { data: full, error: null } : { data: null, error: { message: 'boom' } },
        ),
      'valentines',
    );
    assert.fail('expected the page error to be rethrown');
  } catch (error) {
    assert.equal((error as { message: string }).message, 'boom');
  }
});

test('fetchAllPages hits the ceiling loudly instead of quietly', async () => {
  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    warnings.push(args.map(String).join(' '));
  };

  try {
    const rows = await fetchAllPages<{ id: string }>(
      (offset, limit) =>
        Promise.resolve({
          data: Array.from({ length: limit }, (_, i) => ({ id: `row-${offset + i}` })),
          error: null,
        }),
      'valentines',
    );

    assert.equal(rows.length, 20_000);
    assert.equal(warnings.length, 1, 'a truncated recap must say so');
    assert.match(warnings[0], /20000-row ceiling/);
    assert.match(warnings[0], /truncated/);
  } finally {
    console.warn = originalWarn;
  }
});