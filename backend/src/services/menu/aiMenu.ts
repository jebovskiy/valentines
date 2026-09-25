import { randomUUID } from 'node:crypto';
import {
  MENU_AI_FALLBACK_WARNING,
  MENU_AI_MAX_REVISIONS,
  MENU_AI_TIMEOUT_MS,
  MENU_AI_WARNING,
  MENU_DAILY_MEALS,
  MENU_ID_PREFIX,
  MENU_MIN_BUDGET,
  MENU_WEEK_DAYS,
} from './config';
import { buildShoppingList, convertQuantity, isFreshOffer, priceRecipe, type ShoppingListInput } from './costing';
import { MENU_COOKWARE, describeCookware, inferCookware, type CookwareInfo } from './cookware';
import { defaultProviders, type MenuProviders } from './providers';
import { computeRecipeNutrition, perServing } from './nutrition';
import { round1, round2, scaleForServings, servingsBreakdown } from './scaling';
import { getIngredient, getIngredientByName } from './fixtures';
import { ALLERGENS } from './allergens';
import { MEAL_TITLES } from './types';
import { generateMenu, type GenerateMenuOptions } from './planner';
import type {
  AllergenId,
  CookwareId,
  MealId,
  MenuDay,
  MenuGenerationIssue,
  MenuMeal,
  MenuRequest,
  MenuResult,
  ProductOffer,
  Recipe,
  RecipeChoice,
  Store,
  Unit,
} from './types';

export interface GenerateMenuAiOptions extends GenerateMenuOptions {
  /**
   * Injectable per-day LLM for tests/backends: receives the day-scoped prompt
   * and the day index (1..7), returns the raw day JSON text (or null on
   * failure). Defaults to the configured provider via generateStructuredJson.
   */
  generatePlan?: (prompt: string, day: number) => Promise<string | null>;
}

interface AiIngredient {
  name: string;
  qty: number;
  unit: Unit;
}

export interface AiDishPlan {
  name: string;
  ingredients: AiIngredient[];
  steps: string[];
  cookware: CookwareId[];
  nutritionPerServing: { kcal: number; protein: number; fat: number; carbs: number } | null;
}

export interface AiWeekPlan {
  days: { breakfast: AiDishPlan | null; lunch: AiDishPlan | null; dinner: AiDishPlan | null }[];
}

export interface AiDayPlan {
  breakfast: AiDishPlan | null;
  lunch: AiDishPlan | null;
  dinner: AiDishPlan | null;
}

const EPS = 1e-9;
const SLOTS_COUNT = MENU_WEEK_DAYS * MENU_DAILY_MEALS.length;

const UNIT_LABELS: Record<Unit, string> = { g: 'г', ml: 'мл', pcs: 'шт' };

const AI_DISH_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          qty: { type: 'number' },
          unit: { type: 'string', enum: ['g', 'ml', 'pcs'] },
        },
        required: ['name', 'qty', 'unit'],
      },
    },
    steps: { type: 'array', items: { type: 'string' } },
    cookware: {
      type: 'array',
      items: { type: 'string', enum: MENU_COOKWARE.map((c) => c.id) },
    },
    nutritionPerServing: {
      type: 'object',
      properties: {
        kcal: { type: 'number' },
        protein: { type: 'number' },
        fat: { type: 'number' },
        carbs: { type: 'number' },
      },
      required: ['kcal', 'protein', 'fat', 'carbs'],
    },
  },
  required: ['name', 'ingredients', 'steps', 'cookware'],
} as const;

const AI_DAY_SCHEMA = {
  type: 'object',
  properties: {
    breakfast: AI_DISH_SCHEMA,
    lunch: AI_DISH_SCHEMA,
    dinner: AI_DISH_SCHEMA,
  },
  required: ['breakfast', 'lunch', 'dinner'],
} as const;

// ---------------------------------------------------------------------------
// Parsing the LLM response
// ---------------------------------------------------------------------------

function parseAiDay(text: string): AiDayPlan | null {
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim();
  let raw: unknown;
  try {
    raw = JSON.parse(cleaned);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  return {
    breakfast: parseAiDish(o.breakfast),
    lunch: parseAiDish(o.lunch),
    dinner: parseAiDish(o.dinner),
  };
}

function parseAiDish(raw: unknown): AiDishPlan | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const name = typeof o.name === 'string' ? o.name.trim().replace(/\s+/g, ' ') : '';
  if (!name) return null;

  const ingredients: AiIngredient[] = [];
  if (Array.isArray(o.ingredients)) {
    for (const item of o.ingredients) {
      if (!item || typeof item !== 'object') continue;
      const it = item as Record<string, unknown>;
      if (typeof it.name !== 'string') continue;
      const rawQty = it.qty;
      if (typeof rawQty !== 'number' || !Number.isFinite(rawQty) || rawQty <= 0) continue;
      const unit = normalizeAiUnit(it.unit);
      if (!unit) continue;
      ingredients.push({ name: it.name.trim().replace(/\s+/g, ' '), qty: rawQty, unit });
    }
  }

  const steps = Array.isArray(o.steps)
    ? o.steps
        .filter((s): s is string => typeof s === 'string')
        .map((s) => s.trim().replace(/\s+/g, ' '))
        .filter((s) => s.length > 0)
    : [];

  const validCookware = new Set<CookwareId>(MENU_COOKWARE.map((c) => c.id));
  const cookware = Array.isArray(o.cookware)
    ? o.cookware.filter((c): c is CookwareId => typeof c === 'string' && validCookware.has(c as CookwareId))
    : [];

  let nutritionPerServing: AiDishPlan['nutritionPerServing'] = null;
  if (o.nutritionPerServing && typeof o.nutritionPerServing === 'object') {
    const n = o.nutritionPerServing as Record<string, unknown>;
    const val = (v: unknown): number | null =>
      typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
    const kcal = val(n.kcal);
    const protein = val(n.protein);
    const fat = val(n.fat);
    const carbs = val(n.carbs);
    if (kcal !== null && protein !== null && fat !== null && carbs !== null) {
      nutritionPerServing = { kcal, protein, fat, carbs };
    }
  }

  if (ingredients.length === 0) return null;
  return { name, ingredients, steps, cookware, nutritionPerServing };
}

/** Maps free-form units a model may emit to canonical ones (with multipliers). */
function normalizeAiUnit(raw: unknown): Unit | null {
  if (typeof raw !== 'string') return null;
  const u = raw.trim().toLowerCase();
  if (u === 'g' || u === 'г' || u === 'гр' || u === 'грамм' || u === 'граммов') return 'g';
  if (u === 'ml' || u === 'мл' || u === 'миллилитр' || u === 'миллилитров') return 'ml';
  if (u === 'pcs' || u === 'шт' || u === 'штук' || u === 'штука' || u === 'штуки') return 'pcs';
  return null;
}

// ---------------------------------------------------------------------------
// The product list the model is allowed to use (only fresh offers)
// ---------------------------------------------------------------------------

interface CatalogProduct {
  name: string;
  packageQuantity: number;
  packageUnit: Unit;
  price: number;
}

function buildCatalog(offers: ProductOffer[], now: Date): CatalogProduct[] {
  const seen = new Set<string>();
  const out: CatalogProduct[] = [];
  for (const o of offers) {
    if (!isFreshOffer(o, now)) continue;
    if (seen.has(o.productId)) continue;
    seen.add(o.productId);
    const ing = getIngredient(o.productId);
    out.push({
      name: ing ? ing.name : o.productName,
      packageQuantity: o.packageQuantity,
      packageUnit: o.packageUnit,
      price: o.price,
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  return out;
}

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

interface PromptContext {
  request: MenuRequest;
  effectiveServings: number;
  catalog: CatalogProduct[];
}

function formatMoney(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2).replace('.', ',');
}

function allergenTitles(ids: AllergenId[]): string {
  if (ids.length === 0) return 'нет';
  return ids.map((id) => ALLERGENS.find((a) => a.id === id)?.title ?? id).join(', ');
}

/** User's kitchen-equipment set, as short labels for the model. */
function cookwareUserList(ids: CookwareId[]): string {
  if (!ids || ids.length === 0) return 'нет ограничений';
  return ids.map((id) => `«${MENU_COOKWARE.find((c) => c.id === id)?.title ?? id}»`).join(', ');
}

function catalogLines(catalog: CatalogProduct[]): string {
  return catalog
    .map((p) => `- ${p.name} — ${p.packageQuantity} ${UNIT_LABELS[p.packageUnit]} (≈${formatMoney(p.price)} BYN)`)
    .join('\n');
}

function freeTerms(terms?: string[]): string {
  const t = (terms ?? []).filter((x) => x.trim()).map((x) => x.trim().toLowerCase());
  return t.length ? t.join(', ') : 'нет';
}

type BaseRulesScope = { kind: 'week' } | { kind: 'day'; day: number; dayBudget: number };

function baseRules(ctx: PromptContext, scope: BaseRulesScope): string {
  const { request } = ctx;
  const isDay = scope.kind === 'day';
  const intro =
    scope.kind === 'week'
      ? 'Ты — планировщик недельного меню для семьи. Собери меню на 7 дней × (завтрак, обед, ужин) = ровно 21 блюдо, строго под бюджет и ограничения ниже.'
      : `Ты — планировщик недельного меню для семьи. Сейчас ты собираешь день ${scope.day} из ${MENU_WEEK_DAYS} (завтрак, обед, ужин = 3 блюда). Уложи блюда этого дня в дневной бюджет ${formatMoney(scope.dayBudget)} BYN из недельных ${formatMoney(request.budget)} BYN.`;
  const budgetRule = isDay
    ? `1. Дневной бюджет — ${formatMoney(scope.dayBudget)} BYN. Сумма этих 3 блюд (завтрак + обед + ужин) не должна превышать дневной бюджет.`
    : `1. Бюджет — ${formatMoney(request.budget)} BYN на всю неделю вместе с закупкой продуктов. Не превышай.`;
  const uniqueRule = isDay
    ? '5. Названия всех блюд недели должны быть уникальными — не бери название, которое уже использовалось в другой день. Внутри дня все 3 блюда тоже разные.'
    : '5. Подбирай все 21 блюдо, пока весь список не влезет в бюджет. Названия ВСЕХ 21 блюда должны быть уникальными: ни один день и ни один приём пищи не должен повторяться, никаких одинаковых названий дважды за неделю. Приоритет — разнообразие блюд и лёгкость приготовления. Пропусков быть не должно.';
  return `${intro}

ПРАВИЛА:
${budgetRule}
2. Порции: 1 взрослый = 1.0 порции, 1 ребёнок = 0.7 порции. Меню для: ${request.adults} взрослый(ых) и ${request.children} ребёнок/ребёнка = ${ctx.effectiveServings} эффективных порций на приём пищи. Все количества ингредиентов указывай СРАЗУ НА ВСЮ СЕМЬЮ (на одно блюдо — ${ctx.effectiveServings} порций). Нормы на 1 порцию: крупы 60–100 г сухих, мясо/рыба 120–200 г, овощи 100–250 г, яйца 1–2 шт. Пересчитай на семью. «5 г», «10 г» или «0.1 шт» — нереальные количества, не используй их.
3. Запрещённые аллергены — НЕ использовать: ${allergenTitles(request.allergens)}.
4. Нелюбимые продукты — НЕ использовать: ${freeTerms(request.disliked)}.
${uniqueRule}
6. Утварь семьи: ${cookwareUserList(request.cookware ?? [])}. Используй только ту, что есть.
7. Ингредиенты — ТОЛЬКО из «ДОСТУПНЫХ ПРОДУКТОВ» внизу (у каждого реальная цена магазина). Указывай названия ровно как в списке, ничего не придумывай. Цены в ответе НЕ указывай — их посчитает система.
8. Для каждого блюда дай ПОЛНЫЕ пошаговые инструкции приготовления и примерную пищевую ценность на 1 порцию (ккал, белки, жиры, углеводы в г).
9. Каждое блюдо — полноценный приём пищи минимум из 2 ингредиентов (не только гарнир). Блюдо из одного продукта («отварной картофель», «жареный лук») недопустимо: добавь к нему белок, соус или овощи из списка. Яйца указывай в штуках ("pcs").
10. Соль, перец, специи, сахар, растительное масло, уксус, вода и любые приправы в магазине ОТСУТСТВУЮТ — не включай их в "ingredients" вообще. В "ingredients" — только позиции из «ДОСТУПНЫХ ПРОДУКТОВ».`;
}

function dayJsonSpec(): string {
  return `ОТВЕТ — СТРОГО ВАЛИДНЫЙ JSON без markdown-обёртки, по схеме:
{ "breakfast": { "name": "Название блюда", "ingredients": [ { "name": "Куриное филе", "qty": 500, "unit": "g" } ], "steps": ["Шаг 1...", "Шаг 2..."], "cookware": ["skillet"], "nutritionPerServing": { "kcal": 260, "protein": 22, "fat": 10, "carbs": 20 } }, "lunch": { ... }, "dinner": { ... } }
Единицы: "g", "ml", "pcs". Утварь — только id из списка выше. Все 3 приёма пищи этого дня обязательны.`;
}

function buildDayPlanPrompt(ctx: PromptContext, day: number, dayBudget: number, note: string): string {
  const { request } = ctx;
  const parts = [baseRules(ctx, { kind: 'day', day, dayBudget })];
  parts.push(`ДОСТУПНАЯ УТВАРЬ (id: «название»):
${MENU_COOKWARE.map((c: CookwareInfo) => `${c.id}: «${c.title}» — ${c.hint}`).join('\n')}`);
  if (request.customAllergens && request.customAllergens.length > 0) {
    parts.push(`Дополнительные аллергии (свободный текст): ${freeTerms(request.customAllergens)}.`);
  }
  parts.push('ДОСТУПНЫЕ ПРОДУКТЫ (название — фасовка, примерная цена за упаковку):');
  parts.push(catalogLines(ctx.catalog));
  parts.push(dayJsonSpec());
  if (note) parts.push(note);
  return parts.join('\n\n');
}

interface DayReceipt {
  filled: number;
  totalCost: number;
  rejected: SlotBuild[];
  dayBudget: number;
}

function buildDayRevisionPrompt(ctx: PromptContext, day: number, receipt: DayReceipt, note: string): string {
  const overspend = receipt.totalCost > receipt.dayBudget ? round2(receipt.totalCost - receipt.dayBudget) : 0;
  const remaining = receipt.dayBudget > receipt.totalCost ? round2(receipt.dayBudget - receipt.totalCost) : 0;

  const parts = [baseRules(ctx, { kind: 'day', day, dayBudget: receipt.dayBudget })];
  parts.push(`ПЕРЕСБОРКА ДНЯ ${day}:`);
  parts.push(
    `Предыдущая попытка: заполнено ${receipt.filled} из ${MENU_DAILY_MEALS.length} слотов. ` +
      `Стоимость блюд по реальным ценам магазина: ${formatMoney(receipt.totalCost)} BYN при дневном бюджете ${formatMoney(receipt.dayBudget)} BYN ` +
      `(${overspend > 0 ? `перерасход ${formatMoney(overspend)} BYN` : `остаток ${formatMoney(remaining)} BYN`}).`
  );
  if (receipt.rejected.length > 0) {
    const reasons = receipt.rejected
      .map((s) => `${MEAL_TITLES[s.meal]} («${s.dishName}»): ${s.rejection}`)
      .join('; ');
    parts.push(`Отклонённые блюда дня: ${reasons}.`);
  }
  parts.push(
    'Пересобери день: замени дорогие и отклонённые блюда на более дешёвые (меньше дорогого мяса, рыбы, сыров и орехов; больше круп, картофеля, овощей), верни JSON на 3 блюда. Дневной бюджет не превышай. Приоритет — разнообразие и лёгкость приготовления.'
  );
  parts.push(dayJsonSpec());
  if (note) parts.push(note);
  return parts.join('\n\n');
}

// ---------------------------------------------------------------------------
// Mapping a parsed dish to a RecipeChoice (safety + pricing), per slot
// ---------------------------------------------------------------------------

interface SlotBuild {
  day: number;
  meal: MealId;
  dishName: string;
  choice: RecipeChoice | null;
  rejection: string | null;
}

function normalizeExclusions(terms?: string[]): string[] {
  if (!terms) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of terms) {
    const t = raw.trim().toLowerCase();
    if (t.length < 2 || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function mergeIngredients(items: { ingredientId: string; qty: number; unit: Unit }[]): {
  ingredientId: string;
  qty: number;
  unit: Unit;
}[] {
  const merged = new Map<string, { ingredientId: string; qty: number; unit: Unit }>();
  for (const item of items) {
    const key = `${item.ingredientId}:${item.unit}`;
    const ex = merged.get(key);
    if (ex) ex.qty = round1(ex.qty + item.qty);
    else merged.set(key, { ...item });
  }
  return [...merged.values()];
}

async function buildSlot(
  plan: AiDishPlan,
  day: number,
  meal: MealId,
  request: MenuRequest,
  offers: ProductOffer[],
  providers: MenuProviders,
  now: Date
): Promise<SlotBuild> {
  const servings = servingsBreakdown(request.adults, request.children).effectiveServings;
  const customTerms = normalizeExclusions(request.customAllergens);
  const dislikedTerms = normalizeExclusions(request.disliked);
  const base: SlotBuild = { day, meal, dishName: plan.name, choice: null, rejection: null };
  const reject = (reason: string): SlotBuild => ({ ...base, rejection: reason });

  const rawIngredients: { ingredientId: string; qty: number; unit: Unit }[] = [];
  for (const ai of plan.ingredients) {
    const ing = getIngredientByName(ai.name);
    if (!ing) {
      return reject(`ингредиент «${ai.name}» не из списка допустимых`);
    }
    if (ai.unit === ing.unit) {
      rawIngredients.push({ ingredientId: ing.id, qty: ai.qty, unit: ing.unit });
      continue;
    }
    const converted = convertQuantity(ai.qty, ai.unit, ing.unit, ing.gramsPerPcs);
    if (converted === null) {
      return reject(`нельзя перевести единицы ингредиента «${ing.name}»`);
    }
    rawIngredients.push({ ingredientId: ing.id, qty: converted, unit: ing.unit });
  }

  const ingredients = mergeIngredients(rawIngredients);

  const recipe: Recipe = {
    id: `${MENU_ID_PREFIX}-ai-${day}-${meal}`,
    name: plan.name,
    category: MEAL_TITLES[meal],
    baseServings: Math.max(1, servings),
    timeMin: null,
    ingredients,
    steps: plan.steps.length > 0 ? plan.steps : undefined,
    cookware: plan.cookware,
    dataKind: 'ai',
    sourceLabel: 'ИИ',
  };

  const { scaledIngredients, unknownIngredients } = scaleForServings(recipe, servings);

  // Quantity sanity: the model sometimes emits absurd amounts («3 г» of eggs,
  // «5 г» of potatoes); those must not reach pricing.
  for (const scaled of scaledIngredients) {
    if (
      (scaled.unit === 'g' && scaled.qty < 20) ||
      (scaled.unit === 'ml' && scaled.qty < 20) ||
      (scaled.unit === 'pcs' && scaled.qty < 1)
    ) {
      return reject(
        `количество «${scaled.ingredient.name}» ${round1(scaled.qty)} ${UNIT_LABELS[scaled.unit]} — нереально мало для блюда на ${servings} порц.; укажи реальное количество`
      );
    }
  }
  // A dish made of a single garnish (potato, onion, cabbage…) is not a real
  // meal — the observed degenerate output was e.g. «Жареный лук» as a dinner.
  // Grains/eggs/dairy on their own (porridge, omelette) are valid meals.
  const GARNISH_ONLY_IDS = new Set<string>([
    'potatoes',
    'carrots',
    'onions',
    'cabbage',
    'cauliflower',
    'bell_pepper',
    'cucumber',
    'tomato',
    'mushroom',
    'spinach',
    'garlic',
  ]);
  if (scaledIngredients.length === 1 && GARNISH_ONLY_IDS.has(scaledIngredients[0].ingredient.id)) {
    return reject(
      `блюдо состоит из одного гарнира «${scaledIngredients[0].ingredient.name}» — это не полноценный приём пищи; добавь белок или второй продукт из списка`
    );
  }

  const explicitCookware = recipe.cookware ?? [];
  const requiredCookware = [
    ...new Set<CookwareId>([...explicitCookware, ...inferCookware(recipe)]),
  ];

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
    return reject(`содержит аллерген: ${allergenTitles(banned)}`);
  }
  if (unknownIngredients.length > 0) {
    return reject(`ингредиент с неустановленной аллергенностью: ${unknownIngredients.map((u) => u.name).join(', ')}`);
  }
  if (excludedTerms.custom.length > 0) {
    return reject(`содержит аллерген по вашему описанию: ${excludedTerms.custom.join(', ')}`);
  }
  if (excludedTerms.disliked.length > 0) {
    return reject(`содержит нелюбимый продукт: ${excludedTerms.disliked.join(', ')}`);
  }
  if (
    request.cookware &&
    request.cookware.length > 0 &&
    requiredCookware.length > 0 &&
    requiredCookware.some((c) => !request.cookware!.includes(c))
  ) {
    return reject(`требует утварь, которой нет: ${describeCookware(requiredCookware).join(', ')}`);
  }

  const pricing = priceRecipe(scaledIngredients, offers, request.storeId, servings, now);
  if (pricing.priceMissing.length > 0) {
    return reject(`нет цены в магазине: ${pricing.priceMissing.map((m) => m.name).join(', ')}`);
  }

  const nutritionRes = await computeRecipeNutrition(scaledIngredients, providers.nutrition);
  let nutrition: RecipeChoice['nutrition'] = null;
  let nutritionMissing = nutritionRes.missing.length > 0;
  if (!nutritionMissing) {
    nutrition = {
      perRecipe: nutritionRes.perRecipe,
      perServing: perServing(nutritionRes.perRecipe, servings),
    };
  } else if (plan.nutritionPerServing) {
    const p = plan.nutritionPerServing;
    nutrition = {
      perRecipe: {
        calories: round1(p.kcal * servings),
        protein: round1(p.protein * servings),
        fat: round1(p.fat * servings),
        carbs: round1(p.carbs * servings),
      },
      perServing: { calories: p.kcal, protein: p.protein, fat: p.fat, carbs: p.carbs },
    };
    nutritionMissing = false;
  }

  return {
    day,
    meal,
    dishName: plan.name,
    choice: {
      recipe,
      servings,
      scale: 1,
      scaledIngredients,
      cost: pricing.cost,
      costPerServing: pricing.costPerServing,
      priceMissing: pricing.priceMissing,
      nutrition,
      nutritionMissing,
      allergens: [...allergens].sort(),
      allergenUnknown: unknownIngredients.map((u) => u.name),
      cookwareLabels: describeCookware(requiredCookware),
    },
    rejection: null,
  };
}

async function buildSlots(
  plan: AiWeekPlan,
  request: MenuRequest,
  offers: ProductOffer[],
  providers: MenuProviders,
  now: Date
): Promise<SlotBuild[]> {
  const slots: SlotBuild[] = [];
  for (let day = 1; day <= MENU_WEEK_DAYS; day += 1) {
    const dayPlan = plan.days[day - 1];
    for (const meal of MENU_DAILY_MEALS) {
      const dish = dayPlan ? dayPlan[meal] : null;
      if (!dish) {
        slots.push({ day, meal, dishName: '', choice: null, rejection: 'блюдо не указано' });
        continue;
      }
      const built = await buildSlot(dish, day, meal, request, offers, providers, now);
      slots.push(built);
    }
  }
  return slots;
}

function buildReceiptInputs(slots: SlotBuild[]): ShoppingListInput[] {
  const inputs: ShoppingListInput[] = [];
  for (const slot of slots) {
    if (!slot.choice) continue;
    for (const si of slot.choice.scaledIngredients) {
      inputs.push({ ingredient: si.ingredient, qty: si.qty, unit: si.unit });
    }
  }
  return inputs;
}

// ---------------------------------------------------------------------------
// Result assembly (same MenuResult shape as the deterministic planner)
// ---------------------------------------------------------------------------

function assembleResult(
  request: MenuRequest,
  store: Store,
  slots: SlotBuild[],
  shoppingList: ReturnType<typeof buildShoppingList>,
  providers: MenuProviders,
  now: Date,
  effectiveBudget: number,
  extraWarnings: string[] = []
): MenuResult {
  const chosen = slots.filter((s) => s.choice);
  const recipes = chosen.map((s) => s.choice!);

  const days: MenuDay[] = [];
  for (let day = 1; day <= MENU_WEEK_DAYS; day += 1) {
    const meals: MenuMeal[] = [];
    for (const meal of MENU_DAILY_MEALS) {
      const slot = slots.find((s) => s.day === day && s.meal === meal);
      if (slot?.choice) meals.push({ meal, title: MEAL_TITLES[meal], recipe: slot.choice });
    }
    days.push({ day, meals });
  }

  const totalCost = shoppingList.total;
  const recipesCost = round2(recipes.reduce((sum, c) => sum + c.cost, 0));
  const remainingBudget = effectiveBudget > totalCost ? round2(effectiveBudget - totalCost) : 0;
  const overspend = totalCost > effectiveBudget ? round2(totalCost - effectiveBudget) : 0;

  const warnings: string[] = [MENU_AI_WARNING, ...extraWarnings];
  if (providers.prices.isMock) {
    warnings.push('Демо-цены (не реальные): реальные каталоги магазинов пока не подключены');
  }
  const rejected = chosen.length < SLOTS_COUNT ? slots.filter((s) => !s.choice && s.rejection) : [];
  if (rejected.length > 0) {
    const reasons = rejected
      .slice(0, 6)
      .map((s) => `${MEAL_TITLES[s.meal]} · день ${s.day} («${s.dishName}»): ${s.rejection}`)
      .join('; ');
    warnings.push(`Отклонено проверкой безопасности: ${reasons}.`);
  }

  return {
    id: `${MENU_ID_PREFIX}-${randomUUID()}`,
    store,
    request,
    servings: servingsBreakdown(request.adults, request.children),
    days,
    recipes,
    recipesCost,
    totalCost,
    shoppingList,
    budget: round2(effectiveBudget),
    remainingBudget,
    overspend,
    warnings,
    priceSourceLabel: providers.prices.sourceLabel,
    generatedAt: now.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Public entry point with budget-revision loop and deterministic fallback
// ---------------------------------------------------------------------------

export async function generateMenuWithAi(
  request: MenuRequest,
  opts: GenerateMenuAiOptions = {}
): Promise<MenuResult | MenuGenerationIssue> {
  const providers = opts.providers ?? defaultProviders();
  const now = opts.now ?? new Date();

  const store = (await providers.prices.getStores()).find((s) => s.id === request.storeId);
  if (!store) {
    return { code: 'invalid_store', message: 'Выбранный магазин не найден' };
  }

  const effectiveBudget = Math.max(MENU_MIN_BUDGET, request.budget);
  const servings = servingsBreakdown(request.adults, request.children);
  const offers = await providers.prices.getOffers(request.storeId);
  const catalog = buildCatalog(offers, now);
  if (catalog.length === 0) {
    console.warn('[aiMenu] no priceable products in the store, falling back to the deterministic planner');
    return generateMenu(request, opts);
  }

  const llm = opts.generatePlan ?? (async (prompt: string): Promise<string | null> => {
    const { generateStructuredJson: callGeminiJson } = await import('../gemini');
    const { text } = await callGeminiJson(prompt, AI_DAY_SCHEMA, MENU_AI_TIMEOUT_MS, 8_192);
    return text;
  });

  const ctx: PromptContext = {
    request: { ...request, budget: effectiveBudget },
    effectiveServings: servings.effectiveServings,
    catalog,
  };

  const fallback = async (aiAttempted: boolean): Promise<MenuResult | MenuGenerationIssue> => {
    const result = await generateMenu(request, opts);
    if (!aiAttempted || 'code' in result) return result;
    result.warnings = result.warnings ?? [];
    result.warnings.push(MENU_AI_FALLBACK_WARNING);
    return result;
  };

  // Days are generated in parallel — each call only composes «breakfast,
  // lunch, dinner» for one day, so a single request is ~3-4K output tokens
  // instead of up to 16K, and the 7 days run concurrently. Wall-clock per
  // round is bounded by the slowest day, not by the whole week.
  const dayBudget = Math.floor(effectiveBudget / MENU_WEEK_DAYS);
  const plans = new Map<number, AiDayPlan | null>();
  const dayReceipts = new Map<number, DayReceipt>();
  let notes = new Map<number, string>();
  let pending: number[] = Array.from({ length: MENU_WEEK_DAYS }, (_, i) => i + 1);
  let anyParsed = false;

  for (let round = 0; round < MENU_AI_MAX_REVISIONS && pending.length > 0; round += 1) {
    const results = await Promise.all(
      pending.map(async (day) => {
        const prevPlan = plans.get(day) ?? null;
        const dayReceipt = dayReceipts.get(day);
        const prompt = prevPlan && dayReceipt
          ? buildDayRevisionPrompt(ctx, day, dayReceipt, notes.get(day) ?? '')
          : buildDayPlanPrompt(ctx, day, dayBudget, notes.get(day) ?? '');
        let text: string | null;
        try {
          text = await llm(prompt, day);
        } catch {
          text = null;
        }
        return { day, text, prompt };
      })
    );

    if (plans.size === 0 && results.every((r) => r.text == null)) {
      console.warn('[aiMenu] LLM unavailable, falling back to the deterministic planner');
      return fallback(false);
    }

    let progressed = false;
    const escalations = new Map<number, string>();
    for (const { day, text } of results) {
      if (text == null) {
        if (!plans.has(day)) escalations.set(day, 'Сервис не ответил — повтори генерацию дня.');
        continue;
      }
      const parsed = parseAiDay(text);
      if (!parsed) {
        if (!plans.has(day)) {
          escalations.set(day, 'Предыдущий ответ не прошёл валидацию (некорректный JSON). Верни корректный JSON по схеме ниже.');
        }
        continue;
      }
      const prev = plans.get(day) ?? null;
      if (JSON.stringify(parsed) !== JSON.stringify(prev)) progressed = true;
      plans.set(day, parsed);
      anyParsed = true;
    }

    const week: AiWeekPlan = { days: [] };
    for (let d = 1; d <= MENU_WEEK_DAYS; d += 1) {
      week.days.push(plans.get(d) ?? { breakfast: null, lunch: null, dinner: null });
    }
    const slots = await buildSlots(week, { ...request, budget: effectiveBudget }, offers, providers, now);
    const chosen = slots.filter((s) => s.choice);
    const shoppingList = buildShoppingList(buildReceiptInputs(slots), offers, request.storeId, now);
    const totalOver = shoppingList.total > effectiveBudget + EPS;

    dayReceipts.clear();
    for (let d = 1; d <= MENU_WEEK_DAYS; d += 1) {
      const daySlots = slots.filter((s) => s.day === d);
      const dayChosen = daySlots.filter((s) => s.choice);
      dayReceipts.set(d, {
        filled: dayChosen.length,
        totalCost: round2(dayChosen.reduce((sum, s) => sum + s.choice!.cost, 0)),
        rejected: daySlots.filter((s) => !s.choice && s.rejection),
        dayBudget,
      });
    }

    const nameCount = new Map<string, number>();
    for (const s of chosen) nameCount.set(s.dishName, (nameCount.get(s.dishName) ?? 0) + 1);
    const duplicates = [...nameCount].filter(([, count]) => count > 1);

    const accepted = chosen.length === SLOTS_COUNT && !totalOver && duplicates.length === 0;
    console.warn(
      `[aiMenu] round ${round}: filled=${chosen.length}/${SLOTS_COUNT}, total=${formatMoney(shoppingList.total)} BYN / budget ${formatMoney(effectiveBudget)} BYN, duplicates=${duplicates.length}, over=${totalOver}`
    );
    if (accepted) {
      return assembleResult({ ...request, budget: effectiveBudget }, store, slots, shoppingList, providers, now, effectiveBudget);
    }

    // Compute the per-day problems that push the next round.
    const nextPending: number[] = [];
    const nextNotes = new Map<number, string>();
    for (let d = 1; d <= MENU_WEEK_DAYS; d += 1) {
      const daySlots = slots.filter((s) => s.day === d);
      const reasons: string[] = [];
      const escalation = escalations.get(d);
      if (escalation) reasons.push(escalation);
      const dayRejected = daySlots.filter((s) => !s.choice && s.rejection);
      if (dayRejected.length > 0) {
        reasons.push(
          `Отклонено: ${dayRejected
            .map((s) => `${MEAL_TITLES[s.meal]} («${s.dishName}»): ${s.rejection}`)
            .join('; ')}`
        );
      }
      const dayDups = duplicates.filter(([name]) => daySlots.some((s) => s.dishName === name));
      if (dayDups.length > 0) {
        reasons.push(
          `Блюда повторяются: ${dayDups.map(([name, count]) => `«${name}» ×${count}`).join(', ')} — замени повторы на другие названия блюд.`
        );
      }
      const dayCost = dayReceipts.get(d)?.totalCost ?? 0;
      if (totalOver && dayCost > dayBudget + EPS) {
        reasons.push(
          `Перерасход по дню: ${formatMoney(dayCost)} BYN при дневном бюджете ${formatMoney(dayBudget)} BYN — замени дорогие блюда на более дешёвые (меньше мяса, рыбы, сыров и орехов; больше круп, картофеля, овощей).`
        );
      }
      if (reasons.length > 0) {
        nextPending.push(d);
        nextNotes.set(d, reasons.join(' '));
      }
    }
    if (nextPending.length === 0) {
      // Only possible when the package-rounded receipt is over budget while no
      // single day exceeds its share — make the most expensive day cheaper.
      const mostExpensive = [...slots]
        .filter((s) => s.choice)
        .sort((a, b) => b.choice!.cost - a.choice!.cost);
      if (mostExpensive.length > 0) {
        const target = mostExpensive[0].day;
        nextPending.push(target);
        nextNotes.set(target, `Закупка недели не влезает в бюджет ${formatMoney(effectiveBudget)} BYN — удешеви день ${target}: замени дорогие блюда на более дешёвые.`);
      }
    }

    pending = nextPending;
    notes = nextNotes;

    if (!progressed && (round > 0 || plans.size === 0)) {
      console.warn('[aiMenu] LLM keeps repeating the same plan, falling back to the deterministic planner');
      break;
    }
  }

  console.warn('[aiMenu] no full within-budget week from the LLM, falling back to the deterministic planner');
  const lastRejections = [...dayReceipts.values()]
    .flatMap((r) => r.rejected)
    .slice(0, 6)
    .map((s) => `${MEAL_TITLES[s.meal]} день ${s.day} «${s.dishName}»: ${s.rejection}`);
  if (lastRejections.length > 0) {
    console.warn(`[aiMenu] last-round rejection reasons: ${lastRejections.join(' ; ')}`);
  }
  return fallback(anyParsed);
}