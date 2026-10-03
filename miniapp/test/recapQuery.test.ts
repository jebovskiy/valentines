import assert from 'node:assert/strict';
import test from 'node:test';
import { recapQuery } from '../src/api/recapQuery';

test('recap: период уходит в query без потери слеша', () => {
  assert.equal(recapQuery('30d', 0), 'period=30d&tz_offset_minutes=0');
  assert.equal(recapQuery('all', 0), 'period=all&tz_offset_minutes=0');
});

test('recap: смещение часового пояса передаётся в минутах как у Date', () => {
  // UTC+3: Date#getTimezoneOffset() отдаёт -180, и backend ждёт именно это.
  assert.equal(recapQuery('7d', -180), 'period=7d&tz_offset_minutes=-180');
  assert.equal(recapQuery('90d', 330), 'period=90d&tz_offset_minutes=330');
});

test('recap: дробные минуты округляются, чтобы Fastify не споткнулся о zod', () => {
  assert.equal(recapQuery('30d', -179.7), 'period=30d&tz_offset_minutes=-179');
});