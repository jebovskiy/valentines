import { randomUUID } from 'node:crypto';
import { MENU_ID_PREFIX, MENU_MAX_RECIPES } from './config';
import { buildShoppingList, priceRecipe } from './costing';
import { defaultProviders, type MenuProviders } from './providers';
import { computeRecipeNutrition, perServing } from './nutrition';
import { scaleForServings, servingsBreakdown } from './scaling';
import { getIngredient } from './fixtures';
import { ALLERGENS } from './allergens';
import type {
  AllergenId, CostedRecipe, MenuGenerationIssue, MenuRequest, MenuResult, RecipeChoice,
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
  priceMissingRecipes: number;
  staleMissing: number;
  totalRecipes: number;
}

const EPS = 1e-9;

/**
 * Deterministic menu planner (no LLM involved):
 *   1. weight servings by adults/children coefficients
 *   2. hard filters: confidence about allergens ∧ fully priced
 *   3. score remaining recipes (nutrition completeness, cost fit, data completeness)
 *   4. greedy pick up to MENU_MAX_RECIPES staying within the budget
 *   5. build a merged shopping list, rounded up to whole packages
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

  const recipes = await providers.recipes.getAllRecipes();
  const offers = await providers.prices.getOffers(request.storeId);
  const servings = servingsBreakdown(request.adults, request.children);
  const effectiveServings = servings.effectiveServings;

  const candidates: CostedRecipe[] = [];
  const counters: PlannerCounters = {
    allergenExcluded: 0,
    unknownAllergenCount: 0,
    priceMissingRecipes: 0,
    staleMissing: 0,
    totalRecipes: recipes.length,
  };

  for (const recipe of recipes) {
    const { scale, scaledIngredients, unknownIngredients } = scaleForServings(recipe, effectiveServings);

    // --- allergen safety ----------------------------------------------------
    const allergens = new Set<AllergenId>();
    for (const scaled of scaledIngredients) {
      const catalogue = getIngredient(scaled.ingredient.id);
      if (catalogue) {
        for (const a of catalogue.allergens) allergens.add(a);
      }
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
    };

    // --- scoring (used only for ranking already-safe fully-priced recipes) ---
    const nutritionScore = nutritionMissing ? 0 : 1;
    const costFit = pricing.cost > 0 ? Math.min(1, Math.max(0, request.budget / pricing.cost)) : 1;
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
  usable.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.choice.recipe.id < b.choice.recipe.id ? -1 : 1;
  });
  if (opts.randomize && usable.length > 1) {
    for (let i = usable.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [usable[i], usable[j]] = [usable[j], usable[i]];
    }
  }

  if (usable.length === 0) {
    if (recipes.length === 0) {
      return { code: 'empty_catalog', message: 'Каталог рецептов пуст' };
    }
    return { code: 'no_recipes', message: describeNoRecipes(counters, request) };
  }

  const minCost = Math.min(...usable.map((c) => c.choice.cost));
  if (minCost > request.budget + EPS) {
    return {
      code: 'budget_too_low',
      message: 'Бюджет слишком мал для самого дешёвого рецепта',
      minCost: Math.round(minCost * 100) / 100,
      budget: request.budget,
    };
  }

  // Greedy: always fits at least one (cheapest fits), then fills up to 4 and budget.
  const picked: RecipeChoice[] = [];
  let remaining = request.budget;
  for (const c of usable) {
    if (picked.length >= MENU_MAX_RECIPES) break;
    if (c.choice.cost <= remaining + EPS) {
      picked.push(c.choice);
      remaining -= c.choice.cost;
    }
  }

  const scaledInputs = picked.flatMap((p) =>
    p.scaledIngredients.map((si) => ({
      ingredient: si.ingredient,
      qty: si.qty,
      unit: si.unit,
    }))
  );
  const shoppingList = buildShoppingList(scaledInputs, offers, request.storeId, now);

  const totalCost = shoppingList.total;
  const remainingBudget = request.budget > totalCost ? round2Safe(request.budget - totalCost) : 0;
  const overspend = totalCost > request.budget ? round2Safe(totalCost - request.budget) : 0;
  const recipesCost = round2Safe(picked.reduce((s, p) => s + p.cost, 0));

  const warnings = buildWarnings(counters, providers, picked, totalCost);

  const result: MenuResult = {
    id: `${MENU_ID_PREFIX}-${randomUUID()}`,
    store,
    request,
    servings,
    recipes: picked,
    recipesCost,
    totalCost,
    shoppingList,
    budget: request.budget,
    remainingBudget,
    overspend,
    warnings,
    priceSourceLabel: providers.prices.sourceLabel,
    generatedAt: now.toISOString(),
  };
  return result;
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
  if (counters.priceMissingRecipes > 0) parts.push(`${counters.priceMissingRecipes} рецепт(ов) без цен в магазине`);
  if (counters.unknownAllergenCount > 0) parts.push(`${counters.unknownAllergenCount} ингредиент(ов) с неустановленной аллергенностью`);
  return parts.length ? parts.join('; ') : 'Нет подходящих рецептов';
}

function buildWarnings(
  counters: PlannerCounters,
  providers: MenuProviders,
  picked: RecipeChoice[],
  totalCost: number
): string[] {
  const warnings: string[] = [];
  if (providers.prices.isMock) {
    warnings.push('Демо-цены (не реальные): реальные каталоги магазинов пока не подключены');
  }
  if (counters.allergenExcluded > 0) {
    warnings.push(`${counters.allergenExcluded} рецепт(ов) исключено из подбора из-за аллергенов`);
  }
  if (counters.unknownAllergenCount > 0) {
    warnings.push(`${counters.unknownAllergenCount} ингредиент(ов) с неустановленной аллергенностью — рецепты с ними не рекомендуются автоматически`);
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
 * generated menu's recipes (the planner's own pick can be replaced).
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

  return {
    ...result,
    recipes: selected,
    recipesCost,
    totalCost,
    shoppingList,
    remainingBudget,
    overspend,
  };
}