import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { validateTelegramInitData } from '../src/utils/telegram';
import { config } from '../src/config';

/** Builds a well-formed Telegram initData signed with the real bot token. */
function makeInitData(overrides: Record<string, string> = {}): string {
  const now = Math.floor(Date.now() / 1000);
  const params = new URLSearchParams({
    user: JSON.stringify({ id: 42, first_name: 'Test', username: 'testy' }),
    auth_date: String(overrides.auth_date ?? now),
    query_id: 'AAHdF6IQAAAAAN0XohCrUL8T',
    ...overrides,
  });

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = createHmac('sha256', 'WebAppData').update(config.TELEGRAM_BOT_TOKEN).digest();
  const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  params.set('hash', hash);
  return params.toString();
}

test('telegram: valid fresh initData is accepted', () => {
  const result = validateTelegramInitData(makeInitData(), { maxAgeSec: 86400 });
  assert.ok(result);
  assert.equal(result!.user.id, 42);
  assert.equal(result!.hash.length, 64);
});

test('telegram: future auth_date is rejected', () => {
  const future = Math.floor(Date.now() / 1000) + 10 * 60;
  assert.equal(validateTelegramInitData(makeInitData({ auth_date: String(future) })), null);
});

test('telegram: expired initData is rejected with default window', () => {
  const old = Math.floor(Date.now() / 1000) - config.TELEGRAM_AUTH_MAX_AGE_SEC - 10;
  assert.equal(validateTelegramInitData(makeInitData({ auth_date: String(old) })), null);
});

test('telegram: expired initData is accepted with a larger explicit window', () => {
  const old = Math.floor(Date.now() / 1000) - 3600;
  const result = validateTelegramInitData(makeInitData({ auth_date: String(old) }), { maxAgeSec: 7200 });
  assert.ok(result);
});

test('telegram: tampered payload is rejected', () => {
  const data = makeInitData();
  const params = new URLSearchParams(data);
  params.set('user', JSON.stringify({ id: 999, first_name: 'Evil' }));
  assert.equal(validateTelegramInitData(params.toString()), null);
});

test('telegram: missing/invalid hash is rejected', () => {
  assert.equal(validateTelegramInitData('auth_date=1700000000&user=%7B%7D'), null);
  assert.equal(validateTelegramInitData(''), null);
});