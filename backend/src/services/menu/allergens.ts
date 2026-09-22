import type { AllergenId, AllergenInfo } from './types';

export const ALLERGENS: AllergenInfo[] = [
  { id: 'milk', title: 'Молоко и молочные продукты', emoji: '🥛' },
  { id: 'egg', title: 'Яйца', emoji: '🥚' },
  { id: 'peanut', title: 'Арахис', emoji: '🥜' },
  { id: 'tree_nut', title: 'Орехи', emoji: '🌰' },
  { id: 'fish', title: 'Рыба', emoji: '🐟' },
  { id: 'seafood', title: 'Морепродукты', emoji: '🦐' },
  { id: 'soy', title: 'Соя', emoji: '🫘' },
  { id: 'gluten', title: 'Глютен (пшеница)', emoji: '🌾' },
];

export function isAllergenId(value: string): value is AllergenId {
  return (ALLERGENS as { id: string }[]).some((a) => a.id === value);
}

export const ALLERGEN_IDS: AllergenId[] = ALLERGENS.map((a) => a.id);

/**
 * Normalised Russian ingredient-name fragments that link a raw ingredient
 * string to an allergen. This is a curated dictionary (not naive substring
 * matching): e.g. «сливочное масло», «сливки», «молоко», «сыр» all resolve
 * to 'milk' through their canonical fragments below.
 *
 * Matching happens after normalizeName(); fragments are whole-word phrases so
 * «оливковое масло»/«растительное масло» do NOT match any milk fragment.
 */
const ALLERGEN_ALIASES: Record<AllergenId, string[]> = {
  milk: ['молоко', 'молок', 'сливки', 'сливоч', 'сметан', 'творог', 'сыр', 'йогурт', 'кефир', 'ряженк', 'простокваш', 'масло сливочн', 'морожен', 'сгущ'],
  egg: ['яйц', 'яичн', 'меланж', 'майонез'],
  peanut: ['арахис'],
  tree_nut: ['орех', 'миндал', 'фундук', 'кешью', 'фисташ', 'грецк', 'лесной орех'],
  fish: ['рыба', 'рыбн', 'лосос', 'семга', 'форель', 'треск', 'минтай', 'сельд', 'скумбр', 'тунец', 'судак', 'щука', 'икра'],
  seafood: ['кревет', 'морепродукт', 'кальмар', 'миди', 'мидия', 'осьминог', 'краб', 'лангуст', 'гребешок'],
  soy: ['соев', 'соя', 'тофу', 'мисо', 'эдамаме'],
  gluten: ['мука', 'пшениц', 'хлеб', 'булка', 'макарон', 'лапш', 'спагет', 'булгур', 'кускус', 'манк', 'тесто', 'глютен', 'сдобн', 'блин'],
};

/** Lowercase, strip punctuation/digits, collapse whitespace. */
export function normalizeName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[.,;:!?()º°+–—«»"'№-]/g, ' ')
    .replace(/\d+(\.\d+)?/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const ESCAPE = /[.*+?^${}()|[\]\\]/g;

function escapeRegExp(s: string): string {
  return s.replace(ESCAPE, '\\$&');
}

/** Whole-word search of a normalized fragment inside the normalized name. */
function matches(name: string, fragment: string): boolean {
  const re = new RegExp(`\\b${escapeRegExp(fragment)}\\b`, 'i');
  return re.test(name);
}

/**
 * Detect allergens in an arbitrary raw ingredient name using the curated
 * alias dictionary. Deterministic; designed to be conservative.
 */
export function detectAllergens(rawName: string): AllergenId[] {
  const name = normalizeName(rawName);
  if (!name) return [];
  const found: AllergenId[] = [];
  for (const allergen of ALLERGEN_IDS) {
    const aliases = ALLERGEN_ALIASES[allergen];
    if (aliases.some((a) => matches(name, a))) found.push(allergen);
  }
  return found;
}

export interface IngredientAllergenStatus {
  /**
   * true when we are confident about the allergenicity of the ingredient
   * (either it is in our curated catalogue or at least one alias matched).
   */
  known: boolean;
  allergens: AllergenId[];
}

/**
 * Combined classifier: declared catalogue allergens take priority; the alias
 * dictionary is used for arbitrary imported ingredient names. When nothing is
 * known the ingredient is NOT considered safe silently — known=false.
 */
export function classifyIngredient(
  rawName: string,
  declared: AllergenId[] = []
): IngredientAllergenStatus {
  const detected = detectAllergens(rawName);
  const combined = Array.from(new Set([...declared, ...detected]));
  if (combined.length > 0) {
    return { known: true, allergens: combined };
  }
  return { known: false, allergens: [] };
}

export function allergensLabel(allergens: AllergenId[]): string {
  return ALLERGENS.filter((a) => allergens.includes(a.id))
    .map((a) => a.emoji)
    .join(' ');
}