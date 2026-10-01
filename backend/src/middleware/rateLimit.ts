import type { FastifyReply, FastifyRequest } from 'fastify';

interface RateLimitWindow {
  key: string;
  max: number;
  timeWindowMs: number;
}

const windows = new Map<string, number[]>();

function pruneWindow(key: string): void {
  const bucket = windows.get(key);
  if (!bucket) return;
  const now = Date.now();
  windows.set(
    key,
    bucket.filter((t) => now - t < 60_000)
  );
}

/**
 * Per-user (telegram_user_id) fixed-window rate limit. Must run AFTER the
 * telegram auth middleware so request.telegramUser is populated. Falls back
 * to the client IP when the user id is unavailable. In-memory only — fine for
 * a single Railway instance; for multiple instances prefer Redis-backed limits.
 */
export function userRateLimit(options: RateLimitWindow) {
  return async function userRateLimitMiddleware(request: FastifyRequest, reply: FastifyReply) {
    if (windows.size > 10_000) {
      windows.clear();
    }
    const identity = request.telegramUser?.id != null ? `u:${request.telegramUser.id}` : `ip:${request.ip}`;
    const key = `${options.key}:${identity}`;
    pruneWindow(key);
    const bucket = windows.get(key) ?? [];
    if (bucket.length >= options.max) {
      return reply.code(429).send({ error: 'Too many requests' });
    }
    bucket.push(Date.now());
    windows.set(key, bucket);
  };
}