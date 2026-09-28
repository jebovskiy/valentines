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
 * Эмпирически откалиброванный пол бюджета на одну эффективную порцию (BYN/неделя).
 * Выведено прогоном детерминированного планировщика на реальном снапшоте цен
 * euroopt: 2 взрослых (effectiveServings=2.0) требуют ~101 BYN на 21/21 слот,
 * т.е. ~50 BYN на порцию. Это эвристика, не закон — она сдвигается при
 * обновлении снапшота цен/каталога рецептов и требует периодической
 * перекалибровки (см. scripts/calibrate-min-budget.ts — TODO).
 */
export const MENU_MIN_BUDGET_PER_SERVING = 50;

/** Абсолютный пол независимо от числа едоков — не даёт бюджету для 1 персоны
 * выродиться в нереалистично маленькое число. */
export const MENU_MIN_BUDGET_FLOOR = 30;

export function minBudgetFor(effectiveServings: number, dishesPerDay = 3): number {
  const multiplier = Math.max(1, dishesPerDay / 3);
  return Math.max(MENU_MIN_BUDGET_FLOOR, Math.round(MENU_MIN_BUDGET_PER_SERVING * effectiveServings * multiplier));
}

/**
 * How many times a single recipe may fill different slots in the same week
 * (e.g. rice-based dinners when the fully-priced pool is thin). Kept low so
 * uniqueness stays the default whenever the catalogue can sustain it.
 */
export const MENU_MAX_RECIPE_REPEATS = 2;

/**
 * Fraction of the weekly budget the deterministic/AI menu may overshoot and
 * still be accepted. Whole-package rounding (buying a 1 kg bag for 120 g of
 * flour) inflates the receipt ~20% beyond the "ideal" ingredient cost, so a
 * tolerance below that keeps triggering the fallback. 0.10 lets a typical
 * rounded receipt through; the overshoot is surfaced as a soft warning, not
 * hidden.
 */
export const MENU_BUDGET_OVERSHOOT_TOLERANCE = 0.10;

/** A price older than this many days is not considered fresh for selection. */
export const PRICE_MAX_AGE_DAYS = 30;

/**
 * How many unpriced ingredients a recipe may still have and stay eligible for
 * the menu. A dish missing «перец»/«томатная паста» in the store catalogue is
 * still suggested; its cost then excludes those ingredients and the menu shows
 * a note. Recipes with more unmatched ingredients than this are rejected.
 */
export const MENU_MAX_UNPRICED_INGREDIENTS = 2;

/** Menu result ids are only ever generated once; prefix for human-readable ids. */
export const MENU_ID_PREFIX = 'menu';

/**
 * How many LLM attempts the AI menu generator makes before giving up and
 * falling back to the deterministic planner. The first call builds the menu;
 * each next call is a budget/safety revision («собери заново, верни JSON»)
 * until the whole 21-slot week fits the receipt (whole packages).
 */
export const MENU_AI_MAX_REVISIONS = 4;

/** Upper bound for one AI menu-generation call. Days are generated per-day
 * (a few K output tokens each) and OpenRouter/Gemini are raced in parallel
 * when both keys are configured, so a single slow primary no longer gates the
 * round — the bound exists only to abandon genuinely hung calls. */
export const MENU_AI_TIMEOUT_MS = 120_000;

/** Visible note that the meals are generated, not curated from the catalogue. */
export const MENU_AI_WARNING =
  'Меню и рецепты составлены автоматически; цены и БЖУ рассчитаны по базе магазина. Проверяйте состав на аллергены вручную.';

/** Visible note when the planner had to use the deterministic catalogue instead. */
export const MENU_AI_FALLBACK_WARNING =
  'Составить полное меню автоматически не удалось — показан подбор из каталога рецептов';

export function priceMaxAgeMs(): number {
  return PRICE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
}