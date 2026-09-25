import { test } from 'node:test';
import assert from 'node:assert/strict';

import { generateMenuWithAi } from '../src/services/menu/aiMenu';
import { MENU_AI_FALLBACK_WARNING, MENU_AI_WARNING } from '../src/services/menu/config';
import { buildMockOffers, STORES } from '../src/services/menu/fixtures';
import { FixtureNutritionProvider, SnapshotRecipeProvider } from '../src/services/menu/providers';
import type { MenuProviders, PriceProvider, RecipeProvider } from '../src/services/menu/providers';
import type { MenuRequest, StoreId } from '../src/services/menu/types';

const NOW = new Date('2026-09-21T12:00:00.000Z');
const WEEK_SLOTS = 21;

const baseRequest: MenuRequest = {
  storeId: 'euroopt',
  adults: 2,
  children: 1,
  budget: 40,
  currency: 'BYN',
  allergens: [],
};

function priceProvider(): PriceProvider {
  return {
    kind: 'test',
    isMock: true,
    getStores: async () => STORES,
    getOffers: async (storeId: StoreId) => buildMockOffers().filter((o) => o.storeId === storeId),
  };
}

function providersOf(recipes?: RecipeProvider, prices?: PriceProvider): MenuProviders {
  return {
    recipes: recipes ?? new SnapshotRecipeProvider(),
    prices: prices ?? priceProvider(),
    nutrition: new FixtureNutritionProvider(),
  };
}

interface DishJson {
  name: string;
  ingredients: { name: string; qty: number; unit: string }[];
  steps: string[];
  cookware: string[];
  nutritionPerServing: { kcal: number; protein: number; fat: number; carbs: number };
}

function dish(name: string, ingredients: [string, number, string][]): DishJson {
  return {
    name,
    ingredients: ingredients.map(([n, qty, unit]) => ({ name: n, qty, unit })),
    steps: [`Приготовить «${name}»`, 'Подать к столу.'],
    cookware: ['pot'],
    nutritionPerServing: { kcal: 250, protein: 10, fat: 5, carbs: 30 },
  };
}

function planJson(
  perDay: (day: number) => { breakfast: DishJson; lunch: DishJson; dinner: DishJson }
): string {
  const days = Array.from({ length: 7 }, (_, i) => perDay(i + 1));
  return JSON.stringify({ days });
}

/** Full 21-slot plan whose shopping receipt fits a 40 BYN budget. */
const CHEAP_PLAN = planJson((d) => ({
  breakfast: dish(`Каша день ${d}`, [['Овсяные хлопья', 30, 'g']]),
  lunch: dish(`Обед день ${d}`, [
    ['Картофель', 200, 'g'],
    ['Морковь', 100, 'g'],
  ]),
  dinner: dish(`Ужин день ${d}`, [
    ['Картофель', 200, 'g'],
    ['Капуста белокочанная', 150, 'g'],
  ]),
}));

/** Full 21-slot plan whose receipt is far above the 40 BYN budget. */
const EXPENSIVE_PLAN = planJson((d) => ({
  breakfast: dish(`Завтрак день ${d}`, [
    ['Лосось', 150, 'g'],
    ['Сыр твёрдый', 50, 'g'],
  ]),
  lunch: dish(`Обед день ${d}`, [
    ['Лосось', 150, 'g'],
    ['Сыр твёрдый', 50, 'g'],
  ]),
  dinner: dish(`Ужин день ${d}`, [
    ['Лосось', 150, 'g'],
    ['Сыр твёрдый', 50, 'g'],
  ]),
}));

test('aiMenu: full 21-slot AI week priced within budget, no spending over the limit', async () => {
  const prompts: string[] = [];
  const result = await generateMenuWithAi(baseRequest, {
    providers: providersOf(),
    now: NOW,
    generatePlan: async (prompt) => {
      prompts.push(prompt);
      // First call is the initial build, revisions happen once the budget is exceeded.
      return prompt.includes('ПЕРЕСБОРКА') ? CHEAP_PLAN : EXPENSIVE_PLAN;
    },
  });

  assert.ok(!('code' in result));
  if ('code' in result) return;

  assert.ok(prompts.length >= 2, 'expensive first attempt must trigger a budget revision');
  assert.ok(!prompts[0].includes('ПЕРЕСБОРКА'));
  assert.ok(prompts[1].includes('ПЕРЕСБОРКА'), 'revision prompt must ask to rebuild the week');
  assert.ok(prompts[1].includes('перерасход'), 'revision prompt must report the overspend');

  assert.equal(result.days.length, 7);
  const meals = result.days.flatMap((d) => d.meals);
  assert.equal(meals.length, WEEK_SLOTS);
  assert.equal(result.recipes.length, WEEK_SLOTS);
  assert.ok(result.totalCost <= result.budget + 1e-9, `total ${result.totalCost} must fit ${result.budget}`);
  assert.equal(result.overspend, 0);
  assert.ok(result.warnings.some((w) => w.includes('сгенерированы ИИ')));
  for (const r of result.recipes) {
    assert.equal(r.recipe.dataKind, 'ai');
    assert.ok(r.recipe.steps && r.recipe.steps.length > 0);
    assert.ok(r.nutrition && r.nutrition.perServing.calories > 0);
  }
});

test('aiMenu: repeated violations of exclusions are never leaked — falls back safely', async () => {
  // The fake model keeps returning cabbage dishes regardless of the "капуст"
  // dislike, so every revision still violates it. The planner must keep the
  // safety invariant (no disliked product anywhere) and eventually fall back
  // to its deterministic catalogue instead of serving a forbidden dish.
  const request: MenuRequest = { ...baseRequest, allergens: ['milk'], disliked: ['капуст'], budget: 60 };
  const result = await generateMenuWithAi(request, {
    providers: providersOf(),
    now: NOW,
    generatePlan: async () => CHEAP_PLAN,
  });

  assert.ok(!('code' in result));
  if ('code' in result) return;

  assert.ok(result.warnings.some((w) => w.includes(MENU_AI_FALLBACK_WARNING)));
  for (const choice of result.recipes) {
    assert.ok(!choice.allergens.includes('milk'));
    for (const si of choice.scaledIngredients) {
      assert.ok(!si.ingredient.name.toLowerCase().includes('капуст'), `disliked hit in ${si.ingredient.name}`);
    }
  }
});

test('aiMenu: LLM unavailable (null answer) falls back to the deterministic planner', async () => {
  const result = await generateMenuWithAi(baseRequest, {
    providers: providersOf(),
    now: NOW,
    generatePlan: async () => null,
  });

  assert.ok(!('code' in result), 'deterministic planner must still assemble a menu');
  if ('code' in result) return;
  assert.ok(result.totalCost <= result.budget + 1e-9);
  assert.ok(result.warnings.some((w) => w.includes('Демо-цены')));
  assert.ok(!result.warnings.some((w) => w.includes(MENU_AI_FALLBACK_WARNING)));
  assert.ok(!result.warnings.includes(MENU_AI_WARNING));
});

test('aiMenu: repeated dish names are rejected — a revision that diversifies wins', async () => {
  // Same dish name in every slot, but within budget: the week must not be
  // accepted as-is. The model is told to fix it; the second attempt returns a
  // diversified cheap plan which is accepted.
  const DUPLICATE_PLAN = planJson(() => ({
    breakfast: dish('Яичница', [['Яйца', 6, 'pcs']]),
    lunch: dish('Яичница', [['Яйца', 6, 'pcs']]),
    dinner: dish('Яичница', [['Яйца', 6, 'pcs']]),
  }));

  const prompts: string[] = [];
  const result = await generateMenuWithAi(baseRequest, {
    providers: providersOf(),
    now: NOW,
    generatePlan: async (prompt) => {
      prompts.push(prompt);
      return prompt.includes('Блюда повторяются') ? CHEAP_PLAN : DUPLICATE_PLAN;
    },
  });

  assert.ok(!('code' in result));
  if ('code' in result) return;

  assert.ok(prompts.length >= 2, 'duplicate names must trigger a revision');
  assert.ok(prompts[1].includes('Блюда повторяются'), 'revision must report repeated dishes');

  const names = result.recipes.map((r) => r.recipe.name);
  assert.equal(new Set(names).size, names.length, 'all 21 dish names must be unique');
  assert.equal(result.recipes.length, WEEK_SLOTS);
  assert.ok(result.totalCost <= result.budget + 1e-9);
  assert.ok(result.recipes.every((r) => r.recipe.dataKind === 'ai'));
});

test('aiMenu: degenerate quantities (5 g) and garnishes-only never reach the user', async () => {
  // The fake model always emits a dish with a garnish-only recipe and absurd
  // tiny quantities — both are rejected slot-by-slot, revisions retry the same
  // broken plan, and the deterministic planner must produce the final menu.
  const DEGENERATE_PLAN = planJson((d) => ({
    breakfast: dish(`Завтрак ${d}`, [['Картофель', 5, 'g'], ['Морковь', 6, 'g']]),
    lunch: dish('Жареный лук', [['Лук репчатый', 300, 'g']]),
    dinner: dish('Отварной картофель', [['Картофель', 400, 'g']]),
  }));

  const result = await generateMenuWithAi(baseRequest, {
    providers: providersOf(),
    now: NOW,
    generatePlan: async () => DEGENERATE_PLAN,
  });

  assert.ok(!('code' in result));
  if ('code' in result) return;

  assert.ok(result.warnings.some((w) => w.includes(MENU_AI_FALLBACK_WARNING)));
  assert.ok(result.recipes.every((r) => r.recipe.dataKind !== 'ai'), 'degenerate AI dishes must not leak');
});

test('aiMenu: invalid JSON never leaks a partial/invalid plan to the user', async () => {
  const result = await generateMenuWithAi(baseRequest, {
    providers: providersOf(),
    now: NOW,
    generatePlan: async () => '{ not json',
  });

  assert.ok(!('code' in result), 'fallback must return a planner result, not an error');
  if ('code' in result) return;
  assert.ok(result.days.length >= 1);
  assert.ok(result.totalCost <= result.budget + 1e-9);
});