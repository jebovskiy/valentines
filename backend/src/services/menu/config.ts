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
  child: 0.7,
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

/**
 * How many LLM attempts the AI menu generator makes before giving up and
 * falling back to the deterministic planner. The first call builds the menu;
 * each next call is a budget/safety revision («собери заново, верни JSON»)
 * until the whole 21-slot week fits the receipt (whole packages).
 */
export const MENU_AI_MAX_REVISIONS = 4;

/** Upper bound for one AI menu-generation call (OpenRouter/DeepSeek can take
 * >2 min to emit the full 21-dish JSON non-streaming). */
export const MENU_AI_TIMEOUT_MS = 180_000;

/** Visible note that the meals are generated, not curated from the catalogue. */
export const MENU_AI_WARNING =
  'Меню и рецепты сгенерированы ИИ; цены и БЖУ рассчитаны по базе магазина. Проверяйте состав на аллергены вручную.';

/** Visible note when the planner had to use the deterministic catalogue instead. */
export const MENU_AI_FALLBACK_WARNING =
  'ИИ-планировщик не смог собрать полное меню в бюджет — показан подбор из каталога рецептов';

export function priceMaxAgeMs(): number {
  return PRICE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
}