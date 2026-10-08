import { randomUUID } from 'node:crypto';
import {
  MENU_AI_FALLBACK_WARNING,
  MENU_AI_MAX_REVISIONS,
  MENU_AI_TIMEOUT_MS,
  MENU_AI_WARNING,
  MENU_BUDGET_OVERSHOOT_TOLERANCE,
  MENU_DAILY_MEALS,
  MENU_ID_PREFIX,
  MENU_MAX_RECIPE_REPEATS,
  MENU_MAX_UNPRICED_INGREDIENTS,
  MENU_WEEK_DAYS,
  minBudgetFor,
} from './config';
import { buildShoppingList, convertQuantity, isFreshOffer, priceRecipe, type ShoppingListInput } from './costing';
import { MENU_COOKWARE, describeCookware, inferCookware, type CookwareInfo } from './cookware';
import { defaultProviders, type MenuProviders } from './providers';
import { computeRecipeNutrition, per100g, perServing } from './nutrition';
import { mealServings, round1, round2, scaleForServings, servingsBreakdown } from './scaling';
import { getIngredient, getIngredientByName } from './fixtures';
import { ALLERGENS, exclusionTermHit, normalizeExclusions } from './allergens';
import { MEAL_COMPONENT_TITLES, MEAL_TITLES } from './types';
import { generateMenu, makeMenuServings, rolesForMeal, type GenerateMenuOptions } from './planner';
import type {
  AllergenId,
  CookwareId,
  MealComponentId,
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
  days: AiDayPlan[];
}

export interface AiDayPlan {
  breakfast: AiDishPlan | null;
  lunch: Partial<Record<MealComponentId, AiDishPlan | null>>;
  dinner: Partial<Record<MealComponentId, AiDishPlan | null>>;
}

const EPS = 1e-9;

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

/** JSON output schema for one day, shaped by the request's meal composition. */
function buildDaySchema(request: MenuRequest, perMeal: Record<MealId, number>) {
  const rolesOf = (meal: MealId) => rolesForMeal(request, meal, perMeal);
  const mealKey = (meal: MealId, roles: MealComponentId[]) => {
    if (roles.length <= 1) return AI_DISH_SCHEMA;
    return {
      type: 'object',
      properties: Object.fromEntries(roles.map((r) => [r, AI_DISH_SCHEMA])),
      required: roles,
    };
  };
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  if (perMeal.breakfast > 0) {
    properties.breakfast = AI_DISH_SCHEMA;
    required.push('breakfast');
  }
  if (perMeal.lunch > 0) {
    properties.lunch = mealKey('lunch', rolesOf('lunch'));
    required.push('lunch');
  }
  if (perMeal.dinner > 0) {
    properties.dinner = mealKey('dinner', rolesOf('dinner'));
    required.push('dinner');
  }
  return { type: 'object', properties, required };
}

// ---------------------------------------------------------------------------
// Parsing the LLM response
// ---------------------------------------------------------------------------

function parseAiDay(text: string, request: MenuRequest, perMeal: Record<MealId, number>): AiDayPlan | null {
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim();
  let raw: unknown;
  try {
    raw = JSON.parse(cleaned);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;

  const plan: AiDayPlan = { breakfast: null, lunch: {}, dinner: {} };
  if (perMeal.breakfast > 0) plan.breakfast = parseAiDish(o.breakfast);
  plan.lunch = parseMealDishes(o.lunch, rolesForMeal(request, 'lunch', perMeal));
  plan.dinner = parseMealDishes(o.dinner, rolesForMeal(request, 'dinner', perMeal));
  return plan;
}

/** Rolls up the per-role dishes of a meal (single role → the dish itself). */
function parseMealDishes(raw: unknown, roles: MealComponentId[]): Partial<Record<MealComponentId, AiDishPlan | null>> {
  const out: Partial<Record<MealComponentId, AiDishPlan | null>> = {};
  if (roles.length === 0) return out;
  if (roles.length === 1) {
    const dish = parseAiDish(raw);
    if (dish) out[roles[0]] = dish;
    return out;
  }
  if (!raw || typeof raw !== 'object') return out;
  const rec = raw as Record<string, unknown>;
  for (const role of roles) {
    const dish = parseAiDish(rec[role]);
    if (dish) out[role] = dish;
  }
  return out;
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
  perMeal: Record<MealId, number>;
  catalog: CatalogProduct[];
}

/** Component label of a dish inside a meal (breakfast's single dish reads «Блюдо»). */
function componentTitle(meal: MealId, role: MealComponentId): string {
  if (meal === 'breakfast' && role === 'main') return 'Блюдо';
  return MEAL_COMPONENT_TITLES[role];
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

/** Non-binding weekly variety hints keyed by day number (1..7). */
const WEEK_VARIETY_HINTS: Record<number, string> = {
  1: 'день 1: предпочти птицу (курица/индейка/утка) и крупу/картофель',
  2: 'день 2: предпочти рыбу (треска, форель, минтай, скумбрия, сельдь)',
  3: 'день 3: предпочти мясо (говядина/свинина) или бобовые (горох, фасоль, чечевица)',
  4: 'день 4: предпочти творог/сыр или яйца (сырники, омлет, запеканка)',
  5: 'день 5: предпочти субпродукты/курицу и овощные блюда',
  6: 'день 6: предпочти рыбу или бобовые и овощи',
  7: 'день 7: лёгкий день — молочное, яйца, овощи, крупы',
};

function catalogLines(catalog: CatalogProduct[]): string {
  return catalog
    .map((p) => `- ${p.name} — ${p.packageQuantity} ${UNIT_LABELS[p.packageUnit]} (≈${formatMoney(p.price)} BYN)`)
    .join('\n');
}

function freeTerms(terms?: string[]): string {
  const t = (terms ?? []).filter((x) => x.trim()).map((x) => x.trim().toLowerCase());
  return t.length ? t.join(', ') : 'нет';
}

/** «завтрак — 1 блюдо; обед — 3 блюда (суп, основное, салат); ужин — 2 блюда» */
function mealComposition(ctx: PromptContext): string {
  const { request, perMeal } = ctx;
  const rolesOf = (meal: MealId) => rolesForMeal(request, meal, perMeal);
  const parts: string[] = [];
  if (perMeal.breakfast > 0) parts.push(`завтрак — 1 блюдо`);
  if (perMeal.lunch > 0) {
    const roles = rolesOf('lunch');
    parts.push(`обед — ${roles.length} блюд(а) (${roles.map((r) => MEAL_COMPONENT_TITLES[r].toLowerCase()).join(', ')})`);
  }
  if (perMeal.dinner > 0) {
    const roles = rolesOf('dinner');
    parts.push(`ужин — ${roles.length} блюд(а) (${roles.map((r) => MEAL_COMPONENT_TITLES[r].toLowerCase()).join(', ')})`);
  }
  return parts.join('; ');
}

function dishesPerDayOf(ctx: PromptContext): number {
  const { request, perMeal } = ctx;
  return (
    (perMeal.breakfast > 0 ? 1 : 0) +
    rolesForMeal(request, 'lunch', perMeal).length +
    rolesForMeal(request, 'dinner', perMeal).length
  );
}

type BaseRulesScope = { kind: 'week' } | { kind: 'day'; day: number; dayBudget: number };

function baseRules(ctx: PromptContext, scope: BaseRulesScope): string {
  const { request, perMeal } = ctx;
  const isDay = scope.kind === 'day';
  const dishesPerDay = dishesPerDayOf(ctx);
  const totalDishes = MENU_WEEK_DAYS * dishesPerDay;
  const intro =
    scope.kind === 'week'
      ? `Ты — планировщик недельного меню для семьи. Собери меню на ${MENU_WEEK_DAYS} дней: каждый день состоит из ${dishesPerDay} блюд(а) — ${mealComposition(ctx)}. Итого ${totalDishes} блюд на неделю, строго под бюджет и ограничения ниже.`
      : `Ты — планировщик недельного меню для семьи. Сейчас ты собираешь день ${scope.day} из ${MENU_WEEK_DAYS}: ${dishesPerDay} блюд(а) — ${mealComposition(ctx)}. Уложи блюда этого дня в дневной бюджет ${formatMoney(scope.dayBudget)} BYN из недельных ${formatMoney(request.budget)} BYN.`;
  const budgetRule = isDay
    ? `1. Дневной бюджет — ${formatMoney(scope.dayBudget)} BYN. Распредели сумму между приёмами неравномерно: завтрак ≈ 20%, обед ≈ 40%, ужин ≈ 40%. Сумма блюд этого дня не должна превышать дневной бюджет.`
    : `1. Бюджет — ${formatMoney(request.budget)} BYN на всю неделю вместе с закупкой продуктов. Не превышай.`;
  const uniqueRule = isDay
    ? '5. Внутри дня все блюда должны различаться. Повторять блюдо с другого дня недели можно, но не более 2 раз за всю неделю.'
    : '5. Внутри дня все блюда должны различаться. Повторять блюдо в другой день можно, но не более 2 раз за всю неделю. Приоритет — разнообразие блюд и лёгкость приготовления. Пропусков быть не должно.';
  return `${intro}

ПРАВИЛА:
${budgetRule}
2. Порции: 1 взрослый = 1.0 порции, 1 ребёнок = 0.7 порции. Семья: ${request.adults} взрослый(ых) и ${request.children} ребёнок/ребёнка. Порций на приём: завтрак — ${perMeal.breakfast}, обед — ${perMeal.lunch}, ужин — ${perMeal.dinner}. Все количества ингредиентов указывай СРАЗУ НА ВСЮ СЕМЬЮ (каждое блюдо готовится на число порций своего приёма). Нормы на 1 порцию: крупы 60–100 г сухих, мясо/рыба 120–200 г, овощи 100–250 г, яйца 1–2 шт. Пересчитай на семью. Приправы/масло/сахар допустимы малыми количествами (5–20 г на блюдо) — система их не отбракует. Но «0.1 шт» яиц или «3 г» мяса — нереально, не используй.
3. Запрещённые аллергены — НЕ использовать: ${allergenTitles(request.allergens)}.
4. Нелюбимые продукты — НЕ использовать: ${freeTerms(request.disliked)}.
${uniqueRule}
6. Утварь семьи: ${cookwareUserList(request.cookware ?? [])}. Используй только ту, что есть.
7. Ингредиенты — ТОЛЬКО из «ДОСТУПНЫХ ПРОДУКТОВ» внизу (у каждого реальная цена магазина). Указывай названия ровно как в списке, ничего не придумывай. Цены в ответе НЕ указывай — их посчитает система.
8. Для каждого блюда дай ПОЛНЫЕ пошаговые инструкции приготовления и примерную пищевую ценность на 1 порцию (ккал, белки, жиры, углеводы в г).
9. Основное блюдо (main) — полноценный приём минимум из 2 ингредиентов (не только гарнир): добавь к нему белок, соус или овощи из списка. Гарнир (side), наоборот, должен быть простым — крупа, картофель или макароны, можно из одного ингредиента. Яйца указывай в штуках ("pcs").
10. В "ingredients" — ТОЛЬКО позиции из «ДОСТУПНЫХ ПРОДУКТОВ» ниже, названия копируй из списка дословно. Соль, сахар, растительное масло, оливковое масло, уксус, мука, молоко и яйца ЕСТЬ в списке — бери их оттуда. В списке ОТСУТСТВУЮТ: перец (чёрный/молотый), специи и приправы, томатная паста, подсолнечное масло, соевый соус, куриная голень, сёмга/лосось, йогурт, семена чиа/кунжут, каперсы — их не включай. Вода не считается ингредиентом — не указывай её.
11. Если рецепту нужен продукт, которого НЕТ в списке (например, пшено, кабачок, банан, фарш, кабачки) — замени его похожим доступным продуктом из списка (крупа вместо пшена, морковь/овощи вместо кабачка, куриная голень или куриное филе вместо фарша, яблоко вместо банана). Никогда не выдумывай названия, которых нет в списке.`;
}

/** Example of the day JSON, ring-fenced to the request's actual roles. */
function dayJsonSpec(ctx: PromptContext): string {
  const { request, perMeal } = ctx;
  const rolesOf = (meal: MealId) => rolesForMeal(request, meal, perMeal);
  const roleExample = (roles: MealComponentId[]): string =>
    roles.length <= 1
      ? '{ "name": "Название блюда", "ingredients": [ { "name": "Куриное филе", "qty": 500, "unit": "g" } ], "steps": ["Шаг 1...", "Шаг 2..."], "cookware": ["skillet"], "nutritionPerServing": { "kcal": 260, "protein": 22, "fat": 10, "carbs": 20 } }'
      : `{ ${roles.map((r) => `"${r}": { "name": "Название блюда", "ingredients": [ { "name": "Куриное филе", "qty": 500, "unit": "g" } ], "steps": ["Шаг 1..."], "cookware": ["skillet"], "nutritionPerServing": { "kcal": 260, "protein": 22, "fat": 10, "carbs": 20 } }`).join(', ')} }`;
  const fields: string[] = [];
  if (perMeal.breakfast > 0) fields.push(`"breakfast": ${roleExample(['main'])}`);
  if (perMeal.lunch > 0) fields.push(`"lunch": ${roleExample(rolesOf('lunch'))}`);
  if (perMeal.dinner > 0) fields.push(`"dinner": ${roleExample(rolesOf('dinner'))}`);
  return `ОТВЕТ — СТРОГО ВАЛИДНЫЙ JSON без markdown-обёртки, по схеме:
{ ${fields.join(', ')} }
Единицы: "g", "ml", "pcs". Утварь — только id из списка выше. Каждый приём пищи дня обязателен; в многосоставных обеде/ужине — строго по одной составляющей на выбранный ключ.
Составляющие (ключи): суп = soup, основное = main, гарнир = side, салат = salad, десерт = dessert.`;
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
  const hint = WEEK_VARIETY_HINTS[day];
  if (hint) parts.push(`Разнообразие недели (рекомендация, не строго): ${hint}.`);
  parts.push(dayJsonSpec(ctx));
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
  const dishesPerDay = dishesPerDayOf(ctx);

  const parts = [baseRules(ctx, { kind: 'day', day, dayBudget: receipt.dayBudget })];
  parts.push(`ПЕРЕСБОРКА ДНЯ ${day}:`);
  parts.push(
    `Предыдущая попытка: заполнено ${receipt.filled} из ${dishesPerDay} слотов. ` +
      `Стоимость блюд по реальным ценам магазина: ${formatMoney(receipt.totalCost)} BYN при дневном бюджете ${formatMoney(receipt.dayBudget)} BYN ` +
      `(${overspend > 0 ? `перерасход ${formatMoney(overspend)} BYN` : `остаток ${formatMoney(remaining)} BYN`}).`
  );
  if (receipt.rejected.length > 0) {
    const reasons = receipt.rejected
      .map((s) => `${MEAL_TITLES[s.meal]} · ${componentTitle(s.meal, s.role)} («${s.dishName}»): ${s.rejection}`)
      .join('; ');
    parts.push(`Отклонённые блюда дня: ${reasons}.`);
  }
  parts.push(
    `Пересобери день: замени дорогие и отклонённые блюда на более дешёвые (меньше дорогого мяса, рыбы, сыров и орехов; больше круп, картофеля, овощей), верни JSON на ${dishesPerDay} блюд этого дня. Дневной бюджет не превышай. Приоритет — разнообразие и лёгкость приготовления.`
  );
  parts.push(dayJsonSpec(ctx));
  if (note) parts.push(note);
  return parts.join('\n\n');
}

// ---------------------------------------------------------------------------
// Mapping a parsed dish to a RecipeChoice (safety + pricing), per slot
// ---------------------------------------------------------------------------

interface SlotBuild {
  day: number;
  meal: MealId;
  role: MealComponentId;
  dishName: string;
  choice: RecipeChoice | null;
  rejection: string | null;
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
  role: MealComponentId,
  request: MenuRequest,
  perMeal: Record<MealId, number>,
  offers: ProductOffer[],
  providers: MenuProviders,
  now: Date
): Promise<SlotBuild> {
  const servings = Math.max(1, perMeal[meal]);
  const customTerms = normalizeExclusions(request.customAllergens);
  const dislikedTerms = normalizeExclusions(request.disliked);
  const base: SlotBuild = { day, meal, role, dishName: plan.name, choice: null, rejection: null };
  const reject = (reason: string): SlotBuild => ({ ...base, rejection: reason });

  const rawIngredients: { ingredientId: string; qty: number; unit: Unit }[] = [];
  const unknownNames: string[] = [];
  for (const ai of plan.ingredients) {
    const ing = getIngredientByName(ai.name);
    if (!ing) {
      unknownNames.push(ai.name);
      continue;
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

  if (rawIngredients.length === 0) {
    return reject(
      `ни один ингредиент не найден в списке допустимых (${
        unknownNames.length > 0 ? unknownNames.join(', ') : 'пустой список ингредиентов'
      })`
    );
  }

  const ingredients = mergeIngredients(rawIngredients);

  const recipe: Recipe = {
    id: `${MENU_ID_PREFIX}-ai-${day}-${meal}-${role}`,
    name: plan.name,
    category: MEAL_TITLES[meal],
    baseServings: Math.max(1, servings),
    timeMin: null,
    ingredients,
    steps: plan.steps.length > 0 ? plan.steps : undefined,
    cookware: plan.cookware,
    dataKind: 'ai',
    sourceLabel: 'Подбор',
  };

  const { scaledIngredients, unknownIngredients } = scaleForServings(recipe, servings);

  // No per-gram floor: tiny quantities are legitimate for seasoning («1 г»
  // соли, «8 г» сахара). Structural sanity is enforced at parse time (every
  // quantity must be a finite positive number), and the garnish-only guard
  // below keeps degenerate meals out without judging ingredient weights.

  // A dish made of a single garnish (potato, onion, cabbage…) is not a real
  // meal — the observed degenerate output was e.g. «Жареный лук» as a dinner.
  // Grains/eggs/dairy on their own (porridge, omelette) are valid meals.
  // A «side» role (гарнир) is legitimately a single garnish — allowed.
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
  const allowGarnishOnly = role === 'side';
  if (!allowGarnishOnly && scaledIngredients.length === 1 && GARNISH_ONLY_IDS.has(scaledIngredients[0].ingredient.id)) {
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
    const customHit = exclusionTermHit(scaled.ingredient.name, customTerms);
    if (customHit) excludedTerms.custom.push(`${scaled.ingredient.name} (${customHit})`);
    const dislikedHit = exclusionTermHit(scaled.ingredient.name, dislikedTerms);
    if (dislikedHit) excludedTerms.disliked.push(`${scaled.ingredient.name} (${dislikedHit})`);
  }
  /** Record the first reason per kind so the model is told about the real cause. */
  const noteHit = (text: string, label: string, terms: string[], kind: 'custom' | 'disliked'): void => {
    if (excludedTerms[kind].length > 0) return;
    const hit = exclusionTermHit(text, terms);
    if (hit) excludedTerms[kind].push(`${label} (${hit})`);
  };
  noteHit(recipe.name, `название блюда «${recipe.name}»`, customTerms, 'custom');
  noteHit(recipe.name, `название блюда «${recipe.name}»`, dislikedTerms, 'disliked');
  if (plan.steps.length > 0) {
    const stepsText = plan.steps.join(' ');
    noteHit(stepsText, 'шаги приготовления', customTerms, 'custom');
    noteHit(stepsText, 'шаги приготовления', dislikedTerms, 'disliked');
  }
  // An ingredient the catalogue does not know is dropped from the dish, so it
  // never reaches the shopping list — yet the model still cooks with it. The
  // raw name is checked here so «Овсяная каша с яблоками» cannot survive an
  // apple exclusion just because the model wrote «Яблоко» instead of «Яблоки».
  for (const rawName of unknownNames) {
    noteHit(rawName, `ингредиент «${rawName}» вне каталога`, customTerms, 'custom');
    noteHit(rawName, `ингредиент «${rawName}» вне каталога`, dislikedTerms, 'disliked');
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
  const hasPricedBase = scaledIngredients.length - pricing.priceMissing.length > 0;
  if (pricing.priceMissing.length > MENU_MAX_UNPRICED_INGREDIENTS || !hasPricedBase) {
    return reject(`нет цены в магазине: ${pricing.priceMissing.map((m) => m.name).join(', ')}`);
  }

  const nutritionRes = await computeRecipeNutrition(scaledIngredients, providers.nutrition);
  let nutrition: RecipeChoice['nutrition'] = null;
  let nutritionMissing = nutritionRes.missing.length > 0;
  if (!nutritionMissing) {
    const p100g = per100g(nutritionRes.perRecipe, scaledIngredients);
    nutrition = {
      perRecipe: nutritionRes.perRecipe,
      perServing: perServing(nutritionRes.perRecipe, servings),
      ...(p100g ? { per100g: p100g } : {}),
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
    role,
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
  perMeal: Record<MealId, number>,
  offers: ProductOffer[],
  providers: MenuProviders,
  now: Date
): Promise<SlotBuild[]> {
  const slots: SlotBuild[] = [];
  for (let day = 1; day <= MENU_WEEK_DAYS; day += 1) {
    const dayPlan = plan.days[day - 1];
    for (const meal of MENU_DAILY_MEALS) {
      for (const role of rolesForMeal(request, meal, perMeal)) {
        const dish =
          meal === 'breakfast' ? (role === 'main' ? dayPlan.breakfast : null) : dayPlan[meal][role] ?? null;
        if (!dish) {
          slots.push({ day, meal, role, dishName: '', choice: null, rejection: 'блюдо не указано' });
          continue;
        }
        const built = await buildSlot(dish, day, meal, role, request, perMeal, offers, providers, now);
        slots.push(built);
      }
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
  perMeal: Record<MealId, number>,
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
      const mealSlots = slots.filter((s) => s.day === day && s.meal === meal);
      const components = mealSlots
        .filter((s) => s.choice)
        .map((s) => ({ role: s.role, title: componentTitle(meal, s.role), recipe: s.choice! }));
      if (components.length > 0) meals.push({ meal, title: MEAL_TITLES[meal], components });
    }
    if (meals.length > 0) days.push({ day, meals });
  }

  const totalCost = shoppingList.total;
  const recipesCost = round2(recipes.reduce((sum, c) => sum + c.cost, 0));
  const budget = round2(request.budget);
  const remainingBudget = budget > totalCost ? round2(budget - totalCost) : 0;
  const overspend = totalCost > budget ? round2(totalCost - budget) : 0;

  const slotsCount = 7 * dishesPerDayOf({ request, perMeal, catalog: [] });
  const warnings: string[] = [MENU_AI_WARNING, ...extraWarnings];
  if (effectiveBudget > request.budget) {
    warnings.push(`Минимальный бюджет для подбора при вашем составе семьи — ${formatMoney(effectiveBudget)} BYN. Подбор вёлся по нему, а в отчёте показан ваш бюджет ${formatMoney(request.budget)} BYN — чек может превысить его.`);
  }
  if (providers.prices.isMock) {
    warnings.push('Демо-цены (не реальные): реальные каталоги магазинов пока не подключены');
  }
  const missingSlots = slots.filter((s) => !s.choice);
  const rejected = chosen.length < slotsCount ? missingSlots.filter((s) => s.rejection) : [];
  if (rejected.length > 0) {
    const reasons = rejected
      .slice(0, 6)
      .map((s) => `${MEAL_TITLES[s.meal]} · ${componentTitle(s.meal, s.role)} · день ${s.day} («${s.dishName}»): ${s.rejection}`)
      .join('; ');
    warnings.push(`Отклонено проверкой безопасности: ${reasons}.`);
    if (missingSlots.some((s) => !s.rejection)) {
      warnings.push(`Не все составляющие приёмов заполнены — проверьте их в меню.`);
    }
  }
  const unpriced = new Set<string>();
  for (const r of recipes) for (const m of r.priceMissing) unpriced.add(m.name);
  if (unpriced.size > 0) {
    const list = [...unpriced].slice(0, 6).join(', ');
    warnings.push(`Цены нет для: ${list}. Эти блюда оставлены, но их стоимость и БЖУ приблизительны — эти продукты не входят в чек.`);
  }

  return {
    id: `${MENU_ID_PREFIX}-${randomUUID()}`,
    store,
    request,
    servings: makeMenuServings(request, perMeal),
    days,
    recipes,
    recipesCost,
    totalCost,
    shoppingList,
    budget: round2(request.budget),
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

  const perMeal = mealServings(request);
  const servings = servingsBreakdown(request.adults, request.children);
  const dishesPerDay = dishesPerDayOf({ request, perMeal, catalog: [] });
  const slotsCount = MENU_WEEK_DAYS * dishesPerDay;
  const effectiveBudget = Math.max(minBudgetFor(servings.effectiveServings, dishesPerDay), request.budget);
  const offers = await providers.prices.getOffers(request.storeId);
  const catalog = buildCatalog(offers, now);
  if (catalog.length === 0) {
    console.warn('[aiMenu] no priceable products in the store, falling back to the deterministic planner');
    return generateMenu(request, opts);
  }

  const llm = opts.generatePlan ?? (async (prompt: string): Promise<string | null> => {
    const { generateStructuredJson: callGeminiJson } = await import('../gemini');
    const { text } = await callGeminiJson(prompt, buildDaySchema(request, perMeal), MENU_AI_TIMEOUT_MS, 8_192);
    return text;
  });

  const ctx: PromptContext = {
    request: { ...request, budget: effectiveBudget },
    perMeal,
    catalog,
  };

  const fallback = async (aiAttempted: boolean): Promise<MenuResult | MenuGenerationIssue> => {
    const result = await generateMenu(request, opts);
    if (!aiAttempted || 'code' in result) return result;
    result.warnings = result.warnings ?? [];
    result.warnings.push(MENU_AI_FALLBACK_WARNING);
    return result;
  };

  // Days are generated in parallel — each call only composes one day's dishes,
  // so a single request is a few K output tokens instead of up to 16K, and the
  // 7 days run concurrently. Wall-clock per round is bounded by the slowest
  // day, not by the whole week.
  const dayBudget = Math.floor(effectiveBudget / MENU_WEEK_DAYS);
  const plans = new Map<number, AiDayPlan | null>();
  const dayReceipts = new Map<number, DayReceipt>();
  let notes = new Map<number, string>();
  let pending: number[] = Array.from({ length: MENU_WEEK_DAYS }, (_, i) => i + 1);
  let anyParsed = false;
  let best: {
    slots: SlotBuild[];
    shoppingList: ReturnType<typeof buildShoppingList>;
    duplicatesCount: number;
  } | null = null;
  let bestOverall: {
    slots: SlotBuild[];
    shoppingList: ReturnType<typeof buildShoppingList>;
    duplicatesCount: number;
    overshoot: number;
  } | null = null;

  const emptyDay = (): AiDayPlan => ({ breakfast: null, lunch: {}, dinner: {} });

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
      const parsed = parseAiDay(text, request, perMeal);
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
      week.days.push(plans.get(d) ?? emptyDay());
    }
    const slots = await buildSlots(week, { ...request, budget: effectiveBudget }, perMeal, offers, providers, now);
    const chosen = slots.filter((s) => s.choice);
    const shoppingList = buildShoppingList(buildReceiptInputs(slots), offers, request.storeId, now, opts.existingStock);
    const hardOver = shoppingList.total > effectiveBudget + EPS;
    const totalOver = hardOver && shoppingList.total > effectiveBudget * (1 + MENU_BUDGET_OVERSHOOT_TOLERANCE) + EPS;

    dayReceipts.clear();
    for (let d = 1; d <= MENU_WEEK_DAYS; d += 1) {
      const daySlots = slots.filter((s) => s.day === d);
      const dayChosen = daySlots.filter((s) => s.choice);
      // Report the WHOLE-PACKAGE cost of the day (what the user actually pays),
      // not the proportional recipe cost, so the model sees the real overspend.
      const dayPackageCost = buildShoppingList(buildReceiptInputs(daySlots), offers, request.storeId, now).total;
      dayReceipts.set(d, {
        filled: dayChosen.length,
        totalCost: dayPackageCost,
        rejected: daySlots.filter((s) => !s.choice && s.rejection),
        dayBudget,
      });
    }

    const nameCount = new Map<string, number>();
    for (const s of chosen) nameCount.set(s.dishName, (nameCount.get(s.dishName) ?? 0) + 1);
    const duplicates = [...nameCount].filter(([, count]) => count > MENU_MAX_RECIPE_REPEATS);

    const accepted = chosen.length === slotsCount && !totalOver && duplicates.length === 0;
    console.warn(
      `[aiMenu] round ${round}: filled=${chosen.length}/${slotsCount}, total=${formatMoney(shoppingList.total)} BYN / budget ${formatMoney(effectiveBudget)} BYN, duplicates=${duplicates.length}, over=${totalOver}`
    );
    if (accepted) {
      const overshootWarnings =
        hardOver && !totalOver && shoppingList.total > request.budget
          ? [`Чек недели ${formatMoney(shoppingList.total)} BYN чуть выше вашего бюджета ${formatMoney(request.budget)} BYN из-за округления на целые упаковки.`]
          : [];
      return assembleResult(request, store, slots, perMeal, shoppingList, providers, now, effectiveBudget, overshootWarnings);
    }

    // Keep the best within-budget full week seen so far, so we can fall back
    // to it (with a "repeated dishes" note) instead of the whole deterministic
    // planner when only the duplicates keep it from being perfect.
    if (chosen.length === slotsCount && !totalOver && (!best || duplicates.length < best.duplicatesCount)) {
      best = { slots, shoppingList, duplicatesCount: duplicates.length };
    }

    // Full week regardless of budget: the closest to budget (fewest dupes,
    // then lowest total) is our last-resort AI answer when the budget is simply
    // unreachable with this catalogue/price snapshot.
    if (chosen.length === slotsCount) {
      const overshoot = round2(Math.max(0, shoppingList.total - effectiveBudget));
      if (
        !bestOverall ||
        duplicates.length < bestOverall.duplicatesCount ||
        (duplicates.length === bestOverall.duplicatesCount && shoppingList.total < bestOverall.shoppingList.total)
      ) {
        bestOverall = { slots, shoppingList, duplicatesCount: duplicates.length, overshoot };
      }
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
            .map((s) => `${MEAL_TITLES[s.meal]} · ${componentTitle(s.meal, s.role)} («${s.dishName}»): ${s.rejection}`)
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
      if (totalOver) {
        const overshoot = round2(shoppingList.total - effectiveBudget);
        reasons.push(
          `Вся неделя сейчас стоит ${formatMoney(shoppingList.total)} BYN, а бюджет ${formatMoney(effectiveBudget)} BYN — перерасход ${formatMoney(overshoot)} BYN. Сократи этот день ещё хотя бы на ${formatMoney(Math.max(1, overshoot / MENU_WEEK_DAYS))} BYN.`
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

  if (best) {
    console.warn(
      `[aiMenu] no duplicate-free week from the LLM — returning the best within-budget week with ${best.duplicatesCount} repeated dish(es)`
    );
    return assembleResult(
      request,
      store,
      best.slots,
      perMeal,
      best.shoppingList,
      providers,
      now,
      effectiveBudget,
      [`${best.duplicatesCount} блюд(о) повторяется в течение недели.`]
    );
  }

  if (bestOverall) {
    console.warn(
      `[aiMenu] no within-budget full week from the LLM — returning the closest full week, over budget by ${formatMoney(bestOverall.overshoot)} BYN`
    );
    const dupWarning = bestOverall.duplicatesCount > 0
      ? [`${bestOverall.duplicatesCount} блюд(о) повторяется в течение недели.`]
      : [];
    return assembleResult(
      request,
      store,
      bestOverall.slots,
      perMeal,
      bestOverall.shoppingList,
      providers,
      now,
      effectiveBudget,
      [
        `Составить полную неделю (${slotsCount}/${slotsCount}) в рамках бюджета ${formatMoney(request.budget)} BYN не получилось — итог ${formatMoney(round2(Math.max(0, bestOverall.shoppingList.total - request.budget)))} BYN сверх бюджета при текущем каталоге и ценах.`,
        ...dupWarning,
      ]
    );
  }

  console.warn('[aiMenu] no full within-budget week from the LLM, falling back to the deterministic planner');
  const lastRejections = [...dayReceipts.values()]
    .flatMap((r) => r.rejected)
    .slice(0, 6)
    .map((s) => `${MEAL_TITLES[s.meal]} · ${componentTitle(s.meal, s.role)} день ${s.day} «${s.dishName}»: ${s.rejection}`);
  if (lastRejections.length > 0) {
    console.warn(`[aiMenu] last-round rejection reasons: ${lastRejections.join(' ; ')}`);
  }
  return fallback(anyParsed);
}