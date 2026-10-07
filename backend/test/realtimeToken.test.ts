import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { decodeJwtPayload, isRealtimeSigningConfigured, mintRealtimeToken } from '../src/services/realtimeToken';

const SECRET = 'test-jwt-secret-that-is-long-enough';
const NOW = 1_800_000_000;

function signWith(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

test('no secret means no token, and that is not an error', () => {
  // The client falls back to anonymous realtime + polling when this happens.
  assert.equal(isRealtimeSigningConfigured(), false);
  assert.equal(mintRealtimeToken(42, 'pair-1', { secret: undefined, nowSeconds: NOW }), null);
});

test('the token carries the claims the RLS policies read', () => {
  const minted = mintRealtimeToken(4242, 'pair-abc', { secret: SECRET, nowSeconds: NOW });
  assert.ok(minted);

  const claims = decodeJwtPayload(minted.token)!;
  // 026 policies do: current_setting('request.jwt.claims', true)::json->>'user_id'
  assert.equal(claims.user_id, 4242);
  // Supabase/GoTrue expects sub + aud + role to be coherent for an authed session.
  assert.equal(claims.sub, '4242');
  assert.equal(claims.aud, 'authenticated');
  assert.equal(claims.role, 'authenticated');
  assert.equal(claims.pair_id, 'pair-abc');
});

test('an unpaired user still gets a token, just without a pair', () => {
  const minted = mintRealtimeToken(1, null, { secret: SECRET, nowSeconds: NOW });
  assert.ok(minted);
  assert.equal(decodeJwtPayload(minted.token)!.pair_id, null);
});

test('the signature is HS256 over the exact header and payload', () => {
  const minted = mintRealtimeToken(7, 'p', { secret: SECRET, nowSeconds: NOW })!;
  const [header, payload, signature] = minted.token.split('.');

  assert.deepEqual(JSON.parse(Buffer.from(header, 'base64url').toString()), { alg: 'HS256', typ: 'JWT' });
  assert.equal(signature, signWith(`${header}.${payload}`, SECRET));

  // ...and a different secret must not validate.
  assert.notEqual(signature, signWith(`${header}.${payload}`, `${SECRET}-other`));
});

test('the token is base64url: no +, / or = anywhere', () => {
  const minted = mintRealtimeToken(999_999_999, 'a'.repeat(40), { secret: SECRET, nowSeconds: NOW })!;
  assert.match(minted.token, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
});

test('exp is derived from the injected clock and the ttl', () => {
  const minted = mintRealtimeToken(1, null, { secret: SECRET, nowSeconds: NOW, ttlSeconds: 900 })!;
  assert.equal(decodeJwtPayload(minted.token)!.iat, NOW);
  assert.equal(decodeJwtPayload(minted.token)!.exp, NOW + 900);
  assert.equal(minted.expiresAt, NOW + 900);
  assert.equal(minted.expiresIn, 900);
});

test('the ttl is bounded so a leaked token dies on its own', () => {
  const minted = mintRealtimeToken(1, null, { secret: SECRET, nowSeconds: NOW })!;
  assert.ok(minted.expiresIn <= 3600, `ttl too long: ${minted.expiresIn}`);
  assert.ok(minted.expiresIn >= 300);
});

test('malformed tokens decode to null instead of throwing', () => {
  assert.equal(decodeJwtPayload('not-a-jwt'), null);
  assert.equal(decodeJwtPayload('a.b'), null);
  assert.equal(decodeJwtPayload('a.!!!.c'), null);
});