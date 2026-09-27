import { randomUUID } from 'node:crypto';
import {
  MENU_GENERATION_ATTEMPTS,
  MENU_DAILY_MEALS,
  MENU_ID_PREFIX,
  MENU_MAX_RECIPE_REPEATS,
  MENU_MAX_UNPRICED_INGREDIENTS,
  MENU_WEEK_DAYS,
  minBudgetFor,
} from './config';
import { SERVING_COEFFICIENTS } from './config';
import { buildShoppingList, priceRecipe, type ExistingStock } from './costing';
import { describeCookware, inferCookware } from './cookware';
import { defaultProviders, type MenuProviders } from './providers';
import { computeRecipeNutrition, per100g, perServing } from './nutrition';
import { maxMealServings, mealServings, scaleForServings, servingsBreakdown } from './scaling';
import { getIngredient } from './fixtures';
import { ALLERGENS } from './allergens';
import { MEAL_COMPONENT_TITLES, MEAL_TITLES } from './types';
import type {
  AllergenId, MealComponentId, MealId, MenuDay, MenuGenerationIssue, MenuMeal, MenuRequest,
  MenuResult, MenuServings, ProductOffer, Recipe, RecipeChoice, StoreId,
} from './types';

export interface GenerateMenuOptions {
  providers?: MenuProviders;
  now?: Date;
  /** Shuffle candidate order so repeated generations rarely return the same menu. */
  randomize?: boolean;
  /** Ingredients already at home to deduct from the shopping list. */
  existingStock?: ExistingStock[];
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

/** Warn user once when picked recipes contain ingredients without a live price. */
function unpricedIngredientsWarning(picked: RecipeChoice[]): string | null {
  const names = new Set<string>();
  for (const p of picked) for (const m of p.priceMissing) names.add(m.name);
  if (names.size === 0) return null;
  const list = [...names].slice(0, 6).join(', ');
  return `Цены нет для: ${list}. Эти блюда оставлены, но их стоимость и БЖУ приблизительны — эти продукты не входят в чек.`;
}

/** Slot label like «Завтрак · День 3» used in failure diagnostics. */
export function slotLabel(meal: MealId, day: number): string {
  return `${MEAL_TITLES[meal]} · День ${day}`;
}

/** Component label of a dish inside a meal (breakfast's single dish reads «Блюдо»). */
function componentTitle(meal: MealId, role: MealComponentId): string {
  if (meal === 'breakfast' && role === 'main') return 'Блюдо';
  return MEAL_COMPONENT_TITLES[role];
}

/** The roles a given meal is built from (single «main» when components are off). */
export function rolesForMeal(request: MenuRequest, meal: MealId, perMeal: Record<MealId, number>): MealComponentId[] {
  if (meal === 'breakfast') return perMeal.breakfast > 0 ? ['main'] : [];
  if (perMeal[meal] <= 0) return [];
  const comps = request.mealComponents;
  const selected = meal === 'lunch' || meal === 'dinner' ? comps?.[meal] ?? [] : [];
  if (selected.length > 0) return selected;
  return ['main'];
}

/**
 * Classifies a recipe into the role it plays inside a multi-dish lunch/dinner
 * (soup / main / side / salad / dessert). Breakfast recipes — via the category
 * or «каша/омлет…» names — are intentionally NOT classified here; they only
 * fill the breakfast slot.
 */
export function roleOfRecipe(recipe: { category: string; name: string }): MealComponentId | null {
  const cat = (recipe.category ?? '').trim().toLowerCase();
  const name = (recipe.name ?? '').trim().toLowerCase();
  if (cat.includes('суп')) return 'soup';
  if (cat.includes('салат')) return 'salad';
  if (cat.includes('гарнир')) return 'side';
  if (cat.includes('десерт')) return 'dessert';
  if (/суп|борщ|уха|бульон|солянк|рассольник|щи\b/.test(name)) return 'soup';
  if (/салат|винегрет/.test(name)) return 'salad';
  if (/десерт|печёны|печены|запеканк|мусс|кекс|пудинг|желе|компот/.test(name)) return 'dessert';
  if (
    /^отварн/.test(name) ||
    /^рассыпчат/.test(name) ||
    /^варён/.test(name) ||
    / пюре$/.test(name) ||
    /^рис\b/.test(name) ||
    /^гречк/.test(name) ||
    /^макарон/.test(name) ||
    /^паста$/.test(name) ||
    /^картофель/.test(name)
  ) {
    return 'side';
  }
  if (cat.includes('основн') || cat.includes('рецепт')) return 'main';
  return null;
}

/** (meal × role) buckets a recipe may fill, given the component selection. */
function mealAssignments(
  recipe: { category: string; name: string },
  request: MenuRequest,
  lunchRoles: MealComponentId[],
  dinnerRoles: MealComponentId[]
): { meal: MealId; role: MealComponentId }[] {
  const breakfast = mealOfRecipe(recipe);
  const out: { meal: MealId; role: MealComponentId }[] = [];
  if (breakfast === 'breakfast') {
    out.push({ meal: 'breakfast', role: 'main' });
    return out;
  }
  const role = roleOfRecipe(recipe);
  const compMeal = (meal: MealId, roles: MealComponentId[], componentsOn: boolean): void => {
    if (!componentsOn) {
      if (mealOfRecipe(recipe) === meal) out.push({ meal, role: 'main' });
      return;
    }
    if (role && roles.includes(role)) out.push({ meal, role });
  };
  compMeal('lunch', lunchRoles, !!request.mealComponents && request.mealComponents.lunch.length > 0);
  compMeal('dinner', dinnerRoles, !!request.mealComponents && request.mealComponents.dinner.length > 0);
  return out;
}

/**
 * Deterministic week menu planner (no LLM involved):
 *   1. weight servings by members (per-member meal attendance + qty)
 *   2. hard filters: allergens (curated + free-text) ∧ disliked ∧ cookware ∧ fully priced
 *   3. classify every recipe into breakfast / lunch-role / dinner-role
 *   4. greedy-fill 7 days × (breakfast + selected lunch/dinner components) with
 *      unique recipes (repeats as a last resort) so the final shopping receipt
 *      (whole packages) NEVER exceeds the budget
 *   5. build a merged shopping list, rounded up to whole packages
 *
 * The budget is floored at minBudgetFor(effectiveServings, dishesPerDay) — a
 * menu is always returned as long as at least one priced recipe exists; when
 * the full week cannot fit, the best possible partial week is returned with a
 * warning instead of an error.
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

  const perMeal = mealServings(request);
  const effectiveServings = maxMealServings(perMeal);
  const lunchRoles = rolesForMeal(request, 'lunch', perMeal);
  const dinnerRoles = rolesForMeal(request, 'dinner', perMeal);
  const dishesPerDay =
    (perMeal.breakfast > 0 ? 1 : 0) +
    lunchRoles.length +
    dinnerRoles.length;
  const effectiveBudget = Math.max(minBudgetFor(effectiveServings, dishesPerDay), request.budget);
  const recipes = await providers.recipes.getAllRecipes();
  const offers = await providers.prices.getOffers(request.storeId);

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

  // --- bucket candidates per meal × role ------------------------------------
  const buckets = new Map<string, RecipeChoice[]>();
  const bucketKey = (meal: MealId, role: MealComponentId) => `${meal}:${role}`;
  for (const meal of MENU_DAILY_MEALS) {
    for (const role of rolesForMeal(request, meal, perMeal)) buckets.set(bucketKey(meal, role), []);
  }

  for (const recipe of recipes) {
    for (const { meal, role } of mealAssignments(recipe, request, lunchRoles, dinnerRoles)) {
      const servings = perMeal[meal];
      if (servings <= 0) continue;
      const { scale, scaledIngredients, unknownIngredients } = scaleForServings(recipe, servings);

      const { rejected, rejectedReason, allergens } = filterRecipe(
        recipe, scaledIngredients, unknownIngredients, request, customTerms, dislikedTerms, counters
      );
      if (rejected) continue;

      const basePricing = priceRecipe(scaledIngredients, offers, request.storeId, servings, now);
      const hasPricedBase = scaledIngredients.length - basePricing.priceMissing.length > 0;
      if (basePricing.priceMissing.length > MENU_MAX_UNPRICED_INGREDIENTS || !hasPricedBase) {
        counters.priceMissingRecipes += 1;
        counters.staleMissing += basePricing.staleMissing;
        continue;
      }

      const choice = await toRecipeChoice(
        recipe, scaledIngredients, scale, servings, offers, request.storeId, now, providers
      );
      const key = bucketKey(meal, role);
      (buckets.get(key) ?? buckets.set(key, []).get(key)!).push(choice);
    }
  }

  for (const list of buckets.values()) list.sort((a, b) => a.cost - b.cost);

  const usable = [...buckets.values()].some((l) => l.length > 0);
  if (!usable || recipes.length === 0) {
    if (recipes.length === 0) {
      return { code: 'empty_catalog', message: 'Каталог рецептов пуст' };
    }
    return { code: 'no_recipes', message: describeNoRecipes(counters, request) };
  }

  // --- greedy week fill ------------------------------------------------------
  const wantedSlots = 7 * dishesPerDay;

  let best: FilledAttempt | null = null;
  for (let attempt = 0; attempt < MENU_GENERATION_ATTEMPTS; attempt += 1) {
    const plan = fillWeek(buckets, request, perMeal, offers, request.storeId, now, effectiveBudget, opts.randomize ?? true, opts.existingStock);
    if (!best || plan.filledSlots > best.filledSlots || (plan.filledSlots === best.filledSlots && plan.totalCost < best.totalCost)) {
      best = plan;
    }
    if (plan.filledSlots === wantedSlots) break;
  }
  if (!best || best.filledSlots === 0) {
    return { code: 'no_recipes', message: describeNoRecipes(counters, request) };
  }

  const meals = best.slots.flatMap((s) => s);
  const picked = meals.map((m) => m.recipe);
  const shoppingList = buildReceipt(meals.map((m) => m.recipe), offers, request.storeId, now, opts.existingStock);
  const totalCost = shoppingList.total;
  const remainingBudget = request.budget > totalCost ? round2Safe(request.budget - totalCost) : 0;
  const overspend = totalCost > request.budget ? round2Safe(totalCost - request.budget) : 0;
  const recipesCost = round2Safe(picked.reduce((s, p) => s + p.cost, 0));

  const days: MenuDay[] = buildDays(best.slots);

  const warnings = buildWarnings(counters, providers, picked, totalCost, correctnessWarnings(best, wantedSlots, effectiveBudget, request.budget));
  warnings.push(...repetitionWarnings(picked));
  const unpricedNote = unpricedIngredientsWarning(picked);
  if (unpricedNote) warnings.push(unpricedNote);

  const servings = makeMenuServings(request, perMeal);

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
    budget: round2Safe(request.budget),
    remainingBudget,
    overspend,
    warnings,
    priceSourceLabel: providers.prices.sourceLabel,
    generatedAt: now.toISOString(),
  };
  return result;
}

export function makeMenuServings(request: MenuRequest, perMeal: Record<MealId, number>): MenuServings {
  const legacy = servingsBreakdown(request.adults, request.children);
  return {
    adults: legacy.adults,
    children: legacy.children,
    adultCoefficient: SERVING_COEFFICIENTS.adult,
    childCoefficient: SERVING_COEFFICIENTS.child,
    effectiveServings: maxMealServings(perMeal),
    perMeal,
    members: request.members ?? [],
  };
}

/** Assembles a week's days from the filled slots, per meal × component. */
function buildDays(slots: FilledSlot[]): MenuDay[] {
  const days: MenuDay[] = [];
  for (let day = 1; day <= MENU_WEEK_DAYS; day += 1) {
    const dayMeals: MenuMeal[] = [];
    for (const meal of MENU_DAILY_MEALS) {
      const comps = slots.filter((s) => s.day === day && s.meal === meal);
      if (comps.length === 0) continue;
      dayMeals.push({
        meal,
        title: MEAL_TITLES[meal],
        components: comps.map((s) => ({ role: s.role, title: componentTitle(meal, s.role), recipe: s.recipe })),
      });
    }
    if (dayMeals.length === 0) continue;
    days.push({ day, meals: dayMeals });
  }
  return days;
}

/** Shared exclusion + safety filter; mutates counters. */
function filterRecipe(
  recipe: Recipe,
  scaledIngredients: RecipeChoice['scaledIngredients'],
  unknownIngredients: { id: string; name: string }[],
  request: MenuRequest,
  customTerms: string[],
  dislikedTerms: string[],
  counters: PlannerCounters
): { rejected: boolean; rejectedReason?: string; allergens: Set<AllergenId> } {
  const explicitCookware = recipe.cookware ?? [];
  const cookware = [...new Set([...explicitCookware, ...inferCookware(recipe)])];

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
  const recipeNameLower = recipe.name.toLowerCase();
  const nameCustomHit = customTerms.find((t) => recipeNameLower.includes(t)) ?? null;
  if (nameCustomHit && excludedTerms.custom.length === 0) {
    excludedTerms.custom.push(`название блюда «${recipe.name}» (${nameCustomHit})`);
  }
  const nameDislikedHit = dislikedTerms.find((t) => recipeNameLower.includes(t)) ?? null;
  if (nameDislikedHit && excludedTerms.disliked.length === 0) {
    excludedTerms.disliked.push(`название блюда «${recipe.name}» (${nameDislikedHit})`);
  }

  const banned = request.allergens.filter((a) => allergens.has(a));
  if (banned.length > 0) {
    counters.allergenExcluded += 1;
    return { rejected: true, rejectedReason: `allergen:${banned.join(',')}`, allergens };
  }
  if (unknownIngredients.length > 0) {
    counters.unknownAllergenCount += unknownIngredients.length;
    return { rejected: true, rejectedReason: 'unknown_allergen', allergens };
  }
  if (excludedTerms.custom.length > 0) {
    counters.customAllergenExcluded += 1;
    return { rejected: true, rejectedReason: `custom_allergen:${excludedTerms.custom.join(',')}`, allergens };
  }
  if (excludedTerms.disliked.length > 0) {
    counters.dislikedExcluded += 1;
    return { rejected: true, rejectedReason: `disliked:${excludedTerms.disliked.join(',')}`, allergens };
  }
  if (
    request.cookware &&
    request.cookware.length > 0 &&
    cookware.length > 0 &&
    cookware.some((c) => !request.cookware!.includes(c))
  ) {
    counters.cookwareExcluded += 1;
    return { rejected: true, rejectedReason: `cookware:${cookware.join(',')}`, allergens };
  }
  return { rejected: false, allergens };
}

/** Prices + nutrition for a scaled recipe, then wraps it into a RecipeChoice. */
async function toRecipeChoice(
  recipe: Recipe,
  scaledIngredients: RecipeChoice['scaledIngredients'],
  scale: number,
  servings: number,
  offers: ProductOffer[],
  storeId: StoreId,
  now: Date,
  providers: MenuProviders,
  fullyPricedOverride?: boolean
): Promise<RecipeChoice> {
  const requiredCookware = [...new Set([...(recipe.cookware ?? []), ...inferCookware(recipe)])];
  const pricing = priceRecipe(scaledIngredients, offers, storeId, servings, now);
  const nutritionRes = await computeRecipeNutrition(scaledIngredients, providers.nutrition);
  const nutritionMissing = nutritionRes.missing.length > 0;
  const p100g = nutritionMissing ? null : per100g(nutritionRes.perRecipe, scaledIngredients);
  return {
    recipe,
    servings,
    scale,
    scaledIngredients,
    cost: pricing.cost,
    costPerServing: pricing.costPerServing,
    priceMissing: pricing.priceMissing,
    nutrition: nutritionMissing
      ? null
      : {
          perRecipe: nutritionRes.perRecipe,
          perServing: perServing(nutritionRes.perRecipe, servings),
          ...(p100g ? { per100g: p100g } : {}),
        },
    nutritionMissing,
    allergens: [],
    allergenUnknown: [],
    cookwareLabels: describeCookware(requiredCookware),
  };
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
    warnings.push(`Минимальный бюджет для подбора при вашем составе семьи — ${effectiveBudget} BYN. Подбор вёлся по нему, а в отчёте показан ваш бюджет ${requestedBudget} BYN — чек может превысить его.`);
  }
  if (attempt.filledSlots === 0) {
    warnings.push(`Бюджета ${effectiveBudget} BYN не хватило даже на одно блюдо — увеличьте бюджет или упростите условия (аллергии, утварь).`);
  } else if (attempt.filledSlots < wantedSlots) {
    const missing = attempt.missingSlots.slice(0, 8).join(', ');
    warnings.push(
      `Бюджет ${effectiveBudget} BYN позволил подобрать ${attempt.filledSlots} из ${wantedSlots} блюд недели. Не удалось заполнить: ${missing}. Увеличьте бюджет или упростите условия.`
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
  role: MealComponentId;
  recipe: RecipeChoice;
}

interface FilledAttempt {
  slots: FilledSlot[];
  filledSlots: number;
  totalCost: number;
  missingSlots: string[];
}

/**
 * Greedy fill: 7 days × (breakfast + chosen components) in day-major order.
 * A dish is kept when its addition does NOT push the receipt above the budget
 * (the merged cart — whole packages — is recomputed on every trial, so a shared
 * staple like rice is bought once and feeds several dishes). Recipes are unique
 * by default; when a pool is too thin, repeats are allowed only as a last
 * resort so a minimal-budget menu still assembles.
 */
function fillWeek(
  buckets: Map<string, RecipeChoice[]>,
  request: MenuRequest,
  perMeal: Record<MealId, number>,
  offers: ProductOffer[],
  storeId: StoreId,
  now: Date,
  budget: number,
  randomize: boolean,
  existingStock: ExistingStock[] = []
): FilledAttempt {
  const pools = new Map<string, RecipeChoice[]>();
  for (const [key, list] of buckets) {
    const kept = [...list];
    if (randomize) shuffle(kept);
    const sorted = [...list].sort((a, b) => a.cost - b.cost);
    const core = sorted.slice(0, Math.max(2, Math.floor(sorted.length / 3)));
    const tail = sorted.slice(Math.max(2, Math.floor(sorted.length / 3)));
    if (randomize) shuffle(tail);
    pools.set(key, [...core, ...tail]);
  }

  const usedCount = new Map<string, number>();
  const slots: FilledSlot[] = [];
  const missingSlots: string[] = [];
  const maxUses = MENU_MAX_RECIPE_REPEATS;

  const rolesByMeal: Record<MealId, MealComponentId[]> = {
    breakfast: perMeal.breakfast > 0 ? ['main'] : [],
    lunch: rolesForMeal(request, 'lunch', perMeal),
    dinner: rolesForMeal(request, 'dinner', perMeal),
  };

  for (let day = 1; day <= MENU_WEEK_DAYS; day += 1) {
    for (const meal of MENU_DAILY_MEALS) {
      for (const role of rolesByMeal[meal]) {
        const pool = pools.get(`${meal}:${role}`) ?? [];
        let chosen: RecipeChoice | null = null;

        for (const pass of [1, 2] as const) {
          if (chosen) break;
          for (const candidate of pool) {
            const used = usedCount.get(candidate.recipe.id) ?? 0;
            if (used > (pass === 1 ? 0 : maxUses - 1)) continue;
            const trialTotal = receiptTotal([...slots.map((s) => s.recipe), candidate], offers, storeId, now, existingStock);
            if (trialTotal > budget + EPS) continue;
            chosen = candidate;
            break;
          }
        }

        if (!chosen) {
          missingSlots.push(`${slotLabel(meal, day)} · ${componentTitle(meal, role)}`);
          continue;
        }
        usedCount.set(chosen.recipe.id, (usedCount.get(chosen.recipe.id) ?? 0) + 1);
        slots.push({ day, meal, role, recipe: chosen });
      }
    }
  }

  const finalReceipt = buildReceipt(slots.map((s) => s.recipe), offers, storeId, now, existingStock);
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
  now: Date,
  existingStock: ExistingStock[] = []
) {
  const inputs = choices.flatMap((p) =>
    p.scaledIngredients.map((si) => ({
      ingredient: si.ingredient,
      qty: si.qty,
      unit: si.unit,
    }))
  );
  return buildShoppingList(inputs, offers, storeId, now, existingStock);
}

/** Total receipt for the given recipes (used to keep the week within budget). */
function receiptTotal(
  choices: RecipeChoice[],
  offers: Parameters<typeof buildShoppingList>[1],
  storeId: Parameters<typeof buildShoppingList>[2],
  now: Date,
  existingStock: ExistingStock[] = []
): number {
  return buildReceipt(choices, offers, storeId, now, existingStock).total;
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
 * generated week's recipes (the planner's own pick can be replaced). The meal
 * days keep only the components whose recipes stayed selected.
 */
export async function rebuildMenuForSelection(
  result: MenuResult,
  selectedRecipeIds: string[],
  opts: GenerateMenuOptions = {}
): Promise<MenuResult> {
  const providers = opts.providers ?? defaultProviders();
  const now = opts.now ?? new Date();

  const selected = new Set(selectedRecipeIds);
  const chosen: RecipeChoice[] = [];

  const days: MenuDay[] = [];
  for (const day of result.days ?? []) {
    const dayMeals: MenuMeal[] = [];
    for (const meal of day.meals ?? []) {
      const components = (meal.components ?? []).filter((c) => selected.has(c.recipe.recipe.id));
      if (components.length === 0) continue;
      dayMeals.push({ meal: meal.meal, title: meal.title, components });
      for (const c of components) chosen.push(c.recipe);
    }
    if (dayMeals.length > 0) days.push({ day: day.day, meals: dayMeals });
  }

  const inputs = chosen.flatMap((p) =>
    p.scaledIngredients.map((si) => ({
      ingredient: si.ingredient,
      qty: si.qty,
      unit: si.unit,
    }))
  );
  const offers = await providers.prices.getOffers(result.request.storeId);
  const shoppingList = buildShoppingList(inputs, offers, result.request.storeId, now, opts.existingStock);

  const totalCost = shoppingList.total;
  const remainingBudget = result.budget > totalCost ? round2Safe(result.budget - totalCost) : 0;
  const overspend = totalCost > result.budget ? round2Safe(totalCost - result.budget) : 0;
  const recipesCost = round2Safe(chosen.reduce((s, p) => s + p.cost, 0));

  return {
    ...result,
    days,
    recipes: chosen,
    recipesCost,
    totalCost,
    shoppingList,
    remainingBudget,
    overspend,
  };
}

/** One meal component slot to swap out for a recipe that fits the menu's constraints. */
export interface SlotReplacement {
  day: number;
  meal: MealId;
  role: MealComponentId;
  recipeId: string;
}

/** A candidate dish shown for a meal component slot (user picks one to replace). */
export interface SlotVariant {
  recipeId: string;
  name: string;
  category: string;
  role: MealComponentId;
  cost: number;
  costPerServing: number;
  servings: number;
  timeMin: number | null;
  priceMissing: boolean;
  kcalPerServing: number | null;
}

/**
 * Candidate dishes that fit the menu's constraints (allergens, disliked,
 * cookware, pricing) for one meal component slot, cheapest first. The current
 * dish of the slot is excluded so the user can only swap to something different.
 */
export async function listSlotVariants(
  menu: MenuResult,
  meal: MealId,
  role: MealComponentId,
  currentRecipeId: string,
  opts: GenerateMenuOptions = {}
): Promise<SlotVariant[]> {
  const providers = opts.providers ?? defaultProviders();
  const now = opts.now ?? new Date();
  const request = menu.request;

  const perMeal = mealServings(request);
  const lunchRoles = rolesForMeal(request, 'lunch', perMeal);
  const dinnerRoles = rolesForMeal(request, 'dinner', perMeal);
  const recipes = await providers.recipes.getAllRecipes();
  const offers = await providers.prices.getOffers(request.storeId);

  const customTerms = normalizeExclusions(request.customAllergens);
  const dislikedTerms = normalizeExclusions(request.disliked);

  const variants: SlotVariant[] = [];
  for (const recipe of recipes) {
    if (recipe.id === currentRecipeId) continue;
    const assignments = mealAssignments(recipe, request, lunchRoles, dinnerRoles);
    if (!assignments.some((a) => a.meal === meal && a.role === role)) continue;

    const servings = perMeal[meal];
    const { scaledIngredients, unknownIngredients } = scaleForServings(recipe, servings);

    const { rejected, allergens } = filterRecipe(
      recipe, scaledIngredients, unknownIngredients, request, customTerms, dislikedTerms,
      { allergenExcluded: 0, unknownAllergenCount: 0, customAllergenExcluded: 0, dislikedExcluded: 0, cookwareExcluded: 0, priceMissingRecipes: 0, staleMissing: 0, totalRecipes: 0 }
    );
    if (rejected) continue;

    const pricing = priceRecipe(scaledIngredients, offers, request.storeId, servings, now);
    const hasPricedBase = scaledIngredients.length - pricing.priceMissing.length > 0;
    const pricedEnough = pricing.priceMissing.length <= MENU_MAX_UNPRICED_INGREDIENTS && hasPricedBase;
    if (!pricedEnough) continue;

    const nutritionRes = await computeRecipeNutrition(scaledIngredients, providers.nutrition);
    variants.push({
      recipeId: recipe.id,
      name: recipe.name,
      category: recipe.category ?? '',
      role,
      cost: round2Safe(pricing.cost),
      costPerServing: pricing.costPerServing,
      servings,
      timeMin: recipe.timeMin ?? null,
      priceMissing: pricing.priceMissing.length > 0,
      kcalPerServing: nutritionRes.missing.length > 0
        ? null
        : Math.round(perServing(nutritionRes.perRecipe, servings).calories),
    });
    if (variants.length >= 30) break;
  }

  variants.sort((a, b) => a.cost - b.cost);
  return variants;
}

/**
 * Swaps one or more meal component slots of a saved menu for other recipes and
 * rebuilds totals and the shopping list. Returns null when a requested recipe
 * is unknown or does not fit the slot.
 */
export async function replaceMenuSlots(
  menu: MenuResult,
  replacements: SlotReplacement[],
  opts: GenerateMenuOptions = {}
): Promise<MenuResult | null> {
  const providers = opts.providers ?? defaultProviders();
  const now = opts.now ?? new Date();
  const request = menu.request;

  const perMeal = mealServings(request);
  const lunchRoles = rolesForMeal(request, 'lunch', perMeal);
  const dinnerRoles = rolesForMeal(request, 'dinner', perMeal);
  const recipes = await providers.recipes.getAllRecipes();
  const offers = await providers.prices.getOffers(request.storeId);

  const byId = new Map(recipes.map((r) => [r.id, r]));
  const chosenBySlot = new Map<string, RecipeChoice>();
  for (const rep of replacements) {
    const recipe = byId.get(rep.recipeId);
    if (!recipe) return null;
    const assignments = mealAssignments(recipe, request, lunchRoles, dinnerRoles);
    if (!assignments.some((a) => a.meal === rep.meal && a.role === rep.role)) return null;
    const { scale, scaledIngredients, unknownIngredients } = scaleForServings(recipe, perMeal[rep.meal]);
    const customTerms = normalizeExclusions(request.customAllergens);
    const dislikedTerms = normalizeExclusions(request.disliked);
    const { rejected } = filterRecipe(
      recipe, scaledIngredients, unknownIngredients, request, customTerms, dislikedTerms,
      { allergenExcluded: 0, unknownAllergenCount: 0, customAllergenExcluded: 0, dislikedExcluded: 0, cookwareExcluded: 0, priceMissingRecipes: 0, staleMissing: 0, totalRecipes: 0 }
    );
    if (rejected) return null;
    chosenBySlot.set(`${rep.day}:${rep.meal}:${rep.role}`, await toRecipeChoice(recipe, scaledIngredients, scale, perMeal[rep.meal], offers, request.storeId, now, providers));
  }

  const days: MenuDay[] = [];
  const allChoices: RecipeChoice[] = [];
  for (let day = 1; day <= MENU_WEEK_DAYS; day += 1) {
    const dayMeals: MenuMeal[] = [];
    const sourceDay = menu.days.find((d) => d.day === day);
    for (const meal of MENU_DAILY_MEALS) {
      const source = sourceDay?.meals.find((m) => m.meal === meal);
      const components = (source?.components ?? []).map((c) => {
        const replacement = chosenBySlot.get(`${day}:${meal}:${c.role}`);
        return { role: c.role, title: c.title, recipe: replacement ?? c.recipe };
      });
      if (components.length === 0) continue;
      dayMeals.push({ meal, title: MEAL_TITLES[meal], components });
    }
    if (dayMeals.length > 0) {
      days.push({ day, meals: dayMeals });
      for (const meal of dayMeals) for (const c of meal.components) {
        if (!allChoices.some((p) => p.recipe.id === c.recipe.recipe.id && p === c.recipe)) allChoices.push(c.recipe);
      }
    }
  }

  const inputs = allChoices.flatMap((p) =>
    p.scaledIngredients.map((si) => ({
      ingredient: si.ingredient,
      qty: si.qty,
      unit: si.unit,
    }))
  );
  const shoppingList = buildShoppingList(inputs, offers, request.storeId, now, opts.existingStock);
  const totalCost = shoppingList.total;
  const recipesCost = round2Safe(allChoices.reduce((s, p) => s + p.cost, 0));
  const remainingBudget = menu.budget > totalCost ? round2Safe(menu.budget - totalCost) : 0;
  const overspend = totalCost > menu.budget ? round2Safe(totalCost - menu.budget) : 0;

  return {
    ...menu,
    days,
    recipes: allChoices,
    recipesCost,
    totalCost,
    shoppingList,
    remainingBudget,
    overspend,
    warnings: [
      ...menu.warnings,
      `Меню изменено вручную: заменено ${replacements.length} ${replacements.length === 1 ? 'блюдо' : 'блюда'}.`,
    ],
  };
}