import { test } from 'node:test';
import assert from 'node:assert/strict';
import { userRateLimit } from '../src/middleware/rateLimit';

interface FakeReply {
  sentStatus: number | null;
  sentBody: unknown;
  code(status: number): this;
  send(body: unknown): void;
}

function makeReply(): FakeReply & { statusCode: number } {
  return {
    sentStatus: null,
    sentBody: null,
    statusCode: 0,
    code(status) {
      this.statusCode = status;
      this.sentStatus = status;
      return this;
    },
    send(body) {
      this.sentBody = body;
    },
  };
}

test('rateLimit: allows requests up to the max', async () => {
  const guard = userRateLimit({ key: 'test', max: 3, timeWindowMs: 60_000 });
  const reply = makeReply();
  const request = { telegramUser: { id: 1 }, ip: '10.0.0.1' } as never;

  for (let i = 0; i < 3; i += 1) {
    await guard(request, reply as never);
    assert.equal(reply.sentStatus, null, `request ${i + 1} should pass`);
  }
});

test('rateLimit: rejects the (max+1)-th request for the same user', async () => {
  const guard = userRateLimit({ key: 'test', max: 3, timeWindowMs: 60_000 });
  const reply = makeReply();
  const request = { telegramUser: { id: 7 }, ip: '10.0.0.2' } as never;

  for (let i = 0; i < 3; i += 1) await guard(request, reply as never);
  await guard(request, reply as never);

  assert.equal(reply.sentStatus, 429);
  assert.equal((reply.sentBody as { error: string }).error, 'Too many requests');
});

test('rateLimit: keys fail independently per user', async () => {
  const guard = userRateLimit({ key: 'test', max: 1, timeWindowMs: 60_000 });
  const replyA = makeReply();
  const replyB = makeReply();
  const userA = { telegramUser: { id: 11 }, ip: '10.0.0.3' } as never;
  const userB = { telegramUser: { id: 22 }, ip: '10.0.0.4' } as never;

  await guard(userA, replyA as never);
  assert.equal(replyA.sentStatus, null);
  await guard(userB, replyB as never);
  assert.equal(replyB.sentStatus, null);
});

test('rateLimit: falls back to IP when telegram user is absent', async () => {
  const guard = userRateLimit({ key: 'test', max: 1, timeWindowMs: 60_000 });
  const reply = makeReply();
  const request = { telegramUser: undefined, ip: '10.0.0.99' } as never;

  await guard(request, reply as never);
  assert.equal(reply.sentStatus, null);
  await guard(request, reply as never);
  assert.equal(reply.sentStatus, 429);
});