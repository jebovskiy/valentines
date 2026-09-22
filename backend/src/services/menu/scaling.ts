import { getIngredient } from './fixtures';
import { SERVING_COEFFICIENTS } from './config';
import type {
  Ingredient, Recipe, RecipeIngredientScaled, ServingsBreakdown,
} from './types';

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export interface ScalingResult {
  /** Multiplier applied to the recipe's base quantities. */
  scale: number;
  scaledIngredients: RecipeIngredientScaled[];
  /** Ingredient ids that are not in our curated catalogue of known allergenicity. */
  unknownIngredients: { id: string; name: string }[];
}

/**
 * Weighted servings for the whole family: a child is NOT a full portion.
 * Coefficient source of truth: config.SERVING_COEFFICIENTS (future age tiers).
 */
export function servingsBreakdown(
  adults: number,
  children: number,
  coefficients = SERVING_COEFFICIENTS
): ServingsBreakdown {
  const effectiveServings = adults * coefficients.adult + children * coefficients.child;
  return {
    adults,
    children,
    adultCoefficient: coefficients.adult,
    childCoefficient: coefficients.child,
    effectiveServings: round1(effectiveServings),
  };
}

/**
 * Scales a recipe (written for baseServings portions) to the family's
 * effective servings. Quantities are rounded to 0.1 of a gram/ml/piece.
 * Unknown ingredient ids produce a synthetic Ingredient entry so that the
 * caller can flag allergen uncertainty instead of crashing.
 */
export function scaleForServings(recipe: Recipe, targetServings: number): ScalingResult {
  const base = Math.max(1, recipe.baseServings);
  const scale = targetServings / base;
  const scaledIngredients: RecipeIngredientScaled[] = [];
  const unknownIngredients: { id: string; name: string }[] = [];

  for (const iq of recipe.ingredients) {
    const catalogue = getIngredient(iq.ingredientId);
    let ingredient: Ingredient;
    if (!catalogue) {
      ingredient = {
        id: iq.ingredientId,
        name: iq.ingredientId.replace(/^import:/, ''),
        unit: iq.unit,
        allergens: [],
      };
      unknownIngredients.push({ id: ingredient.id, name: ingredient.name });
    } else {
      ingredient = catalogue;
    }
    scaledIngredients.push({ ingredient, qty: round1(iq.qty * scale), unit: iq.unit });
  }

  return { scale: round3(scale), scaledIngredients, unknownIngredients };
}