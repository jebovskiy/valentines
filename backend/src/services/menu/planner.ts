import { randomUUID } from 'node:crypto';
import {
  MENU_GENERATION_ATTEMPTS,
  MENU_DAILY_MEALS,
  MENU_ID_PREFIX,
  MENU_MAX_RECIPE_REPEATS,
  MENU_MIN_BUDGET,
  MENU_WEEK_DAYS,
} from './config';
import { buildShoppingList, priceRecipe } from './costing';
import { describeCookware, inferCookware } from './cookware';
import { defaultProviders, type MenuProviders } from './providers';
import { computeRecipeNutrition, perServing } from './nutrition';
import { scaleForServings, servingsBreakdown } from './scaling';
import { getIngredient } from './fixtures';
import { ALLERGENS } from './allergens';
import { MEAL_TITLES } from './types';
import type {
  AllergenId, CostedRecipe, MealId, MenuDay, MenuGenerationIssue, MenuMeal, MenuRequest, MenuResult,
  ProductOffer, RecipeChoice, StoreId,
} from './types';

export interface GenerateMenuOptions {
  providers?: MenuProviders;
  now?: Date;
  /** Shuffle candidate order so repeated generations rarely return the same menu. */
  randomize?: boolean;
}

export interface PlannerCounters {
  allergenExcluded: number;
  unknownAllergenCount: number;
  customAllergenExcluded: number;
  dislikedExcluded: number;
  cookwareExcluded: number;
  priceMissingRecipes: number;
  staleMissing: number;
  totalRecipes: number;
}

const EPS = 1e-9;

/** Slot label like «Завтрак · День 3» used in failure diagnostics. */
export function slotLabel(meal: MealId, day: number): string {
  return `${MEAL_TITLES[meal]} · День ${day}`;
}

/**
 * Deterministic week menu planner (no LLM involved):
 *   1. weight servings by adults/children coefficients
 *   2. hard filters: allergens (curated + free-text) ∧ disliked ∧ cookware ∧ fully priced
 *   3. classify every recipe into breakfast / lunch / dinner
 *   4. greedy-fill 7 days × 3 meals with unique recipes (repeats as a last
 *      resort) so that the final shopping receipt (whole packages) NEVER
 *      exceeds the budget
 *   5. build a merged shopping list, rounded up to whole packages
 *
 * The budget is floored at MENU_MIN_BUDGET (40 BYN) — a menu is always
 * returned as long as at least one priced recipe exists; when the full 21
 * slots cannot fit, the best possible partial week is returned with a warning
 * instead of an error.
 */
export async function generateMenu(
  request: MenuRequest,
  opts: GenerateMenuOptions = {}
): Promise<MenuResult | MenuGenerationIssue> {
  const providers = opts.providers ?? defaultProviders();
  const now = opts.now ?? new Date();

  const store = (await providers.prices.getStores()).find((s) => s.id === request.storeId);
  if (!store) {
    return { code: 'invalid_store', message: 'Выбранный магазин не найден' };
  }

  const effectiveBudget = Math.max(MENU_MIN_BUDGET, request.budget);
  const recipes = await providers.recipes.getAllRecipes();
  const offers = await providers.prices.getOffers(request.storeId);
  const servings = servingsBreakdown(request.adults, request.children);
  const effectiveServings = servings.effectiveServings;

  const candidates: CostedRecipe[] = [];
  const counters: PlannerCounters = {
    allergenExcluded: 0,
    unknownAllergenCount: 0,
    customAllergenExcluded: 0,
    dislikedExcluded: 0,
    cookwareExcluded: 0,
    priceMissingRecipes: 0,
    staleMissing: 0,
    totalRecipes: recipes.length,
  };

  const customTerms = normalizeExclusions(request.customAllergens);
  const dislikedTerms = normalizeExclusions(request.disliked);

  for (const recipe of recipes) {
    const { scale, scaledIngredients, unknownIngredients } = scaleForServings(recipe, effectiveServings);

    // --- kitchen equipment ------------------------------------------------
    const explicitCookware = recipe.cookware ?? [];
    const cookware = [...new Set([...explicitCookware, ...inferCookware(recipe)])];

    // --- allergen safety ----------------------------------------------------
    const allergens = new Set<AllergenId>();
    const excludedTerms = { custom: [] as string[], disliked: [] as string[] };
    for (const scaled of scaledIngredients) {
      const catalogue = getIngredient(scaled.ingredient.id);
      if (catalogue) {
        for (const a of catalogue.allergens) allergens.add(a);
      }
      const nameLower = scaled.ingredient.name.toLowerCase();
      const hit = (terms: string[]): string | null => terms.find((t) => nameLower.includes(t)) ?? null;
      const customHit = hit(customTerms);
      if (customHit) excludedTerms.custom.push(`${scaled.ingredient.name} (${customHit})`);
      const dislikedHit = hit(dislikedTerms);
      if (dislikedHit) excludedTerms.disliked.push(`${scaled.ingredient.name} (${dislikedHit})`);
    }

    let rejected = false;
    let rejectedReason: string | undefined;
    const banned = request.allergens.filter((a) => allergens.has(a));
    if (banned.length > 0) {
      rejected = true;
      rejectedReason = `allergen:${banned.join(',')}`;
      counters.allergenExcluded += 1;
    } else if (unknownIngredients.length > 0) {
      // Ingredients whose allergenicity we cannot confidently determine are
      // never silently treated as safe — exclude from automatic suggestion.
      counters.unknownAllergenCount += unknownIngredients.length;
      rejected = true;
      rejectedReason = 'unknown_allergen';
    } else if (excludedTerms.custom.length > 0) {
      counters.customAllergenExcluded += 1;
      rejected = true;
      rejectedReason = `custom_allergen:${excludedTerms.custom.join(',')}`;
    } else if (excludedTerms.disliked.length > 0) {
      counters.dislikedExcluded += 1;
      rejected = true;
      rejectedReason = `disliked:${excludedTerms.disliked.join(',')}`;
    }

    // --- kitchen equipment filter -------------------------------------------
    if (
      !rejected &&
      request.cookware &&
      request.cookware.length > 0 &&
      cookware.length > 0 &&
      cookware.some((c) => !request.cookware!.includes(c))
    ) {
      counters.cookwareExcluded += 1;
      rejected = true;
      rejectedReason = `cookware:${cookware.join(',')}`;
    }

    // --- pricing -------------------------------------------------------------
    const pricing = priceRecipe(scaledIngredients, offers, request.storeId, effectiveServings, now);
    const fullyPriced = pricing.priceMissing.length === 0;
    counters.staleMissing += pricing.staleMissing;
    if (!rejected && !fullyPriced) {
      counters.priceMissingRecipes += 1;
      rejected = true;
      rejectedReason = 'price_missing';
    }

    // --- nutrition ----------------------------------------------------------
    const nutritionRes = await computeRecipeNutrition(scaledIngredients, providers.nutrition);
    const nutritionMissing = nutritionRes.missing.length > 0;

    const choice: RecipeChoice = {
      recipe,
      servings: effectiveServings,
      scale,
      scaledIngredients,
      cost: pricing.cost,
      costPerServing: pricing.costPerServing,
      priceMissing: pricing.priceMissing,
      nutrition: nutritionMissing
        ? null
        : { perRecipe: nutritionRes.perRecipe, perServing: perServing(nutritionRes.perRecipe, effectiveServings) },
      nutritionMissing,
      allergens: [...allergens].sort(),
      allergenUnknown: unknownIngredients.map((u) => u.name),
      cookwareLabels: describeCookware(cookware),
    };

    // --- scoring (used only for ranking already-safe fully-priced recipes) ---
    const nutritionScore = nutritionMissing ? 0 : 1;
    const costFit = pricing.cost > 0 ? Math.min(1, Math.max(0, effectiveBudget / pricing.cost)) : 1;
    const dataCompleteness =
      (recipe.steps && recipe.steps.length > 0 ? 0.5 : 0) + (recipe.timeMin != null ? 0.5 : 0);
    const score =
      0.45 * nutritionScore + 0.3 * costFit + 0.1 * dataCompleteness + (fullyPriced ? 0.15 : 0);

    candidates.push({
      choice,
      fullyPriced,
      score,
      rejectedReason,
    });
  }

  const usable = candidates.filter((c) => !c.rejectedReason && c.fullyPriced);
  if (usable.length === 0) {
    if (recipes.length === 0) {
      return { code: 'empty_catalog', message: 'Каталог рецептов пуст' };
    }
    return { code: 'no_recipes', message: describeNoRecipes(counters, request) };
  }

  // --- canned meals per day ------------------------------------------------
  const byMeal = new Map<MealId, RecipeChoice[]>();
  for (const meal of ['breakfast', 'lunch', 'dinner'] as MealId[]) byMeal.set(meal, []);
  for (const c of usable) {
    const meal = mealOfRecipe(c.choice.recipe);
    if (meal) byMeal.get(meal)!.push(c.choice);
  }
  for (const meal of byMeal.keys()) {
    byMeal.get(meal)!.sort((a, b) => a.cost - b.cost);
  }

  // --- greedy week fill ----------------------------------------------------
  const wantedSlots = MENU_WEEK_DAYS * MENU_DAILY_MEALS.length;

  let best: FilledAttempt | null = null;
  for (let attempt = 0; attempt < MENU_GENERATION_ATTEMPTS; attempt += 1) {
    const plan = fillWeek(byMeal, offers, request.storeId, now, effectiveBudget, opts.randomize ?? true);
    if (!best || plan.filledSlots > best.filledSlots || (plan.filledSlots === best.filledSlots && plan.totalCost < best.totalCost)) {
      best = plan;
    }
    if (plan.filledSlots === wantedSlots) break;
  }
  if (!best) {
    return { code: 'no_recipes', message: describeNoRecipes(counters, request) };
  }

  const meals = best.slots.flatMap((s) => s);
  const picked = meals.map((m) => m.recipe);
  const shoppingList = buildReceipt(meals.map((m) => m.recipe), offers, request.storeId, now);
  const totalCost = shoppingList.total;
  const remainingBudget = effectiveBudget > totalCost ? round2Safe(effectiveBudget - totalCost) : 0;
  const overspend = totalCost > effectiveBudget ? round2Safe(totalCost - effectiveBudget) : 0;
  const recipesCost = round2Safe(picked.reduce((s, p) => s + p.cost, 0));

  const days: MenuDay[] = [];
  for (let day = 1; day <= MENU_WEEK_DAYS; day += 1) {
    const dayMeals: MenuMeal[] = [];
    for (const meal of MENU_DAILY_MEALS) {
      const m = meals.find((s) => s.day === day && s.meal === meal);
      if (m) dayMeals.push({ meal, title: MEAL_TITLES[meal], recipe: m.recipe });
    }
    days.push({ day, meals: dayMeals });
  }

  const warnings = buildWarnings(counters, providers, picked, totalCost, correctnessWarnings(best, wantedSlots, effectiveBudget, request.budget));
  warnings.push(...repetitionWarnings(picked));

  const result: MenuResult = {
    id: `${MENU_ID_PREFIX}-${randomUUID()}`,
    store,
    request,
    servings,
    days,
    recipes: picked,
    recipesCost,
    totalCost,
    shoppingList,
    budget: round2Safe(effectiveBudget),
    remainingBudget,
    overspend,
    warnings,
    priceSourceLabel: providers.prices.sourceLabel,
    generatedAt: now.toISOString(),
  };
  return result;
}

/** User-facing notes about an imperfect week (clamped budget / missing slots). */
function correctnessWarnings(
  attempt: FilledAttempt,
  wantedSlots: number,
  effectiveBudget: number,
  requestedBudget: number
): string[] {
  const warnings: string[] = [];
  if (effectiveBudget > requestedBudget) {
    warnings.push(`Минимальный бюджет для подбора — ${MENU_MIN_BUDGET} BYN. Ваш (${requestedBudget} BYN) увеличен до ${MENU_MIN_BUDGET} BYN.`);
  }
  if (attempt.filledSlots === 0) {
    warnings.push(`Бюджета ${effectiveBudget} BYN не хватило даже на одно блюдо — увеличьте бюджет или упростите условия (аллергии, утварь).`);
  } else if (attempt.filledSlots < wantedSlots) {
    const missing = attempt.missingSlots.slice(0, 6).join(', ');
    warnings.push(
      `Бюджет ${effectiveBudget} BYN позволил подобрать ${attempt.filledSlots} из ${wantedSlots} приёмов пищи. Не удалось заполнить: ${missing}. Увеличьте бюджет или упростите условия.`
    );
  }
  return warnings;
}

/** Warns when the thin recipe pool forced a dish to repeat within the week. */
function repetitionWarnings(picked: RecipeChoice[]): string[] {
  const usage = new Map<string, number>();
  for (const p of picked) usage.set(p.recipe.id, (usage.get(p.recipe.id) ?? 0) + 1);
  const repeated = [...usage.entries()].filter(([, n]) => n > 1);
  if (repeated.length === 0) return [];
  return [
    `${repeated.length} блюдо(а) повторяются в течение недели — не хватило уникальных рецептов, подходящих под бюджет и условия.`,
  ];
}

interface FilledSlot {
  day: number;
  meal: MealId;
  recipe: RecipeChoice;
}

interface FilledAttempt {
  slots: FilledSlot[];
  filledSlots: number;
  totalCost: number;
  missingSlots: string[];
}

/**
 * Greedy fill: 7 days × 3 meals in day-major order. A meal slot keeps the
 * cheapest fitting recipe whose addition does NOT push the receipt above the
 * budget (the merged cart — whole packages — is recomputed on every trial, so
 * a shared staple like rice is bought once and feeds several dishes). Recipes
 * are unique by default; when the fully-priced pool is too thin, repeats are
 * allowed only as a last resort so a minimal-budget menu still assembles.
 */
function fillWeek(
  byMeal: Map<MealId, RecipeChoice[]>,
  offers: ProductOffer[],
  storeId: StoreId,
  now: Date,
  budget: number,
  randomize: boolean
): FilledAttempt {
  const pools = new Map<MealId, RecipeChoice[]>();
  for (const meal of byMeal.keys()) {
    const list = [...byMeal.get(meal)!];
    if (randomize) shuffle(list);
    const kept: RecipeChoice[] = [];
    // stabilise randomness: keep cheapest candidates up front, randomise the tail.
    const sorted = [...list].sort((a, b) => a.cost - b.cost);
    const core = sorted.slice(0, Math.max(2, Math.floor(sorted.length / 3)));
    const tail = sorted.slice(Math.max(2, Math.floor(sorted.length / 3)));
    if (randomize) shuffle(tail);
    kept.push(...core, ...tail);
    pools.set(meal, kept);
  }

  const usedCount = new Map<string, number>();
  const slots: FilledSlot[] = [];
  const missingSlots: string[] = [];
  const maxUses = MENU_MAX_RECIPE_REPEATS;

  for (let day = 1; day <= MENU_WEEK_DAYS; day += 1) {
    for (const meal of MENU_DAILY_MEALS) {
      const pool = pools.get(meal) ?? [];
      let chosen: RecipeChoice | null = null;

      // Pass 1: only not-yet-used recipes (keeps the default week unique).
      // Pass 2: allow repeats when the pool is too thin to fill the slot.
      for (const pass of [1, 2] as const) {
        if (chosen) break;
        for (const candidate of pool) {
          const used = usedCount.get(candidate.recipe.id) ?? 0;
          if (used > (pass === 1 ? 0 : maxUses - 1)) continue;
          const trialTotal = receiptTotal([...slots.map((s) => s.recipe), candidate], offers, storeId, now);
          if (trialTotal > budget + EPS) continue;
          chosen = candidate;
          break;
        }
      }

      if (!chosen) {
        missingSlots.push(slotLabel(meal, day));
        continue;
      }
      usedCount.set(chosen.recipe.id, (usedCount.get(chosen.recipe.id) ?? 0) + 1);
      slots.push({ day, meal, recipe: chosen });
    }
  }

  const finalReceipt = buildReceipt(slots.map((s) => s.recipe), offers, storeId, now);
  const totalCost = finalReceipt.total;

  return {
    slots,
    filledSlots: slots.length,
    totalCost,
    missingSlots,
  };
}

/** Builds the merged shopping list for a set of recipes. */
function buildReceipt(
  choices: RecipeChoice[],
  offers: Parameters<typeof buildShoppingList>[1],
  storeId: Parameters<typeof buildShoppingList>[2],
  now: Date
) {
  const inputs = choices.flatMap((p) =>
    p.scaledIngredients.map((si) => ({
      ingredient: si.ingredient,
      qty: si.qty,
      unit: si.unit,
    }))
  );
  return buildShoppingList(inputs, offers, storeId, now);
}

/** Total receipt for the given recipes (used to keep the week within budget). */
function receiptTotal(
  choices: RecipeChoice[],
  offers: Parameters<typeof buildShoppingList>[1],
  storeId: Parameters<typeof buildShoppingList>[2],
  now: Date
): number {
  return buildReceipt(choices, offers, storeId, now).total;
}

/** Maps a recipe to the meal slot it can fill (or null for desserts/drinks). */
export function mealOfRecipe(recipe: { category: string; name: string }): MealId | null {
  const cat = recipe.category.trim().toLowerCase();
  const name = recipe.name.toLowerCase();
  const breakfastKw = /каш|овсян|омлет|блин|сырник|тост|яичниц|йогурт|творог/;
  const lunchKw = /суп|борщ|уха|бульон|солянк|рассольник|щи|салат/;
  if (cat.includes('завтрак')) return 'breakfast';
  if (cat.includes('суп')) return 'lunch';
  if (cat.includes('салат')) return 'lunch';
  if (cat.includes('десерт') || cat.includes('напит')) return null;
  if (cat.includes('основн')) return 'dinner';
  // Imported recipes use the generic «Рецепты» category — classify by name.
  if (breakfastKw.test(name)) return 'breakfast';
  if (lunchKw.test(name)) return 'lunch';
  return 'dinner';
}

function normalizeExclusions(terms?: string[]): string[] {
  if (!terms) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of terms) {
    const t = raw.trim().toLowerCase();
    if (t.length < 2) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function shuffle<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function round2Safe(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Count of distinct ingredients with unknown allergenicity across all recipes. */
function describeNoRecipes(counters: PlannerCounters, request: MenuRequest): string {
  const parts: string[] = [];
  const banned = request.allergens
    .map((id) => ALLERGENS.find((a) => a.id === id)?.title ?? id)
    .join(', ');
  if (counters.allergenExcluded > 0) parts.push(`${counters.allergenExcluded} рецепт(ов) исключено из-за аллергенов (${banned})`);
  if (counters.customAllergenExcluded > 0) parts.push(`${counters.customAllergenExcluded} рецепт(ов) исключено из-за указанных вами аллергий`);
  if (counters.dislikedExcluded > 0) parts.push(`${counters.dislikedExcluded} рецепт(ов) исключено из-за нелюбимых продуктов`);
  if (counters.cookwareExcluded > 0) parts.push(`${counters.cookwareExcluded} рецепт(ов) исключено по кухонной утвари`);
  if (counters.priceMissingRecipes > 0) parts.push(`${counters.priceMissingRecipes} рецепт(ов) без цен в магазине`);
  if (counters.unknownAllergenCount > 0) parts.push(`${counters.unknownAllergenCount} ингредиент(ов) с неустановленной аллергенностью`);
  return parts.length ? parts.join('; ') : 'Нет подходящих рецептов';
}

function buildWarnings(
  counters: PlannerCounters,
  providers: MenuProviders,
  picked: RecipeChoice[],
  totalCost: number,
  extra?: string[]
): string[] {
  const warnings: string[] = [];
  if (extra) warnings.push(...extra);
  if (providers.prices.isMock) {
    warnings.push('Демо-цены (не реальные): реальные каталоги магазинов пока не подключены');
  }
  if (counters.allergenExcluded > 0) {
    warnings.push(`${counters.allergenExcluded} рецепт(ов) исключено из подбора из-за аллергенов`);
  }
  if (counters.customAllergenExcluded > 0) {
    warnings.push(`${counters.customAllergenExcluded} рецепт(ов) исключено из-за указанных вами аллергий`);
  }
  if (counters.dislikedExcluded > 0) {
    warnings.push(`${counters.dislikedExcluded} рецепт(ов) исключено — содержит нелюбимые продукты`);
  }
  if (counters.unknownAllergenCount > 0) {
    warnings.push(`${counters.unknownAllergenCount} ингредиент(ов) с неустановленной аллергенностью — рецепты с ними не рекомендуются автоматически`);
  }
  if (counters.cookwareExcluded > 0) {
    warnings.push(`${counters.cookwareExcluded} рецепт(ов) исключено: для них нужна кухонная утварь, которой у вас нет`);
  }
  if (counters.priceMissingRecipes > 0) {
    warnings.push(`${counters.priceMissingRecipes} рецепт(ов) не имели актуальных цен в выбранном магазине`);
  }
  if (counters.staleMissing > 0) {
    warnings.push(`${counters.staleMissing} случаев устаревших цен (учтены как недоступные)`);
  }
  if (picked.length > 0 && totalCost > picked.reduce((s, p) => s + p.cost, 0)) {
    warnings.push('Итог по чеку выше суммы рецептов: покупка считается целыми упаковками');
  }
  return warnings;
}

export function recipeIds(result: MenuResult): string[] {
  return result.recipes.map((r) => r.recipe.id);
}

/**
 * Rebuilds the shopping list and totals for a user-chosen subset of the
 * generated week's recipes (the planner's own pick can be replaced).
 * Prices are re-fetched from the store so the totals stay current.
 */
export async function rebuildMenuForSelection(
  result: MenuResult,
  selectedRecipeIds: string[],
  opts: GenerateMenuOptions = {}
): Promise<MenuResult> {
  const providers = opts.providers ?? defaultProviders();
  const now = opts.now ?? new Date();

  const selected = result.recipes.filter((r) => selectedRecipeIds.includes(r.recipe.id));
  const inputs = selected.flatMap((p) =>
    p.scaledIngredients.map((si) => ({
      ingredient: si.ingredient,
      qty: si.qty,
      unit: si.unit,
    }))
  );
  const offers = await providers.prices.getOffers(result.request.storeId);
  const shoppingList = buildShoppingList(inputs, offers, result.request.storeId, now);

  const totalCost = shoppingList.total;
  const remainingBudget = result.budget > totalCost ? round2Safe(result.budget - totalCost) : 0;
  const overspend = totalCost > result.budget ? round2Safe(totalCost - result.budget) : 0;
  const recipesCost = round2Safe(selected.reduce((s, p) => s + p.cost, 0));

  const days: MenuDay[] = [];
  for (let day = 1; day <= MENU_WEEK_DAYS; day += 1) {
    const dayMeals: MenuMeal[] = [];
    for (const meal of MENU_DAILY_MEALS) {
      const choice = selected.find((r) => r.recipe.id === result.days
        .find((d) => d.day === day)
        ?.meals.find((m) => m.meal === meal)?.recipe.recipe.id);
      if (choice) dayMeals.push({ meal, title: MEAL_TITLES[meal], recipe: choice });
    }
    if (dayMeals.length > 0) days.push({ day, meals: dayMeals });
  }

  return {
    ...result,
    days,
    recipes: selected,
    recipesCost,
    totalCost,
    shoppingList,
    remainingBudget,
    overspend,
  };
}