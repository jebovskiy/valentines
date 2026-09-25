import { test } from 'node:test';
import assert from 'node:assert/strict';

// botRoutes imports '../config', which parses process.env on load.
process.env.SUPABASE_URL ??= 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test';
process.env.SUPABASE_ANON_KEY ??= 'test';
process.env.TELEGRAM_BOT_TOKEN ??= '123:test-token';
process.env.FCM_SERVICE_ACCOUNT_JSON ??= '{}';
process.env.WEBHOOK_SHARED_SECRET ??= 'x'.repeat(32);

test('bot: plugin registers and answers the webhook without timing out', async () => {
  const { botRoutes } = await import('../src/routes/bot');
  const { config } = await import('../src/config');
  const { default: fastify } = await import('fastify');

  const app = fastify();
  await app.register(botRoutes, { prefix: '/telegram' });
  await app.ready();

  // An unknown command still reaches the Telegram API (which fails in the
  // sandbox), but the webhook route itself must answer 200 ok to Telegram.
  const res = await app.inject({
    method: 'POST',
    url: '/telegram/',
    headers: { 'x-telegram-bot-api-secret-token': config.WEBHOOK_SHARED_SECRET },
    payload: { update_id: 1, message: { chat: { id: 123, type: 'private' }, text: '/nope' } },
  });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { ok: true });

  // Wrong secret is rejected.
  const bad = await app.inject({
    method: 'POST',
    url: '/telegram/',
    headers: { 'x-telegram-bot-api-secret-token': 'wrong' },
    payload: {},
  });
  assert.equal(bad.statusCode, 401);
});