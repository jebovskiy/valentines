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

/**
 * Hard floor for a weekly budget. Any request below this is clamped up to it
 * so a menu always assembles («минимальный бюджет 40 BYN»).
 */
export const MENU_MIN_BUDGET = 40;

/**
 * How many times a single recipe may fill different slots in the same week
 * (e.g. rice-based dinners when the fully-priced pool is thin). Kept low so
 * uniqueness stays the default whenever the catalogue can sustain it.
 */
export const MENU_MAX_RECIPE_REPEATS = 2;

/** A price older than this many days is not considered fresh for selection. */
export const PRICE_MAX_AGE_DAYS = 30;

/** Menu result ids are only ever generated once; prefix for human-readable ids. */
export const MENU_ID_PREFIX = 'menu';

export function priceMaxAgeMs(): number {
  return PRICE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
}