import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advanceStreamCursor, cursorFromRow } from '../src/services/streamCursor';

const row = (id: string, sent_at: string) => ({ id, sent_at });

test('the resume cursor announces only the row it points at as seen', () => {
  const cursor = cursorFromRow(row('a', '2026-03-15T10:00:00.000000+00:00'));
  assert.deepEqual([...cursor.ids], ['a']);
  assert.equal(cursor.ts, '2026-03-15T10:00:00.000000+00:00');
});

test('rows after the anchor are announced, the anchor itself is not', () => {
  const cursor = cursorFromRow(row('a', 'T1'));
  const page = [row('a', 'T1'), row('b', 'T2'), row('c', 'T3')];
  const { fresh, next } = advanceStreamCursor(cursor, page);

  assert.deepEqual(
    fresh.map((r) => r.id),
    ['b', 'c'],
  );
  assert.equal(next.ts, 'T3');
  assert.deepEqual([...next.ids], ['c']);
});

test('a quiet poll leaves the cursor untouched', () => {
  const cursor = cursorFromRow(row('a', 'T1'));
  const page = [row('a', 'T1')];
  const { fresh, next } = advanceStreamCursor(cursor, page);

  assert.deepEqual(fresh, []);
  assert.equal(next, cursor);
});

test('rows sharing the anchor timestamp are suppressed only until it moves', () => {
  // One transaction shares a single now(), so several rows can land on exactly
  // the same sent_at — without the id set the anchor row would be re-sent on
  // every single poll.
  const cursor = { ts: 'T1', ids: new Set(['a', 'b']) };
  const page = [row('a', 'T1'), row('b', 'T1'), row('c', 'T1')];
  const { fresh, next } = advanceStreamCursor(cursor, page);

  assert.deepEqual(
    fresh.map((r) => r.id),
    ['c'],
  );
  assert.equal(next.ts, 'T1');
  assert.deepEqual([...next.ids].sort(), ['a', 'b', 'c']);
});

test('the new anchor covers every row the page saw on that timestamp', () => {
  const cursor = cursorFromRow(row('a', 'T1'));
  const page = [row('a', 'T1'), row('b', 'T2'), row('c', 'T2')];
  const { fresh, next } = advanceStreamCursor(cursor, page);

  assert.deepEqual(
    fresh.map((r) => r.id),
    ['b', 'c'],
  );
  assert.deepEqual([...next.ids].sort(), ['b', 'c']);
});

test('rows the batch limit cut off stay out of the id set and are announced next poll', () => {
  // The page ends mid-timestamp because it hit STREAM_BATCH. Those rows are
  // not in the page, so they cannot be in `ids` — the next poll fetches them
  // again and this time announces them. Preloading them would skip them forever.
  const cursor = cursorFromRow(row('a', 'T1'));
  const page = [row('a', 'T1'), row('b', 'T2')];
  const { fresh, next } = advanceStreamCursor(cursor, page);

  assert.deepEqual([...next.ids], ['b']);
  assert.equal(next.ids.has('d'), false);
});

test('a gap of many rows is drained in order rather than skipped', () => {
  // Three polls' worth of arrivals, all fetched at once: the newest-only read
  // this replaces would have announced the last one and dropped the first two.
  const cursor = cursorFromRow(row('a', 'T1'));
  const page = [row('a', 'T1'), row('b', 'T2'), row('c', 'T3'), row('d', 'T4')];
  const { fresh } = advanceStreamCursor(cursor, page);

  assert.deepEqual(
    fresh.map((r) => r.id),
    ['b', 'c', 'd'],
  );
});
