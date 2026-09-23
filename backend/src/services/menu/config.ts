import type { ServingCoefficients } from './types';

export const CURRENCY = 'BYN';

/**
 * Portion coefficients. A child is NOT counted as a full adult portion.
 * Centralised here (domain configuration) so it can later depend on the
 * child's age tier:
 *   adult: 1.0
 *   child 3-6: 0.5
 *   child 7-12: 0.75
 */
export const SERVING_COEFFICIENTS: ServingCoefficients = {
  adult: 1.0,
  child: 0.6,
};

/** Length of the week plan, in days. */
export const MENU_WEEK_DAYS = 7;

/** Required meals per day, in the canonical order used to fill slots. */
export const MENU_DAILY_MEALS = ['breakfast', 'lunch', 'dinner'] as const;

/** How many full week-plan attempts are run; the best (most filled, cheapest) wins. */
export const MENU_GENERATION_ATTEMPTS = 30;

/** A price older than this many days is not considered fresh for selection. */
export const PRICE_MAX_AGE_DAYS = 30;

/** Menu result ids are only ever generated once; prefix for human-readable ids. */
export const MENU_ID_PREFIX = 'menu';

export function priceMaxAgeMs(): number {
  return PRICE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
}