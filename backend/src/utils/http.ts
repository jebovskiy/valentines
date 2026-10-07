/**
 * Every outbound call that ships without a ceiling inherits the failure mode
 * of the one before it: the socket stays open, the worker stays pinned, and
 * the request that triggered the call never gets an answer. External fetches
 * go through here so the budget lives in one place.
 */
export const DEFAULT_FETCH_TIMEOUT_MS = 10_000;
// Telegram has its own slow days; a notification attempt is allowed to be
// patient, but not patient enough to hold a connection open indefinitely.
export const TELEGRAM_FETCH_TIMEOUT_MS = 15_000;

export function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const signals: AbortSignal[] = [AbortSignal.timeout(timeoutMs)];
  if (init.signal) signals.push(init.signal);
  return fetch(url, { ...init, signal: AbortSignal.any(signals) });
}
