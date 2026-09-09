import type { Pair } from '../types';

export function isGreetingsEnabled(pair: Pair | null, _currentUserId: number | null): boolean {
  return !!pair;
}