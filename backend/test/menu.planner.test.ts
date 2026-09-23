import { test } from 'node:test';
import assert from 'node:assert/strict';

import { servingsBreakdown, scaleForServings, round1, round2 } from '../src/services/menu/scaling';
import { buildShoppingList, convertQuantity, isFreshOffer, priceRecipe } from '../src/services/menu/costing';
import { generateMenu, rebuildMenuForSelection, type GenerateMenuOptions } from '../src/services/menu/planner';
import { RussianFoodRecipeProvider, FixtureNutritionProvider, FixtureRecipeProvider } from '../src/services/menu/providers';
import { buildFixtureRecipes, STORES, buildMockOffers, INGREDIENTS, getIngredientNutrition } from '../src/services/menu/fixtures';
import { inferCookware } from '../src/services/menu/cookware';
import type { MenuProviders, PriceProvider, RecipeProvider } from '../src/services/menu/providers';
import type { MenuRequest, ProductOffer, Recipe, StoreId } from '../src/services/menu/types';

const NOW = new Date('2026-09-21T12:00:00.000Z');

const baseRequest: MenuRequest = {
  storeId: 'euroopt',
  adults: 2,
  children: 1,
  budget: 40,
  currency: 'BYN',
  allergens: [],
};

function providersOf(recipes?: RecipeProvider, prices?: PriceProvider): MenuProviders {
  return {
    recipes: recipes ?? new FixtureRecipeProvider(),
    prices: prices ?? {
      kind: 'test',
      isMock: true,
      getStores: async () => STORES,
      getOffers: async (storeId: StoreId) => buildMockOffers().filter((o) => o.storeId === storeId),
    },
    nutrition: new FixtureNutritionProvider(),
  };
}

test('servingsBreakdown weights children below adults', () => {
  const s = servingsBreakdown(2, 2);
  assert.equal(s.effectiveServings, 3.2);
  assert.equal(s.adultCoefficient, 1);
  assert.equal(s.childCoefficient, 0.6);
});

test('scaleForServings scales quantities and flags unknown ingredients', () => {
  const recipe: Recipe = {
    id: 'r',
    name: 'r',
    category: 'x',
    baseServings: 4,
    timeMin: 10,
    ingredients: [
      { ingredientId: 'chicken_fillet', qty: 400, unit: 'g' },
      { ingredientId: 'import:strange', qty: 100, unit: 'g' },
    ],
    dataKind: 'fixture',
    sourceLabel: 'x',
  };
  const out = scaleForServings(recipe, 3.2);
  assert.equal(out.scale, 0.8);
  assert.equal(out.scaledIngredients[0].qty, 320);
  assert.equal(out.unknownIngredients.length, 1);
  assert.equal(out.unknownIngredients[0].id, 'import:strange');
});

test('convertQuantity: pcs <-> g via gramsPerPcs, liquids ~1 ml/g', () => {
  assert.equal(convertQuantity(4, 'pcs', 'g', 60), 240);
  assert.equal(convertQuantity(240, 'g', 'pcs', 60), 4);
  assert.equal(convertQuantity(500, 'ml', 'g'), 500);
  assert.equal(convertQuantity(10, 'g', 'ml'), 10);
  assert.equal(convertQuantity(3, 'pcs', 'ml', undefined), null);
});

test('isFreshOffer respects PRICE_MAX_AGE_DAYS', () => {
  const fresh: ProductOffer = {
    productId: 'milk', storeId: 'euroopt', productName: 'Молоко', price: 2.29,
    currency: 'BYN', packageQuantity: 1000, packageUnit: 'ml',
    updatedAt: '2026-09-10T00:00:00.000Z', source: 'mock', isMock: true,
  };
  assert.equal(isFreshOffer(fresh, NOW), true);
  const old = { ...fresh, updatedAt: '2020-01-01T00:00:00.000Z' };
  assert.equal(isFreshOffer(old, NOW), false);
  const future = { ...fresh, updatedAt: '2027-01-01T00:00:00.000Z' };
  assert.equal(isFreshOffer(future, NOW), false);
});

test('buildShoppingList: whole packages, merges quantities, deterministic order', () => {
  const offers = buildMockOffers().filter((o) => o.storeId === 'euroopt');
  const eggs = INGREDIENTS.find((i) => i.id === 'eggs')!;
  const milk = INGREDIENTS.find((i) => i.id === 'milk')!;
  const list = buildShoppingList(
    [
      { ingredient: eggs, qty: 4, unit: 'pcs' },
      { ingredient: eggs, qty: 3, unit: 'pcs' },
      { ingredient: milk, qty: 1200, unit: 'ml' },
    ],
    offers,
    'euroopt',
    NOW
  );
  const eggsItem = list.items.find((i) => i.ingredientId === 'eggs')!;
  assert.equal(eggsItem.requiredQuantity, 7);
  assert.equal(eggsItem.purchaseQuantity, 1); // one 10-pk
  assert.equal(eggsItem.subtotal, 4.79);
  const milkItem = list.items.find((i) => i.ingredientId === 'milk')!;
  assert.equal(milkItem.purchaseQuantity, 2); // 1200 ml -> two 1000 ml packs
  assert.equal(milkItem.subtotal, 4.58);
  assert.equal(list.total, round2(4.79 + 4.58));
  assert.equal(list.missingItemsCount, 0);
});

test('priceRecipe reports missing and stale-priced ingredients', () => {
  const offers = buildMockOffers().filter((o) => o.storeId === 'euroopt');
  const fillet = INGREDIENTS.find((i) => i.id === 'chicken_fillet')!;
  const priced = priceRecipe(
    [{ ingredient: fillet, qty: 400, unit: 'g' }],
    offers, 'euroopt', 2, NOW
  );
  assert.equal(priced.priceMissing.length, 0);
  assert.equal(priced.cost, round2((12.99 / 800) * 400));

  const noOffers = priceRecipe([{ ingredient: fillet, qty: 400, unit: 'g' }], [], 'euroopt', 2, NOW);
  assert.equal(noOffers.priceMissing.length, 1);
  const staleOffers = [
    { ...offers[0], updatedAt: '2020-01-01T00:00:00.000Z' },
  ];
  const withStale = priceRecipe([{ ingredient: fillet, qty: 400, unit: 'g' }], staleOffers, 'euroopt', 2, NOW);
  assert.equal(withStale.priceMissing.length, 1);
  assert.equal(withStale.staleMissing, 1);
});

test('generateMenu: happy path is deterministic and within budget', async () => {
  const a = await generateMenu(baseRequest, { providers: providersOf(), now: NOW });
  const b = await generateMenu(baseRequest, { providers: providersOf(), now: NOW });
  assert.ok(!('code' in a));
  assert.ok(!('code' in b));
  if ('code' in a || 'code' in b) return;
  assert.equal(a.recipes.map((r) => r.recipe.id).join(','), b.recipes.map((r) => r.recipe.id).join(','));
  assert.equal(a.totalCost, b.totalCost);
  assert.ok(a.recipes.length >= 1);
  assert.ok(a.recipes.length <= 4);
  for (const choice of a.recipes) {
    assert.equal(choice.priceMissing.length, 0);
    assert.equal(choice.nutritionMissing, false);
    assert.ok(choice.nutrition && choice.nutrition.perRecipe.calories > 0);
    assert.equal(choice.servings, 2.6);
  }
  // package checkout >= proportional cost
  assert.ok(a.totalCost >= a.recipesCost - 1e-9);
  // identity: totalCost === budget - remaining + overspend
  assert.equal(round2(a.totalCost), round2(a.budget - a.remainingBudget + a.overspend));
  assert.ok(a.warnings.some((w) => w.includes('Демо-цены')));
});

test('generateMenu: milk allergen excludes milk-containing recipes (2 adults + 2 children, 50 BYN)', async () => {
  const result = await generateMenu(
    { ...baseRequest, adults: 2, children: 2, budget: 50, allergens: ['milk'] },
    { providers: providersOf(), now: NOW }
  );
  assert.ok(!('code' in result));
  if ('code' in result) return;
  assert.ok(result.recipes.length >= 1);
  for (const choice of result.recipes) {
    assert.ok(!choice.allergens.includes('milk'));
    for (const si of choice.scaledIngredients) {
      const catalogue = INGREDIENTS.find((i) => i.id === si.ingredient.id);
      assert.ok(!catalogue?.allergens.includes('milk'), `milk in ${si.ingredient.name}`);
    }
  }
});

test('generateMenu: budget below cheapest recipe returns budget_too_low', async () => {
  const result = await generateMenu(
    { ...baseRequest, budget: 0.01 },
    { providers: providersOf(), now: NOW }
  );
  assert.ok('code' in result);
  if (!('code' in result)) return;
  assert.equal(result.code, 'budget_too_low');
  if (result.code === 'budget_too_low') {
    assert.ok(result.minCost > result.budget);
  }
});

test('generateMenu: no offers in store -> no_recipes', async () => {
  const emptyPrices: PriceProvider = {
    kind: 'test', isMock: true,
    getStores: async () => STORES,
    getOffers: async () => [],
  };
  const result = await generateMenu(baseRequest, { providers: providersOf(undefined, emptyPrices), now: NOW });
  assert.ok('code' in result);
  if ('code' in result) assert.equal(result.code, 'no_recipes');
});

test('generateMenu: invalid store id -> invalid_store', async () => {
  const result = await generateMenu({ ...baseRequest, storeId: 'nope' as StoreId }, { providers: providersOf(), now: NOW });
  assert.ok('code' in result);
  if ('code' in result) assert.equal(result.code, 'invalid_store');
});

test('rebuildMenuForSelection: subset recomputes totals and list', async () => {
  const result = await generateMenu(baseRequest, { providers: providersOf(), now: NOW });
  assert.ok(!('code' in result));
  if ('code' in result) return;
  const pickedId = result.recipes[0].recipe.id;
  const updated = await rebuildMenuForSelection(result, [pickedId], { providers: providersOf(), now: NOW });
  assert.equal(updated.recipes.length, 1);
  assert.equal(updated.recipes[0].recipe.id, pickedId);
  assert.equal(updated.shoppingList.storeId, baseRequest.storeId);
  assert.ok(updated.totalCost >= updated.recipesCost - 1e-9);
});

test('RussianFood provider: ingredient text parsing', () => {
  const p = new RussianFoodRecipeProvider();
  const ml = p.parseIngredientText('Молоко — 300 мл');
  assert.deepEqual(ml, { ingredientId: 'milk', qty: 300, unit: 'ml' });
  const kg = p.parseIngredientText('Картофель — 2 кг');
  assert.deepEqual(kg, { ingredientId: 'potatoes', qty: 2000, unit: 'g' });
  const pcs = p.parseIngredientText('Яйца — 5 шт');
  assert.deepEqual(pcs, { ingredientId: 'eggs', qty: 5, unit: 'pcs' });
  const unsupported = p.parseIngredientText('Соль — по вкусу');
  assert.equal(unsupported, null);
});

test('RussianFood provider: parseRecipe on synthetic page', () => {
  const html = `<html><head>
    <meta property="og:image" content="//www.russianfood.com/dycontent/images_upl/1/big_1.jpg">
  </head><body>
    <h1 class="title">Омлет с молоком</h1>
    <div class="sub-info">
      <i class="ico_portion"></i></div>&nbsp;<span class="hl"><b>4</b>&nbsp;порций
      <i class="ico_time"></i></div>&nbsp;<span class="hl">30 мин
    </div>
    <table class="ingr">
      <tr class="ingr_tr_0"><td colspan="3" class="padding_l padding_r"><span class="">Яйца &mdash; 4 шт</span></td></tr>
      <tr class="ingr_tr_1"><td colspan="3" class="padding_l padding_r"><span class="">Молоко &mdash; 200 мл</span></td></tr>
    </table>
    <div class="step_n"><div class="img_c"><img src="x.jpg"></div><p>Взбить яйца с молоком.</p></div>
    <div class="step_n"><div class="img_c"></div><p>Обжарить до готовности.</p></div>
  </body></html>`;
  const recipe = new RussianFoodRecipeProvider().parseRecipe(html, '1');
  assert.ok(recipe);
  assert.equal(recipe!.name, 'Омлет с молоком');
  assert.equal(recipe!.baseServings, 4);
  assert.equal(recipe!.timeMin, 30);
  assert.equal(recipe!.ingredients.length, 2);
  assert.deepEqual(recipe!.ingredients[0], { ingredientId: 'eggs', qty: 4, unit: 'pcs' });
  assert.equal(recipe!.steps!.length, 2);
  assert.equal(recipe!.sourceUrl, 'https://www.russianfood.com/recipes/recipe.php?rid=1');
  assert.equal(recipe!.photoUrl, 'https://www.russianfood.com/dycontent/images_upl/1/big_1.jpg');
  assert.equal(recipe!.dataKind, 'russianfood_import');
});

test('RussianFood provider: unparseable page returns null', () => {
  const recipe = new RussianFoodRecipeProvider().parseRecipe('<html><body><p>nothing</p></body></html>', '999');
  assert.equal(recipe, null);
});

test('provided fixtures catalog covers recipes with offers in every store', () => {
  const recipes = buildFixtureRecipes();
  const offers = buildMockOffers();
  assert.ok(recipes.length >= 10);
  for (const store of STORES) {
    for (const recipe of recipes) {
      for (const iq of recipe.ingredients) {
        const hasOffer = offers.some((o) => o.storeId === store.id && o.productId === iq.ingredientId);
        assert.ok(hasOffer, `missing offer for ${iq.ingredientId} in ${store.id}`);
      }
    }
  }
});

test('inferCookware maps dishes to kitchen equipment', () => {
  assert.deepEqual(inferCookware({ name: 'Суп куриный с лапшой', category: 'Супы' }), ['pot']);
  assert.deepEqual(inferCookware({ name: 'Куриные котлеты', category: 'Основные блюда' }), ['skillet']);
  assert.deepEqual(
    inferCookware({ name: 'Шарлотка с яблоками', category: 'Выпечка', steps: ['Запекать в духовке 40 минут.'] }),
    ['oven']
  );
  assert.deepEqual(
    inferCookware({ name: 'Плов с курицей', category: 'Основные блюда', steps: ['Курицу обжарить, добавить рис и варить.'] }),
    ['skillet', 'pot']
  );
  assert.deepEqual(inferCookware({ name: 'Салат овощной', category: 'Салаты' }), []);
});

test('generateMenu: cookware filter excludes recipes needing missing equipment', async () => {
  const result = await generateMenu(
    { ...baseRequest, budget: 40, cookware: ['pot'] },
    { providers: providersOf(), now: NOW }
  );
  assert.ok(!('code' in result), 'expected a menu with only pot-cookable recipes');
  if ('code' in result) return;
  assert.ok(result.recipes.length >= 1);
  for (const choice of result.recipes) {
    const required = inferCookware(choice.recipe);
    for (const r of required) {
      assert.equal(r, 'pot', `${choice.recipe.name} should require only a pot, got ${r}`);
    }
    assert.ok(!choice.cookwareLabels.some((l) => l.includes('Сковорода')), `${choice.recipe.name} should not claim a skillet`);
  }
});

// exposed for future planner counters
test('generateMenu: empty cookware list disables the filter', async () => {
  const a = await generateMenu({ ...baseRequest, cookware: [] }, { providers: providersOf(), now: NOW });
  const b = await generateMenu(baseRequest, { providers: providersOf(), now: NOW });
  assert.ok(!('code' in a) && !('code' in b));
  if ('code' in a || 'code' in b) return;
  const kitchenOfA = a.recipes.map((r) => inferCookware(r.recipe).join(',')).join('|');
  const kitchenOfB = b.recipes.map((r) => inferCookware(r.recipe).join(',')).join('|');
  assert.equal(kitchenOfA, kitchenOfB);
});

test('nutrition reference DB covers the whole ingredient catalogue', () => {
  const uncovered = INGREDIENTS.filter((i) => getIngredientNutrition(i.id) === null);
  assert.deepEqual(uncovered, []);
});