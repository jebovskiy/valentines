import type {
  Ingredient,
  NutritionPer100g,
  ProductOffer,
  Recipe,
  Store,
  StoreId,
} from './types';
import { normalizeName } from './allergens';

/**
 * ============================================================================
 * FIXTURE / DEMO DATA
 * ============================================================================
 *
 * Everything in this module is EXPLICITLY mock/demo data used for local
 * development:
 *
 * - Store price catalogues (ProductOffer[]) are demo numbers ONLY.
 *   They are NOT real prices of Euroopt / Hippo / Green / Korona and must
 *   never be presented as real current prices. Every offer carries
 *   isMock: true and source: 'mock'.
 * - Recipe fixtures are our own demo catalogue with dataKind: 'fixture'.
 *   They have no source URL. Imported snapshot recipes are tagged
 *   dataKind 'russianfood_import' and keep their sourceUrl.
 * - The nutrition reference DB holds typical per-100g estimates compiled
 *   from public reference tables (USDA FoodData Central style averages).
 *   It is approximation, labelled as such, and extensible behind the
 *   NutritionProvider interface.
 * ============================================================================
 */

export const STORES: Store[] = [
  { id: 'euroopt', name: 'Евроопт', emoji: '🛒', description: 'Сеть супермаркетов по всей Беларуси', priceCatalog: 'mock', available: true },
  { id: 'hippo', name: 'Гиппо', emoji: '🦛', description: 'Сеть магазинов в Беларуси', priceCatalog: 'mock', available: false },
  { id: 'green', name: 'Green', emoji: '🥬', description: 'Сеть «Green» в Беларуси', priceCatalog: 'mock', available: false },
  { id: 'korona', name: 'Корона', emoji: '👑', description: 'Сеть «Корона» в Беларуси', priceCatalog: 'mock', available: false },
];

export const MOCK_STORE_IDS: StoreId[] = STORES.map((s) => s.id);

/** Clear, machine + human readable signal that the price data is dem. */
export const MOCK_PRICE_SOURCE_LABEL = 'Демо-цены (не реальные)';

const MOCK_UPDATED_AT = '2026-09-20T10:00:00.000Z';

// ---------------------------------------------------------------------------
// Ingredient catalogue
// ---------------------------------------------------------------------------

export const INGREDIENTS: Ingredient[] = [
  { id: 'chicken_fillet', name: 'Куриное филе', unit: 'g', allergens: [] },
  { id: 'chicken_leg', name: 'Куриная голень', unit: 'g', allergens: [] },
  { id: 'beef', name: 'Говядина', unit: 'g', allergens: [] },
  { id: 'pork', name: 'Свинина', unit: 'g', allergens: [] },
  { id: 'potatoes', name: 'Картофель', unit: 'g', gramsPerPcs: 150, allergens: [] },
  { id: 'carrots', name: 'Морковь', unit: 'g', gramsPerPcs: 100, allergens: [] },
  { id: 'onions', name: 'Лук репчатый', unit: 'g', gramsPerPcs: 100, allergens: [] },
  { id: 'garlic', name: 'Чеснок', unit: 'g', gramsPerPcs: 4, allergens: [] },
  { id: 'tomato', name: 'Помидоры', unit: 'g', gramsPerPcs: 120, allergens: [] },
  { id: 'cucumber', name: 'Огурцы', unit: 'g', gramsPerPcs: 130, allergens: [] },
  { id: 'bell_pepper', name: 'Перец болгарский', unit: 'g', gramsPerPcs: 150, allergens: [] },
  { id: 'cabbage', name: 'Капуста белокочанная', unit: 'g', allergens: [] },
  { id: 'cauliflower', name: 'Цветная капуста', unit: 'g', allergens: [] },
  { id: 'spinach', name: 'Шпинат', unit: 'g', allergens: [] },
  { id: 'mushroom', name: 'Шампиньоны', unit: 'g', gramsPerPcs: 25, allergens: [] },
  { id: 'rice', name: 'Рис', unit: 'g', allergens: [] },
  { id: 'pasta', name: 'Макароны', unit: 'g', allergens: ['gluten'] },
  { id: 'buckwheat', name: 'Гречка', unit: 'g', allergens: [] },
  { id: 'oatmeal', name: 'Овсяные хлопья', unit: 'g', allergens: [] },
  { id: 'bread', name: 'Хлеб', unit: 'g', allergens: ['gluten'] },
  { id: 'flour', name: 'Мука пшеничная', unit: 'g', allergens: ['gluten'] },
  { id: 'eggs', name: 'Яйца куриные', unit: 'pcs', gramsPerPcs: 60, allergens: ['egg'] },
  { id: 'milk', name: 'Молоко 3,2%', unit: 'ml', allergens: ['milk'] },
  { id: 'cream', name: 'Сливки 20%', unit: 'ml', allergens: ['milk'] },
  { id: 'sour_cream', name: 'Сметана 20%', unit: 'g', allergens: ['milk'] },
  { id: 'butter', name: 'Масло сливочное', unit: 'g', allergens: ['milk'] },
  { id: 'cheese', name: 'Сыр твёрдый', unit: 'g', allergens: ['milk'] },
  { id: 'feta', name: 'Брынза (фета)', unit: 'g', allergens: ['milk'] },
  { id: 'cottage_cheese', name: 'Творог 5%', unit: 'g', allergens: ['milk'] },
  { id: 'yogurt', name: 'Йогурт', unit: 'g', allergens: ['milk'] },
  { id: 'mayo', name: 'Майонез', unit: 'g', allergens: ['egg', 'soy'] },
  { id: 'vegetable_oil', name: 'Масло подсолнечное', unit: 'ml', allergens: [] },
  { id: 'olive_oil', name: 'Масло оливковое', unit: 'ml', allergens: [] },
  { id: 'sugar', name: 'Сахар', unit: 'g', allergens: [] },
  { id: 'salt', name: 'Соль', unit: 'g', allergens: [] },
  { id: 'pepper', name: 'Перец чёрный молотый', unit: 'g', allergens: [] },
  { id: 'soy_sauce', name: 'Соевый соус', unit: 'ml', allergens: ['soy'] },
  { id: 'peanuts', name: 'Арахис', unit: 'g', allergens: ['peanut'] },
  { id: 'walnuts', name: 'Грецкие орехи', unit: 'g', allergens: ['tree_nut'] },
  { id: 'almonds', name: 'Миндаль', unit: 'g', allergens: ['tree_nut'] },
  { id: 'salmon', name: 'Лосось', unit: 'g', allergens: ['fish'] },
  { id: 'cod', name: 'Треска', unit: 'g', allergens: ['fish'] },
  { id: 'shrimps', name: 'Креветки', unit: 'g', allergens: ['seafood'] },
  { id: 'lemon', name: 'Лимон', unit: 'g', gramsPerPcs: 60, allergens: [] },
  { id: 'tomato_paste', name: 'Томатная паста', unit: 'g', allergens: [] },
  { id: 'herbs', name: 'Зелень (укроп/петрушка)', unit: 'g', allergens: [] },
  { id: 'honey', name: 'Мёд', unit: 'g', allergens: [] },
  { id: 'apples', name: 'Яблоки', unit: 'g', allergens: [] },
  { id: 'grapes', name: 'Виноград', unit: 'g', allergens: [] },
];

const INGREDIENT_INDEX = new Map(INGREDIENTS.map((i) => [i.id, i]));
const INGREDIENT_NORMALIZED_INDEX = new Map(
  INGREDIENTS.map((i) => [normalizeName(i.name), i])
);

/**
 * Curated aliases for imported recipe text whose word order or wording differs
 * from the catalogue (e.g. «филе куриное» -> chicken_fillet, «гречка» ->
 * buckwheat). Keys are normalized the same way as ingredient names.
 */
const INGREDIENT_NAME_ALIASES: ReadonlyArray<readonly [string, string]> = [
  ['филе куриное', 'chicken_fillet'],
  ['грудка куриная', 'chicken_fillet'],
  ['куриная грудка', 'chicken_fillet'],
  ['филе куриной грудки', 'chicken_fillet'],
  ['голень куриная', 'chicken_leg'],
  ['голени куриные', 'chicken_leg'],
  ['бедро куриное', 'chicken_leg'],
  ['бедра куриные', 'chicken_leg'],
  ['куриные ножки', 'chicken_leg'],
  ['окорочка куриные', 'chicken_leg'],
  ['паста томатная', 'tomato_paste'],
  ['томатное пюре', 'tomato_paste'],
  ['пюре томатное', 'tomato_paste'],
  ['макароны спагетти', 'pasta'],
  ['спагетти', 'pasta'],
  ['луковица', 'onions'],
  ['лук крупный', 'onions'],
  ['лук репчатый крупный', 'onions'],
  ['картошка', 'potatoes'],
  ['гречка', 'buckwheat'],
  ['гречневая крупа', 'buckwheat'],
  ['крупа гречневая', 'buckwheat'],
  ['овсянка', 'oatmeal'],
  ['овсяные хлопья', 'oatmeal'],
  ['хлопья овсяные', 'oatmeal'],
  ['сахарный песок', 'sugar'],
  ['песок сахарный', 'sugar'],
  ['перец черный молотый', 'pepper'],
  ['перец чёрный молотый', 'pepper'],
  ['черный перец', 'pepper'],
  ['чёрный перец', 'pepper'],
  ['перец молотый', 'pepper'],
  ['перец болгарский', 'bell_pepper'],
  ['болгарский перец', 'bell_pepper'],
  ['помидор', 'tomato'],
  ['томат', 'tomato'],
  ['огурец', 'cucumber'],
  ['яйцо', 'eggs'],
  ['сливочное масло', 'butter'],
  ['сыр плавленый', 'cheese'],
  ['шампиньон', 'mushroom'],
  ['гриб', 'mushroom'],
  ['петрушка', 'herbs'],
  ['укроп', 'herbs'],
  ['филе трески', 'cod'],
  ['лосось', 'salmon'],
  ['форель', 'salmon'],
  ['креветка', 'shrimps'],
];

export function getIngredient(id: string): Ingredient | undefined {
  return INGREDIENT_INDEX.get(id);
}

/**
 * Catalogue lookup by name for ingested (imported) ingredient text:
 *   1. exact normalized-name match (e.g. «Молоко 3,2%» matches «молоко»);
 *   2. curated alias (e.g. «филе куриное» — reversed word order);
 *   3. first whole-word prefix (e.g. «Яйца куриные» matches «яйца»).
 * Deterministic (first catalogue entry wins). Heuristic for imports only.
 */
export function getIngredientByName(name: string): Ingredient | undefined {
  const n = normalizeName(name);
  if (!n) return undefined;
  const exact = INGREDIENT_NORMALIZED_INDEX.get(n);
  if (exact) return exact;
  for (const [alias, id] of INGREDIENT_NAME_ALIASES) {
    if (alias === n) {
      const ing = INGREDIENT_INDEX.get(id);
      if (ing) return ing;
    }
  }
  return INGREDIENTS.find((i) => normalizeName(i.name).startsWith(`${n} `));
}

export function ingredientByIdOrThrow(id: string): Ingredient {
  const ing = INGREDIENT_INDEX.get(id);
  if (!ing) throw new Error(`Unknown ingredient: ${id}`);
  return ing;
}

// ---------------------------------------------------------------------------
// Mock price catalogue: demo prices per store (NO real prices)
// ---------------------------------------------------------------------------

interface BaseOffer {
  productId: string;
  price: number;
  packageQuantity: number;
  packageUnit: 'g' | 'ml' | 'pcs';
}

const BASE_OFFERS: BaseOffer[] = [
  { productId: 'chicken_fillet', price: 12.99, packageQuantity: 800, packageUnit: 'g' },
  { productId: 'chicken_leg', price: 9.49, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'beef', price: 27.9, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'pork', price: 14.9, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'potatoes', price: 2.49, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'carrots', price: 1.69, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'onions', price: 1.39, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'garlic', price: 2.99, packageQuantity: 100, packageUnit: 'g' },
  { productId: 'tomato', price: 4.99, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'cucumber', price: 3.19, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'bell_pepper', price: 7.99, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'cabbage', price: 1.19, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'cauliflower', price: 4.79, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'spinach', price: 3.19, packageQuantity: 200, packageUnit: 'g' },
  { productId: 'mushroom', price: 5.49, packageQuantity: 500, packageUnit: 'g' },
  { productId: 'rice', price: 3.49, packageQuantity: 800, packageUnit: 'g' },
  { productId: 'pasta', price: 1.89, packageQuantity: 450, packageUnit: 'g' },
  { productId: 'buckwheat', price: 3.29, packageQuantity: 800, packageUnit: 'g' },
  { productId: 'oatmeal', price: 1.49, packageQuantity: 500, packageUnit: 'g' },
  { productId: 'bread', price: 1.35, packageQuantity: 600, packageUnit: 'g' },
  { productId: 'flour', price: 1.99, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'eggs', price: 4.79, packageQuantity: 10, packageUnit: 'pcs' },
  { productId: 'milk', price: 2.29, packageQuantity: 1000, packageUnit: 'ml' },
  { productId: 'cream', price: 3.49, packageQuantity: 500, packageUnit: 'ml' },
  { productId: 'sour_cream', price: 3.29, packageQuantity: 400, packageUnit: 'g' },
  { productId: 'butter', price: 4.19, packageQuantity: 180, packageUnit: 'g' },
  { productId: 'cheese', price: 6.49, packageQuantity: 250, packageUnit: 'g' },
  { productId: 'feta', price: 5.99, packageQuantity: 200, packageUnit: 'g' },
  { productId: 'cottage_cheese', price: 4.99, packageQuantity: 500, packageUnit: 'g' },
  { productId: 'yogurt', price: 2.49, packageQuantity: 300, packageUnit: 'g' },
  { productId: 'mayo', price: 3.59, packageQuantity: 400, packageUnit: 'g' },
  { productId: 'vegetable_oil', price: 4.49, packageQuantity: 1000, packageUnit: 'ml' },
  { productId: 'olive_oil', price: 8.9, packageQuantity: 500, packageUnit: 'ml' },
  { productId: 'sugar', price: 2.19, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'salt', price: 0.79, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'pepper', price: 2.99, packageQuantity: 100, packageUnit: 'g' },
  { productId: 'soy_sauce', price: 3.49, packageQuantity: 250, packageUnit: 'ml' },
  { productId: 'peanuts', price: 3.79, packageQuantity: 200, packageUnit: 'g' },
  { productId: 'walnuts', price: 5.99, packageQuantity: 200, packageUnit: 'g' },
  { productId: 'almonds', price: 6.49, packageQuantity: 200, packageUnit: 'g' },
  { productId: 'salmon', price: 18.9, packageQuantity: 400, packageUnit: 'g' },
  { productId: 'cod', price: 11.5, packageQuantity: 500, packageUnit: 'g' },
  { productId: 'shrimps', price: 15.5, packageQuantity: 500, packageUnit: 'g' },
  { productId: 'lemon', price: 2.49, packageQuantity: 100, packageUnit: 'g' },
  { productId: 'tomato_paste', price: 3.19, packageQuantity: 400, packageUnit: 'g' },
  { productId: 'herbs', price: 1.19, packageQuantity: 50, packageUnit: 'g' },
  { productId: 'honey', price: 8.5, packageQuantity: 400, packageUnit: 'g' },
  { productId: 'apples', price: 4.29, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'grapes', price: 8.99, packageQuantity: 1000, packageUnit: 'g' },
];

/** Demo offers — the SAME demo numbers are cloned to every store. Marked mock. */
export function buildMockOffers(): ProductOffer[] {
  const offers: ProductOffer[] = [];
  for (const storeId of MOCK_STORE_IDS) {
    for (const base of BASE_OFFERS) {
      const ingredient = getIngredient(base.productId);
      offers.push({
        productId: base.productId,
        storeId,
        productName: ingredient ? ingredient.name : base.productId,
        price: base.price,
        currency: 'BYN',
        packageQuantity: base.packageQuantity,
        packageUnit: base.packageUnit,
        updatedAt: MOCK_UPDATED_AT,
        source: 'mock',
        isMock: true,
      });
    }
  }
  return offers;
}

// ---------------------------------------------------------------------------
// Nutrition reference DB: per 100 g approximate values (fixture)
// ---------------------------------------------------------------------------

export const NUTRITION_REFERENCE_SOURCE =
  'Справочные значения (приблизительно), средние по USDA FoodData Central / FSA reference tables. Не являются производственными данными';

const NUTRITION_PER_100G: Array<NutritionPer100g & { ingredientId: string }> = [
  { ingredientId: 'chicken_fillet', calories: 120, protein: 22.5, fat: 1.9, carbs: 0, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'chicken_leg', calories: 158, protein: 19.3, fat: 8.7, carbs: 0, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'beef', calories: 250, protein: 26, fat: 17, carbs: 0, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'pork', calories: 242, protein: 20.7, fat: 17, carbs: 0, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'potatoes', calories: 77, protein: 2.0, fat: 0.1, carbs: 17, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'carrots', calories: 41, protein: 0.9, fat: 0.2, carbs: 10, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'onions', calories: 40, protein: 1.1, fat: 0.1, carbs: 9, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'garlic', calories: 149, protein: 6.4, fat: 0.5, carbs: 33, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'tomato', calories: 18, protein: 0.9, fat: 0.2, carbs: 3.9, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'cucumber', calories: 15, protein: 0.7, fat: 0.1, carbs: 3.6, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'bell_pepper', calories: 26, protein: 1.0, fat: 0.3, carbs: 6, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'cabbage', calories: 25, protein: 1.3, fat: 0.1, carbs: 6, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'cauliflower', calories: 25, protein: 1.9, fat: 0.3, carbs: 5, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'spinach', calories: 23, protein: 2.9, fat: 0.4, carbs: 3.6, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'mushroom', calories: 22, protein: 3.1, fat: 0.3, carbs: 3.3, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'rice', calories: 360, protein: 7.0, fat: 0.6, carbs: 79, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'pasta', calories: 371, protein: 13.0, fat: 1.5, carbs: 74.7, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'buckwheat', calories: 343, protein: 13.3, fat: 3.4, carbs: 71.5, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'oatmeal', calories: 389, protein: 16.9, fat: 6.9, carbs: 66, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'bread', calories: 265, protein: 9.0, fat: 3.2, carbs: 49, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'flour', calories: 364, protein: 10.3, fat: 1.0, carbs: 76, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'eggs', calories: 155, protein: 12.6, fat: 10.6, carbs: 1.1, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'milk', calories: 61, protein: 3.3, fat: 3.6, carbs: 4.7, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'cream', calories: 205, protein: 2.7, fat: 20, carbs: 4, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'sour_cream', calories: 203, protein: 2.6, fat: 20, carbs: 4.5, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'butter', calories: 717, protein: 0.9, fat: 81, carbs: 0.1, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'cheese', calories: 402, protein: 25, fat: 33, carbs: 1.3, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'feta', calories: 264, protein: 14.2, fat: 21, carbs: 4.1, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'cottage_cheese', calories: 121, protein: 17, fat: 5, carbs: 3, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'yogurt', calories: 66, protein: 3.9, fat: 3.2, carbs: 4.6, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'mayo', calories: 680, protein: 1.8, fat: 74, carbs: 2, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'vegetable_oil', calories: 884, protein: 0, fat: 100, carbs: 0, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'olive_oil', calories: 884, protein: 0, fat: 100, carbs: 0, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'sugar', calories: 387, protein: 0, fat: 0, carbs: 100, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'salt', calories: 0, protein: 0, fat: 0, carbs: 0, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'pepper', calories: 251, protein: 10, fat: 3.3, carbs: 64, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'soy_sauce', calories: 53, protein: 8, fat: 0, carbs: 5, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'peanuts', calories: 567, protein: 25.8, fat: 49.2, carbs: 16.1, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'walnuts', calories: 654, protein: 15.2, fat: 65.2, carbs: 13.7, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'almonds', calories: 579, protein: 21.2, fat: 49.9, carbs: 21.6, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'salmon', calories: 142, protein: 19.8, fat: 6.3, carbs: 0, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'cod', calories: 82, protein: 17.8, fat: 0.7, carbs: 0, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'shrimps', calories: 99, protein: 24, fat: 0.3, carbs: 0.2, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'lemon', calories: 29, protein: 1.1, fat: 0.3, carbs: 9.3, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'tomato_paste', calories: 82, protein: 4.3, fat: 0.5, carbs: 18.9, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'herbs', calories: 43, protein: 3.3, fat: 1.1, carbs: 7, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'honey', calories: 304, protein: 0.3, fat: 0, carbs: 82.4, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'apples', calories: 52, protein: 0.3, fat: 0.2, carbs: 14, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'grapes', calories: 69, protein: 0.7, fat: 0.2, carbs: 18, source: NUTRITION_REFERENCE_SOURCE },
];

const NUTRITION_INDEX = new Map(NUTRITION_PER_100G.map((n) => [n.ingredientId, n]));

export function getIngredientNutrition(id: string): NutritionPer100g | null {
  return NUTRITION_INDEX.get(id) ?? null;
}

// ---------------------------------------------------------------------------
// Demo recipe catalogue (dataKind 'fixture' — NOT scraped from any site)
// ---------------------------------------------------------------------------

const FIXTURE_KIND = 'fixture';

export const FIXTURE_RECIPES: Recipe[] = [
  {
    id: 'rcp_omelet',
    name: 'Омлет с молоком',
    category: 'Завтраки',
    baseServings: 2,
    timeMin: 15,
    dataKind: FIXTURE_KIND,
    sourceLabel: 'Демо-каталог',
    ingredients: [
      { ingredientId: 'eggs', qty: 4, unit: 'pcs' },
      { ingredientId: 'milk', qty: 100, unit: 'ml' },
      { ingredientId: 'butter', qty: 15, unit: 'g' },
      { ingredientId: 'salt', qty: 2, unit: 'g' },
      { ingredientId: 'herbs', qty: 5, unit: 'g' },
    ],
    steps: [
      'Яйца взбить с молоком и солью.',
      'Сливочное масло растопить на сковороде.',
      'Влить яичную смесь и жарить под крышкой на слабом огне 7–10 минут.',
      'Посыпать зеленью перед подачей.',
    ],
  },
  {
    id: 'rcp_oatmeal_honey',
    name: 'Овсяная каша с мёдом и орехами',
    category: 'Завтраки',
    baseServings: 2,
    timeMin: 15,
    dataKind: FIXTURE_KIND,
    sourceLabel: 'Демо-каталог',
    ingredients: [
      { ingredientId: 'oatmeal', qty: 200, unit: 'g' },
      { ingredientId: 'milk', qty: 600, unit: 'ml' },
      { ingredientId: 'honey', qty: 40, unit: 'g' },
      { ingredientId: 'walnuts', qty: 30, unit: 'g' },
    ],
    steps: [
      'Хлопья залить молоком и варить 5–7 минут.',
      'Добавить мёд, перемешать.',
      'Подавать, посыпав орехами.',
    ],
  },
  {
    id: 'rcp_syrniki',
    name: 'Сырники со сметаной',
    category: 'Завтраки',
    baseServings: 4,
    timeMin: 40,
    dataKind: FIXTURE_KIND,
    sourceLabel: 'Демо-каталог',
    ingredients: [
      { ingredientId: 'cottage_cheese', qty: 400, unit: 'g' },
      { ingredientId: 'flour', qty: 80, unit: 'g' },
      { ingredientId: 'eggs', qty: 2, unit: 'pcs' },
      { ingredientId: 'sugar', qty: 40, unit: 'g' },
      { ingredientId: 'salt', qty: 2, unit: 'g' },
      { ingredientId: 'vegetable_oil', qty: 30, unit: 'ml' },
      { ingredientId: 'sour_cream', qty: 100, unit: 'g' },
    ],
    steps: [
      'Творог смешать с яйцами, сахаром, солью и мукой.',
      'Сформировать сырники и обжарить на масле по 3–4 минуты с каждой стороны.',
      'Подавать со сметаной.',
    ],
  },
  {
    id: 'rcp_chicken_soup',
    name: 'Суп куриный с лапшой',
    category: 'Супы',
    baseServings: 4,
    timeMin: 60,
    dataKind: FIXTURE_KIND,
    sourceLabel: 'Демо-каталог',
    ingredients: [
      { ingredientId: 'chicken_fillet', qty: 400, unit: 'g' },
      { ingredientId: 'potatoes', qty: 300, unit: 'g' },
      { ingredientId: 'carrots', qty: 120, unit: 'g' },
      { ingredientId: 'onions', qty: 100, unit: 'g' },
      { ingredientId: 'pasta', qty: 120, unit: 'g' },
      { ingredientId: 'vegetable_oil', qty: 20, unit: 'ml' },
      { ingredientId: 'salt', qty: 5, unit: 'g' },
      { ingredientId: 'herbs', qty: 10, unit: 'g' },
    ],
    steps: [
      'Курицу залить водой, довести до кипения, снять пену и варить 20 минут.',
      'Добавить нарезанные картофель, морковь и лук.',
      'Через 10 минут добавить лапшу и варить ещё 7 минут.',
      'Посолить, посыпать зеленью.',
    ],
  },
  {
    id: 'rcp_cheese_soup',
    name: 'Сырный суп',
    category: 'Супы',
    baseServings: 4,
    timeMin: 45,
    dataKind: FIXTURE_KIND,
    sourceLabel: 'Демо-каталог',
    ingredients: [
      { ingredientId: 'potatoes', qty: 400, unit: 'g' },
      { ingredientId: 'carrots', qty: 120, unit: 'g' },
      { ingredientId: 'onions', qty: 100, unit: 'g' },
      { ingredientId: 'cheese', qty: 250, unit: 'g' },
      { ingredientId: 'milk', qty: 400, unit: 'ml' },
      { ingredientId: 'butter', qty: 20, unit: 'g' },
      { ingredientId: 'flour', qty: 40, unit: 'g' },
      { ingredientId: 'salt', qty: 6, unit: 'g' },
      { ingredientId: 'herbs', qty: 10, unit: 'g' },
    ],
    steps: [
      'В кипящую воду добавить картофель, морковь и лук.',
      'Мука с маслом пассеруются, к ним добавляется молоко.',
      'Через 15 минут влить молочную смесь и добавить натёртый сыр.',
      'Варить до растворения сыра, посолить, посыпать зеленью.',
    ],
  },
  {
    id: 'rcp_chicken_plov',
    name: 'Плов с курицей',
    category: 'Основные блюда',
    baseServings: 6,
    timeMin: 90,
    dataKind: FIXTURE_KIND,
    sourceLabel: 'Демо-каталог',
    ingredients: [
      { ingredientId: 'chicken_fillet', qty: 600, unit: 'g' },
      { ingredientId: 'rice', qty: 500, unit: 'g' },
      { ingredientId: 'onions', qty: 250, unit: 'g' },
      { ingredientId: 'carrots', qty: 250, unit: 'g' },
      { ingredientId: 'garlic', qty: 25, unit: 'g' },
      { ingredientId: 'vegetable_oil', qty: 50, unit: 'ml' },
      { ingredientId: 'salt', qty: 8, unit: 'g' },
      { ingredientId: 'pepper', qty: 2, unit: 'g' },
    ],
    steps: [
      'Курицу обжарить на масле, добавить лук и морковь.',
      'Всыпать рис, залить водой на 2 см выше, посолить.',
      'Добавить головку чеснока и тушить под крышкой 25–30 минут.',
    ],
  },
  {
    id: 'rcp_pasta_naval',
    name: 'Макароны по-флотски',
    category: 'Основные блюда',
    baseServings: 4,
    timeMin: 40,
    dataKind: FIXTURE_KIND,
    sourceLabel: 'Демо-каталог',
    ingredients: [
      { ingredientId: 'pasta', qty: 400, unit: 'g' },
      { ingredientId: 'beef', qty: 350, unit: 'g' },
      { ingredientId: 'onions', qty: 150, unit: 'g' },
      { ingredientId: 'vegetable_oil', qty: 30, unit: 'ml' },
      { ingredientId: 'salt', qty: 6, unit: 'g' },
      { ingredientId: 'pepper', qty: 1, unit: 'g' },
    ],
    steps: [
      'Фарш обжарить с луком до готовности, посолить и поперчить.',
      'Отварить макароны до готовности.',
      'Смешать макароны с фаршем и прогреть.',
    ],
  },
  {
    id: 'rcp_buckwheat_mushroom',
    name: 'Гречка с грибами и луком',
    category: 'Основные блюда',
    baseServings: 4,
    timeMin: 45,
    dataKind: FIXTURE_KIND,
    sourceLabel: 'Демо-каталог',
    ingredients: [
      { ingredientId: 'buckwheat', qty: 300, unit: 'g' },
      { ingredientId: 'mushroom', qty: 300, unit: 'g' },
      { ingredientId: 'onions', qty: 120, unit: 'g' },
      { ingredientId: 'garlic', qty: 10, unit: 'g' },
      { ingredientId: 'vegetable_oil', qty: 40, unit: 'ml' },
      { ingredientId: 'salt', qty: 6, unit: 'g' },
    ],
    steps: [
      'Гречку промыть и отварить в подсоленной воде.',
      'Грибы и лук обжарить с чесноком на масле.',
      'Смешать с готовой гречкой и подавать.',
    ],
  },
  {
    id: 'rcp_beef_stew',
    name: 'Говядина тушёная с овощами',
    category: 'Основные блюда',
    baseServings: 6,
    timeMin: 120,
    dataKind: FIXTURE_KIND,
    sourceLabel: 'Демо-каталог',
    ingredients: [
      { ingredientId: 'beef', qty: 450, unit: 'g' },
      { ingredientId: 'potatoes', qty: 500, unit: 'g' },
      { ingredientId: 'carrots', qty: 200, unit: 'g' },
      { ingredientId: 'onions', qty: 150, unit: 'g' },
      { ingredientId: 'tomato_paste', qty: 80, unit: 'g' },
      { ingredientId: 'garlic', qty: 15, unit: 'g' },
      { ingredientId: 'vegetable_oil', qty: 30, unit: 'ml' },
      { ingredientId: 'salt', qty: 8, unit: 'g' },
      { ingredientId: 'pepper', qty: 2, unit: 'g' },
    ],
    steps: [
      'Говядину обжарить на масле до румяной корочки.',
      'Добавить лук, морковь, томатную пасту и потушить 10 минут.',
      'Залить водой, добавить картофель и тушить под крышкой около 1 часа.',
    ],
  },
  {
    id: 'rcp_chicken_cutlets',
    name: 'Котлеты куриные',
    category: 'Основные блюда',
    baseServings: 4,
    timeMin: 60,
    dataKind: FIXTURE_KIND,
    sourceLabel: 'Демо-каталог',
    ingredients: [
      { ingredientId: 'chicken_fillet', qty: 500, unit: 'g' },
      { ingredientId: 'onions', qty: 120, unit: 'g' },
      { ingredientId: 'eggs', qty: 2, unit: 'pcs' },
      { ingredientId: 'bread', qty: 60, unit: 'g' },
      { ingredientId: 'milk', qty: 80, unit: 'ml' },
      { ingredientId: 'flour', qty: 40, unit: 'g' },
      { ingredientId: 'vegetable_oil', qty: 40, unit: 'ml' },
      { ingredientId: 'salt', qty: 6, unit: 'g' },
      { ingredientId: 'pepper', qty: 1, unit: 'g' },
    ],
    steps: [
      'Курицу и лук пропустить через мясорубку.',
      'Хлеб замочить в молоке, добавить в фарш вместе с яйцами, солью и перцем.',
      'Сформировать котлеты, обвалять в муке и обжарить до готовности.',
    ],
  },
  {
    id: 'rcp_baked_fish',
    name: 'Треска запечённая с овощами',
    category: 'Основные блюда',
    baseServings: 4,
    timeMin: 55,
    dataKind: FIXTURE_KIND,
    sourceLabel: 'Демо-каталог',
    ingredients: [
      { ingredientId: 'cod', qty: 500, unit: 'g' },
      { ingredientId: 'potatoes', qty: 400, unit: 'g' },
      { ingredientId: 'carrots', qty: 150, unit: 'g' },
      { ingredientId: 'onions', qty: 100, unit: 'g' },
      { ingredientId: 'lemon', qty: 30, unit: 'g' },
      { ingredientId: 'olive_oil', qty: 25, unit: 'ml' },
      { ingredientId: 'herbs', qty: 10, unit: 'g' },
      { ingredientId: 'salt', qty: 6, unit: 'g' },
    ],
    steps: [
      'Рыбу сбрызнуть лимоном, посолить.',
      'На противень выложить картофель, морковь и лук, сверху — рыбу.',
      'Полить маслом и запекать 35–40 минут при 200 °C.',
    ],
  },
  {
    id: 'rcp_shrimp_rice',
    name: 'Креветки с рисом и чесноком',
    category: 'Основные блюда',
    baseServings: 4,
    timeMin: 35,
    dataKind: FIXTURE_KIND,
    sourceLabel: 'Демо-каталог',
    ingredients: [
      { ingredientId: 'shrimps', qty: 400, unit: 'g' },
      { ingredientId: 'rice', qty: 300, unit: 'g' },
      { ingredientId: 'garlic', qty: 15, unit: 'g' },
      { ingredientId: 'lemon', qty: 20, unit: 'g' },
      { ingredientId: 'soy_sauce', qty: 20, unit: 'ml' },
      { ingredientId: 'vegetable_oil', qty: 25, unit: 'ml' },
      { ingredientId: 'herbs', qty: 10, unit: 'g' },
    ],
    steps: [
      'Рис отварить до готовности.',
      'Креветки обжарить с чесноком на масле 3–4 минуты.',
      'Добавить соевый соус и лимонный сок.',
      'Подавать с рисом, посыпав зеленью.',
    ],
  },
  {
    id: 'rcp_veg_salad',
    name: 'Салат овощной свежий',
    category: 'Салаты',
    baseServings: 4,
    timeMin: 15,
    dataKind: FIXTURE_KIND,
    sourceLabel: 'Демо-каталог',
    ingredients: [
      { ingredientId: 'cucumber', qty: 300, unit: 'g' },
      { ingredientId: 'tomato', qty: 300, unit: 'g' },
      { ingredientId: 'bell_pepper', qty: 150, unit: 'g' },
      { ingredientId: 'onions', qty: 60, unit: 'g' },
      { ingredientId: 'herbs', qty: 15, unit: 'g' },
      { ingredientId: 'olive_oil', qty: 20, unit: 'ml' },
      { ingredientId: 'lemon', qty: 15, unit: 'g' },
      { ingredientId: 'salt', qty: 3, unit: 'g' },
    ],
    steps: [
      'Овощи нарезать произвольно.',
      'Заправить маслом, лимонным соком, посолить.',
      'Посыпать зеленью и перемешать.',
    ],
  },
  {
    id: 'rcp_greek_salad',
    name: 'Салат греческий',
    category: 'Салаты',
    baseServings: 4,
    timeMin: 20,
    dataKind: FIXTURE_KIND,
    sourceLabel: 'Демо-каталог',
    ingredients: [
      { ingredientId: 'tomato', qty: 400, unit: 'g' },
      { ingredientId: 'cucumber', qty: 300, unit: 'g' },
      { ingredientId: 'bell_pepper', qty: 150, unit: 'g' },
      { ingredientId: 'onions', qty: 80, unit: 'g' },
      { ingredientId: 'feta', qty: 150, unit: 'g' },
      { ingredientId: 'olive_oil', qty: 30, unit: 'ml' },
      { ingredientId: 'herbs', qty: 10, unit: 'g' },
      { ingredientId: 'salt', qty: 3, unit: 'g' },
    ],
    steps: [
      'Овощи нарезать крупно, добавить кубики брынзы.',
      'Заправить оливковым маслом, посолить.',
      'Подавать, посыпав зеленью.',
    ],
  },
  {
    id: 'rcp_peanut_cabbage',
    name: 'Салат с арахисом',
    category: 'Салаты',
    baseServings: 4,
    timeMin: 20,
    dataKind: FIXTURE_KIND,
    sourceLabel: 'Демо-каталог',
    ingredients: [
      { ingredientId: 'cabbage', qty: 300, unit: 'g' },
      { ingredientId: 'carrots', qty: 150, unit: 'g' },
      { ingredientId: 'peanuts', qty: 60, unit: 'g' },
      { ingredientId: 'sugar', qty: 10, unit: 'g' },
      { ingredientId: 'salt', qty: 3, unit: 'g' },
      { ingredientId: 'vegetable_oil', qty: 20, unit: 'ml' },
    ],
    steps: [
      'Капусту нашинковать, морковь натереть.',
      'Добавить арахис, сахар, соль и масло.',
      'Перемешать и дать настояться 10 минут.',
    ],
  },
];

export function buildFixtureRecipes(): Recipe[] {
  return FIXTURE_RECIPES;
}