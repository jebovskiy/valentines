import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clearRecapSummaryCache,
  getCachedRecapSummary,
  recapSummaryCacheKey,
  setCachedRecapSummary,
} from '../src/services/recapCache';
import type { RecapAggregates, RecapSummary } from '../src/services/recap';

function aggregates(overrides: Partial<RecapAggregates> = {}): RecapAggregates {
  return {
    periodKey: '30d',
    periodLabel: 'за последние 30 дней',
    periodStart: '2026-09-08T00:00:00.000Z',
    valentinesCount: 12,
    partnerAName: 'Аня',
    partnerACount: 7,
    partnerBName: 'Ваня',
    partnerBCount: 5,
    greetingsByType: { good_morning: 4 },
    currentStreak: 6,
    maxStreak: 9,
    mostActiveHour: 21,
    mostActiveWeekday: 'суббота',
    avgMovieCompatibility: 4.2,
    biggestMovieGap: 'Сюжет',
    moviesWatched: 3,
    datesMatched: 1,
    moviesScoredByBoth: 2,
    ...overrides,
  };
}

const summary: RecapSummary = {
  headline: 'Заголовок',
  highlight_number: '12',
  insight: 'Мысль',
  fun_fact: 'Факт',
  closing_line: 'Финал',
};

test.beforeEach(() => {
  clearRecapSummaryCache();
});

test('the cache key follows the aggregates, and only them', () => {
  const base = recapSummaryCacheKey(aggregates());
  assert.equal(recapSummaryCacheKey(aggregates()), base, 'byte-identical aggregates share a key');
  assert.notEqual(recapSummaryCacheKey(aggregates({ valentinesCount: 13 })), base, 'a changed count is a new key');
  assert.notEqual(recapSummaryCacheKey(aggregates({ partnerAName: 'Оля' })), base, 'a renamed partner is a new key');
  assert.notEqual(recapSummaryCacheKey(aggregates({ periodKey: '7d' })), base, 'a different period is a new key');
});

test('a summary written for a key is read back for that key', () => {
  const key = recapSummaryCacheKey(aggregates());
  assert.equal(getCachedRecapSummary(key), null, 'the cache starts empty');
  setCachedRecapSummary(key, summary);
  assert.deepEqual(getCachedRecapSummary(key), summary);
});

test('an entry past its expiry is dropped rather than served', () => {
  const key = recapSummaryCacheKey(aggregates());
  setCachedRecapSummary(key, summary, 1_000);
  assert.deepEqual(getCachedRecapSummary(key, 1_001), summary, 'fresh reads return the summary');
  assert.equal(getCachedRecapSummary(key, 60 * 60_000), null, 'an expired read returns nothing');
  assert.equal(getCachedRecapSummary(key, 1_001), null, 'and the entry is gone, not merely hidden');
});

test('the cache evicts its oldest entry once it is full', () => {
  for (let i = 0; i < 101; i += 1) {
    setCachedRecapSummary(`key-${i}`, summary);
  }
  assert.equal(getCachedRecapSummary('key-0'), null, 'the oldest entry was evicted');
  assert.deepEqual(getCachedRecapSummary('key-1'), summary, 'the next one survived');
  assert.deepEqual(getCachedRecapSummary('key-100'), summary, 'the newest entry is present');
});
