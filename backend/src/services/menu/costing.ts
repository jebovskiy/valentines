import { priceMaxAgeMs } from './config';
import type {
  Ingredient, ProductOffer, RecipeIngredientScaled, ShoppingList, ShoppingListItem,
  StoreId, Unit,
} from './types';
import { round1, round2 } from './scaling';

// ---------------------------------------------------------------------------
// Offer freshness
// ---------------------------------------------------------------------------

export function isFreshOffer(offer: ProductOffer, now: Date = new Date()): boolean {
  const updated = new Date(offer.updatedAt).getTime();
  if (Number.isNaN(updated)) return false;
  const age = now.getTime() - updated;
  return age >= 0 && age <= priceMaxAgeMs();
}

// ---------------------------------------------------------------------------
// Quantity conversions between canonical units and package units
// ---------------------------------------------------------------------------

/**
 * Converts a required quantity to the package's sale unit so costs can be
 * computed fairly. Liquids approximate 1 ml ≈ 1 g; pieces convert via gramsPerPcs.
 * Returns null when the conversion is impossible (no gramsPerPcs).
 */
export function convertQuantity(
  qty: number,
  from: Unit,
  to: Unit,
  gramsPerPcs?: number
): number | null {
  if (from === to) return qty;
  if (from === 'pcs' && to === 'g' && gramsPerPcs) return qty * gramsPerPcs;
  if (from === 'g' && to === 'pcs' && gramsPerPcs) return qty / gramsPerPcs;
  if ((from === 'ml' && to === 'g') || (from === 'g' && to === 'ml')) return qty;
  return null;
}

export interface OfferMatch {
  offer: ProductOffer;
  /** Required quantity re-expressed in the offer's package unit. */
  requiredInOfferUnit: number;
}

/** First fresh offer for the product in the store (deterministic source order). */
export function findOffer(
  scaled: RecipeIngredientScaled,
  offers: ProductOffer[],
  storeId: StoreId,
  now: Date = new Date()
): OfferMatch | null {
  const fresh = offers.find(
    (o) => o.productId === scaled.ingredient.id && o.storeId === storeId && isFreshOffer(o, now)
  );
  if (!fresh) return null;
  const converted = convertQuantity(
    scaled.qty,
    scaled.unit,
    fresh.packageUnit,
    scaled.ingredient.gramsPerPcs
  );
  if (converted === null) return null;
  return { offer: fresh, requiredInOfferUnit: converted };
}

// ---------------------------------------------------------------------------
// Recipe level pricing (proportional, informational)
// ---------------------------------------------------------------------------

export interface RecipePricing {
  /** Sum of price × required qty / package size across all priced ingredients. */
  cost: number;
  /** cost divided by the number of servings this recipe produces. */
  costPerServing: number;
  /** Ingredients that could not be priced in this store (missing or stale price). */
  priceMissing: { ingredientId: string; name: string }[];
  /** How many of the missing entries were due to a stale (old) price. */
  staleMissing: number;
}

export function priceRecipe(
  scaledIngredients: RecipeIngredientScaled[],
  offers: ProductOffer[],
  storeId: StoreId,
  servings: number,
  now: Date = new Date()
): RecipePricing {
  let cost = 0;
  const priceMissing: { ingredientId: string; name: string }[] = [];
  let staleMissing = 0;

  for (const scaled of scaledIngredients) {
    const match = findOffer(scaled, offers, storeId, now);
    if (!match) {
      priceMissing.push({ ingredientId: scaled.ingredient.id, name: scaled.ingredient.name });
      const existsButStale = offers.some(
        (o) => o.productId === scaled.ingredient.id && o.storeId === storeId && !isFreshOffer(o, now)
      );
      if (existsButStale) staleMissing += 1;
      continue;
    }
    const unitPrice = match.offer.packageQuantity > 0 ? match.offer.price / match.offer.packageQuantity : 0;
    cost += match.requiredInOfferUnit * unitPrice;
  }

  const rounded = round2(cost);
  return {
    cost: rounded,
    costPerServing: servings > 0 ? round2(rounded / servings) : 0,
    priceMissing,
    staleMissing,
  };
}

// ---------------------------------------------------------------------------
// Shopping list: merge required quantities, buy whole packages
// ---------------------------------------------------------------------------

export interface ShoppingListInput {
  ingredient: Ingredient;
  qty: number;
  unit: Unit;
}

export function buildShoppingList(
  inputs: ShoppingListInput[],
  offers: ProductOffer[],
  storeId: StoreId,
  now: Date = new Date()
): ShoppingList {
  const merged = new Map<string, ShoppingListInput>();
  for (const input of inputs) {
    const existing = merged.get(input.ingredient.id);
    if (existing) {
      existing.qty = round1(existing.qty + input.qty);
    } else {
      merged.set(input.ingredient.id, { ...input });
    }
  }

  const items: ShoppingListItem[] = [];

  for (const input of merged.values()) {
    const match = findOffer(input, offers, storeId, now);
    if (!match) {
      const anyOffer = offers.find(
        (o) => o.productId === input.ingredient.id && o.storeId === storeId
      );
      const stale = Boolean(anyOffer) && !isFreshOffer(anyOffer!, now);
      items.push({
        ingredientId: input.ingredient.id,
        name: input.ingredient.name,
        requiredQuantity: input.qty,
        requiredUnit: input.unit,
        packageQuantity: 0,
        packageUnit: input.unit,
        purchaseQuantity: 0,
        price: 0,
        unitPrice: 0,
        subtotal: 0,
        currency: 'BYN',
        storeId,
        isMock: Boolean(anyOffer?.isMock),
        source: anyOffer?.source ?? '',
        updatedAt: anyOffer?.updatedAt ?? '',
        missing: true,
        stale,
      });
      continue;
    }

    const offer = match.offer;
    const purchaseQuantity = Math.max(
      1,
      Math.ceil(match.requiredInOfferUnit / offer.packageQuantity - 1e-9)
    );
    const subtotal = round2(purchaseQuantity * offer.price);
    items.push({
      ingredientId: input.ingredient.id,
      name: input.ingredient.name,
      requiredQuantity: input.qty,
      requiredUnit: input.unit,
      packageQuantity: offer.packageQuantity,
      packageUnit: offer.packageUnit,
      purchaseQuantity,
      price: offer.price,
      unitPrice: offer.packageQuantity > 0 ? round2(offer.price / offer.packageQuantity) : 0,
      subtotal,
      currency: 'BYN',
      storeId,
      isMock: offer.isMock,
      source: offer.source,
      updatedAt: offer.updatedAt,
      missing: false,
      stale: false,
    });
  }

  items.sort((a, b) => {
    const byName = a.name.localeCompare(b.name, 'ru');
    if (byName !== 0) return byName;
    return a.ingredientId < b.ingredientId ? -1 : 1;
  });

  const total = round2(items.reduce((sum, item) => sum + item.subtotal, 0));
  return {
    storeId,
    items,
    total,
    missingItemsCount: items.filter((i) => i.missing).length,
    staleItemsCount: items.filter((i) => i.stale).length,
    currency: 'BYN',
  };
}