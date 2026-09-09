import type { Pair } from '../types';

export const GREETINGS_PROBE_USER_ID = 461666389;

export const GREETINGS_ENABLED_IDS = new Set<number>([GREETINGS_PROBE_USER_ID]);

export function isGreetingsEnabled(pair: Pair | null, currentUserId: number | null): boolean {
  if (!pair) return false;
  return (
    GREETINGS_ENABLED_IDS.has(pair.telegram_user_a) ||
    GREETINGS_ENABLED_IDS.has(pair.telegram_user_b) ||
    (currentUserId != null && GREETINGS_ENABLED_IDS.has(currentUserId))
  );
}