import { createHmac } from 'node:crypto';
import { config } from '../config';

/**
 * Minting the token that lets the miniapp use Supabase Realtime under RLS.
 *
 * WHY THIS EXISTS
 * The client creates its Supabase client with the *anon* key and never calls
 * `setAuth`, so every realtime socket ran as the `anon` role with no claims.
 * Two consequences, both verified against 019/020:
 *   * `date_sessions` / `game_sessions` policies are
 *     `auth.uid() IS NULL OR EXISTS(...)`, and `auth.uid()` is NULL for anon, so
 *     the OR short-circuited to TRUE: the public anon key could subscribe to any
 *     `pair_id` and read another couple's session rows.
 *   * `valentines` policies read `request.jwt.claims->>'user_id'`, which is absent
 *     for anon, so the cast produced NULL and the policy denied everything --
 *     subscribeToValentines could never deliver a row (it was also never added to
 *     the `supabase_realtime` publication).
 *
 * Migration 026 fixes both ends: the policies are now strictly claim-scoped, and
 * they only exist on the three tables the client actually subscribes to. This
 * module supplies the claim they require.
 *
 * The signature is HS256 with the project's JWT secret (Supabase dashboard ->
 * Project Settings -> API -> JWT Secret). No extra dependency: 20 lines of
 * node:crypto beats pulling in jsonwebtoken.
 *
 * If `SUPABASE_JWT_SECRET` is not configured, `mintRealtimeToken` returns null and
 * the client simply stays unauthenticated -- realtime then delivers nothing and
 * the existing 5s polling fallback keeps the UI correct. That is the same
 * behaviour as before this change, so the feature is safe to roll out first.
 */

const DEFAULT_TTL_SECONDS = 3600;

export interface RealtimeToken {
  token: string;
  /** Unix seconds. */
  expiresAt: number;
  expiresIn: number;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function sign(payload: string, secret: string): string {
  return base64url(createHmac('sha256', secret).update(payload).digest());
}

export function isRealtimeSigningConfigured(): boolean {
  return typeof config.SUPABASE_JWT_SECRET === 'string' && config.SUPABASE_JWT_SECRET.length > 0;
}

export interface MintOptions {
  secret?: string;
  /** Injectable clock so the token can be tested without freezing time. */
  nowSeconds?: number;
  ttlSeconds?: number;
}

/**
 * HS256 JWT with the `user_id` claim the RLS policies read. `pair_id` is included
 * as well so a future policy can avoid the `pairs` subquery, but nothing in 026
 * trusts it -- authorisation stays on `user_id`.
 */
export function mintRealtimeToken(
  userId: number,
  pairId: string | null,
  options: MintOptions = {}
): RealtimeToken | null {
  const secret = options.secret ?? config.SUPABASE_JWT_SECRET;
  if (!secret) return null;

  const issuedAt = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const ttl = options.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const expiresAt = issuedAt + ttl;

  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    iss: 'valentines-backend',
    sub: String(userId),
    aud: 'authenticated',
    role: 'authenticated',
    iat: issuedAt,
    exp: expiresAt,
    user_id: userId,
    pair_id: pairId,
  };

  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  return { token: `${signingInput}.${sign(signingInput, secret)}`, expiresAt, expiresIn: ttl };
}

/** Decodes the payload without verifying -- test/diagnostic helper only. */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}