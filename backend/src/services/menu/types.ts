/**
 * Domain model for the menu planner.
 *
 * Money is always BYN (see config.ts). Quantities are normalised to three
 * canonical units: grams (g), millilitres (ml) and pieces (pcs). Recipes from
 * any source are converted to these units at ingestion time.
 */

export type AllergenId = 'milk' | 'egg' | 'peanut' | 'tree_nut' | 'fish' | 'seafood' | 'soy' | 'gluten';

export type StoreId = 'euroopt' | 'hippo' | 'green' | 'korona';

export type Unit = 'g' | 'ml' | 'pcs';

/** A slot in the week plan: breakfast / lunch / dinner. */
export type MealId = 'breakfast' | 'lunch' | 'dinner';

export const MEAL_IDS: MealId[] = ['breakfast', 'lunch', 'dinner'];

export const MEAL_TITLES: Record<MealId, string> = {
  breakfast: 'Завтрак',
  lunch: 'Обед',
  dinner: 'Ужин',
};

/** Kitchen equipment the user declares to have; recipes needing the rest are filtered out. */
export type CookwareId =
  | 'skillet'
  | 'pot'
  | 'oven'
  | 'slow_cooker'
  | 'microwave'
  | 'blender'
  | 'air_fryer'
  | 'steamer'
  | 'kettle';

export interface AllergenInfo {
  id: AllergenId;
  title: string;
  emoji: string;
  hint?: string;
}

export interface Store {
  id: StoreId;
  name: string;
  emoji: string;
  description: string;
  /** 'mock' means the current price catalogue is demo data, never real prices. */
  priceCatalog: 'mock' | 'live';
  /**
   * false when the store cannot be used for planning right now (no real price
   * catalogue). The UI renders such stores greyed out and non-clickable.
   */
  available: boolean;
}

export interface Ingredient {
  id: string;
  name: string;
  /** Canonical unit used for quantities of this ingredient. */
  unit: Unit;
  /** Grams per piece, used only for unit === 'pcs'. */
  gramsPerPcs?: number;
  /** Allergens confidently linked to this ingredient (curated). */
  allergens: AllergenId[];
}

export interface ProductOffer {
  /** Linked to the ingredient/product id in our catalogue. */
  productId: string;
  storeId: StoreId;
  productName: string;
  price: number;
  currency: 'BYN';
  packageQuantity: number;
  packageUnit: Unit;
  updatedAt: string;
  /** Source identifier, e.g. 'mock' for demo data. */
  source: string;
  isMock: boolean;
}

export interface Nutrition {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface NutritionPer100g extends Nutrition {
  ingredientId: string;
  /** Provenance of the numbers, e.g. fixture reference DB. */
  source: string;
}

export interface IngredientQty {
  ingredientId: string;
  qty: number;
  unit: Unit;
}

export type RecipeDataKind = 'fixture' | 'russianfood_import' | 'ai';

export interface Recipe {
  id: string;
  name: string;
  category: string;
  /** Number of servings the recipe is written for in the source. */
  baseServings: number;
  timeMin: number | null;
  ingredients: IngredientQty[];
  steps?: string[];
  photoUrl?: string;
  /** Link to the original recipe page. Present only for real imported data. */
  sourceUrl?: string;
  /** Required kitchen equipment; when absent the planner infers it heuristically. */
  cookware?: CookwareId[];
  dataKind: RecipeDataKind;
  sourceLabel: string;
}

export interface ServingCoefficients {
  /** Adult base portion factor. */
  adult: number;
  /**
   * Child portion factor. Configurable; future: make it depend on child age
   * tiers (e.g. 3-6: 0.5, 7-12: 0.75).
   */
  child: number;
}

export interface MenuRequest {
  storeId: StoreId;
  adults: number;
  children: number;
  budget: number;
  currency: 'BYN';
  allergens: AllergenId[];
  /**
   * Free-text allergies typed by the user (e.g. «курица», «консервы»).
   * A recipe is excluded when any of its ingredients' names contains the term.
   */
  customAllergens?: string[];
  /**
   * Products the user dislikes (free text, same matching as customAllergens).
   */
  disliked?: string[];
  /**
   * Kitchen equipment the user has. Empty/undefined disables the cookware
   * filter (every recipe is allowed); otherwise recipes requiring equipment
   * outside this set are excluded.
   */
  cookware?: CookwareId[];
}

export interface ServingsBreakdown {
  adults: number;
  children: number;
  adultCoefficient: number;
  childCoefficient: number;
  effectiveServings: number;
}

export interface RecipeIngredientScaled {
  ingredient: Ingredient;
  qty: number;
  unit: Unit;
}

export interface RecipeChoice {
  recipe: Recipe;
  /** Effective servings produced by this recipe in this menu (adults + children weighted). */
  servings: number;
  /** Multiplier applied to the original ingredient quantities. */
  scale: number;
  scaledIngredients: RecipeIngredientScaled[];
  /** Proportional recipe cost (price × required qty / package size), recalculated on backend. */
  cost: number;
  costPerServing: number;
  /** Missing/unpriced ingredient ids and names for this recipe in the chosen store. */
  priceMissing: { ingredientId: string; name: string }[];
  nutrition: { perRecipe: Nutrition; perServing: Nutrition } | null;
  nutritionMissing: boolean;
  allergens: AllergenId[];
  /** Ingredient names whose allergenicity could not be determined confidently. */
  allergenUnknown: string[];
  /** Inferred kitchen equipment labels (e.g. «🍳 Сковорода») for the recipe. */
  cookwareLabels: string[];
}

export interface ShoppingListItem {
  ingredientId: string;
  name: string;
  /** Sum of scaled quantities required across the selected recipes. */
  requiredQuantity: number;
  requiredUnit: Unit;
  /** Package the store sells the product in. */
  packageQuantity: number;
  packageUnit: Unit;
  /** Number of whole packages to buy (ceil of required/package). */
  purchaseQuantity: number;
  /** Price for one package. */
  price: number;
  /** Price per package unit (g/ml/pcs). */
  unitPrice: number;
  subtotal: number;
  currency: 'BYN';
  storeId: StoreId;
  isMock: boolean;
  source: string;
  updatedAt: string;
  missing: boolean;
  stale: boolean;
}

export interface ShoppingList {
  storeId: StoreId;
  items: ShoppingListItem[];
  /** Real purchase total = sum of package subtotals. */
  total: number;
  missingItemsCount: number;
  staleItemsCount: number;
  currency: 'BYN';
}

export interface MenuMeal {
  meal: MealId;
  title: string;
  recipe: RecipeChoice;
}

export interface MenuDay {
  day: number;
  meals: MenuMeal[];
}

export interface MenuResult {
  id: string;
  store: Store;
  request: MenuRequest;
  servings: ServingsBreakdown;
  /** The week plan: 7 days × breakfast/lunch/dinner. Also mirrored in `recipes`. */
  days: MenuDay[];
  recipes: RecipeChoice[];
  /** Sum of proportional recipe costs (informational). */
  recipesCost: number;
  /** Real purchase total based on packages — always ≤ budget. */
  totalCost: number;
  shoppingList: ShoppingList;
  budget: number;
  remainingBudget: number;
  overspend: number;
  warnings: string[];
  /** Source label of the price catalogue used (mock = demo prices). */
  priceSourceLabel: string;
  generatedAt: string;
}

export type MenuGenerationIssue =
  | { code: 'invalid_store'; message: string }
  | { code: 'no_recipes'; message: string }
  | { code: 'empty_catalog'; message: string };

export interface CostedRecipe {
  choice: RecipeChoice;
  /** true when every ingredient has an available, fresh price in the store. */
  fullyPriced: boolean;
  /** Score used for deterministic ranking (higher is better). */
  score: number;
  /** Reason the recipe was skipped, if it was. */
  rejectedReason?: string;
}