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

/** Upper bound of recipes the planner may pick for one menu. */
export const MENU_MAX_RECIPES = 4;
/** At least this many recipes must be within budget, otherwise budget_too_low. */
export const MENU_MIN_RECIPES = 1;

/** A price older than this many days is not considered fresh for selection. */
export const PRICE_MAX_AGE_DAYS = 30;

/** Menu result ids are only ever generated once; prefix for human-readable ids. */
export const MENU_ID_PREFIX = 'menu';

export function priceMaxAgeMs(): number {
  return PRICE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
}