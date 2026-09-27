import type { Nutrition, RecipeIngredientScaled } from './types';
import type { NutritionProvider } from './providers';
import { round1 } from './scaling';

/**
 * Approximate grams-equivalent for nutrition: liquids are 1 ml ≈ 1 g, pieces
 * convert via the ingredient's gramsPerPcs. Returns null when unknown.
 */
export function gramsEquivalent(scaled: RecipeIngredientScaled): number | null {
  if (scaled.unit === 'g' || scaled.unit === 'ml') return scaled.qty;
  return scaled.ingredient.gramsPerPcs ? scaled.qty * scaled.ingredient.gramsPerPcs : null;
}

export interface RecipeNutritionResult {
  perRecipe: Nutrition;
  /** Ingredients for which we lack reference nutrition values. */
  missing: { ingredientId: string; name: string }[];
}

/** Sum per-100g reference values scaled by each ingredient's edible grams. */
export async function computeRecipeNutrition(
  scaledIngredients: RecipeIngredientScaled[],
  nutritionProvider: NutritionProvider
): Promise<RecipeNutritionResult> {
  const totals: Nutrition = { calories: 0, protein: 0, fat: 0, carbs: 0 };
  const missing: { ingredientId: string; name: string }[] = [];

  for (const scaled of scaledIngredients) {
    const grams = gramsEquivalent(scaled);
    const per100g = await nutritionProvider.getPer100g(scaled.ingredient.id, scaled.ingredient.name);
    if (grams === null || grams <= 0 || !per100g) {
      missing.push({ ingredientId: scaled.ingredient.id, name: scaled.ingredient.name });
      continue;
    }
    const factor = grams / 100;
    totals.calories += per100g.calories * factor;
    totals.protein += per100g.protein * factor;
    totals.fat += per100g.fat * factor;
    totals.carbs += per100g.carbs * factor;
  }

  return {
    perRecipe: {
      calories: round1(totals.calories),
      protein: round1(totals.protein),
      fat: round1(totals.fat),
      carbs: round1(totals.carbs),
    },
    missing,
  };
}

/** Divides a per-recipe Nutrition by the servings it produces. */
export function perServing(nutrition: Nutrition, servings: number): Nutrition {
  if (servings <= 0) return { calories: 0, protein: 0, fat: 0, carbs: 0 };
  return {
    calories: round1(nutrition.calories / servings),
    protein: round1(nutrition.protein / servings),
    fat: round1(nutrition.fat / servings),
    carbs: round1(nutrition.carbs / servings),
  };
}

/**
 * Nutrition per 100 g of the prepared dish: the per-recipe totals divided by
 * the dish's edible weight (1 ml ≈ 1 g, pieces via gramsPerPcs), scaled to 100 g.
 * Returns null when any ingredient weight is unknown.
 */
export function per100g(perRecipe: Nutrition, scaledIngredients: RecipeIngredientScaled[]): Nutrition | null {
  let totalGrams = 0;
  for (const scaled of scaledIngredients) {
    const grams = gramsEquivalent(scaled);
    if (grams === null || grams < 0) return null;
    totalGrams += grams;
  }
  if (totalGrams <= 0) return null;
  const factor = 100 / totalGrams;
  return {
    calories: round1(perRecipe.calories * factor),
    protein: round1(perRecipe.protein * factor),
    fat: round1(perRecipe.fat * factor),
    carbs: round1(perRecipe.carbs * factor),
  };
}

export function emptyNutrition(): Nutrition {
  return { calories: 0, protein: 0, fat: 0, carbs: 0 };
}