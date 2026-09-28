import type { AllergenId, AllergenInfo } from './types';

export const ALLERGENS: AllergenInfo[] = [
  { id: 'milk', title: 'Молоко и молочные продукты', emoji: '🥛' },
  { id: 'egg', title: 'Яйца', emoji: '🥚' },
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
  tree_nut: ['орех', 'арахис', 'миндал', 'фундук', 'кешью', 'фисташ', 'грецк', 'лесной орех'],
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

// ---------------------------------------------------------------------------
// Free-text exclusions (custom allergens / dislikes)
// ---------------------------------------------------------------------------

/**
 * Russian inflectional endings stripped when comparing a free-text exclusion
 * with a word from a recipe. Ordered longest-first so «ями» wins over «и».
 */
const RU_ENDINGS = [
  'иями', 'ями', 'ами', 'ыми', 'ими', 'ого', 'его', 'ому', 'ему',
  'ах', 'ях', 'ов', 'ев', 'ей', 'ой', 'ый', 'ий', 'ая', 'яя', 'ое', 'ее',
  'ые', 'ие', 'ем', 'ом', 'ам', 'ям', 'ую', 'юю', 'ью', 'ия', 'ию', 'ье',
  'а', 'я', 'ы', 'и', 'о', 'е', 'у', 'ю', 'ь', 'й',
];

/** Crude but predictable Russian stem: strip the inflectional ending. */
function ruStem(word: string): string {
  for (const ending of RU_ENDINGS) {
    if (word.length - ending.length >= 4 && word.endsWith(ending)) {
      return word.slice(0, word.length - ending.length);
    }
  }
  return word;
}

/** Lowercase, unify ё/е, keep letters only, collapse to a single-spaced string. */
function flattenText(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordsOf(text: string): string[] {
  const flat = flattenText(text);
  return flat.length > 0 ? flat.split(' ') : [];
}

/**
 * True when a single word from a recipe stands for the same product as the
 * exclusion term. Inflected forms are compared by stem, so «печень» matches
 * «печени»/«печёной» and «яблоки» matches «яблоком».
 */
function wordsMatch(termWord: string, candidateWord: string): boolean {
  if (!termWord || !candidateWord) return false;
  if (termWord === candidateWord) return true;
  if (candidateWord.startsWith(termWord) || termWord.startsWith(candidateWord)) return true;
  if (termWord.length < 3 || candidateWord.length < 3) return false;
  const termStem = ruStem(termWord);
  const candidateStem = ruStem(candidateWord);
  if (termStem === candidateStem) return true;
  return candidateStem.startsWith(termStem) || termStem.startsWith(candidateStem);
}

/** Normalize, drop noise and de-duplicate the user's free-text exclusions. */
export function normalizeExclusions(terms?: string[]): string[] {
  if (!terms) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of terms) {
    const t = flattenText(raw);
    if (t.length < 2 || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/**
 * First exclusion term that the given text (ingredient name, dish name or
 * cooking steps) stands for, or null. Whole-phrase substring matching is kept
 * for multi-word terms; single words additionally match by stem so Russian
 * case/number forms are recognized.
 */
export function exclusionTermHit(text: string, terms: string[]): string | null {
  if (terms.length === 0) return null;
  const flat = flattenText(text);
  if (!flat) return null;
  const candidateWords = wordsOf(text);
  for (const term of terms) {
    if (!term) continue;
    if (flat.includes(term)) return term;
    if (term.includes(' ')) continue;
    const termWords = wordsOf(term);
    if (termWords.length !== 1) continue;
    for (const word of candidateWords) {
      if (wordsMatch(termWords[0], word)) return term;
    }
  }
  return null;
}