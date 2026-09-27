import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { telegramAuthMiddleware, requireTelegramAuth } from '../middleware/auth';
import { getPairByUser } from '../services/database';
import { ALLERGENS } from '../services/menu/allergens';
import { defaultProviders } from '../services/menu/providers';
import { generateMenuWithAi, type GenerateMenuAiOptions } from '../services/menu/aiMenu';
import { listSlotVariants, rebuildMenuForSelection, replaceMenuSlots } from '../services/menu/planner';
import { searchIngredients, searchIngredientGroups, suggestIngredientName } from '../services/menu/fixtures';
import { convertQuantity } from '../services/menu/costing';
import { round2 } from '../services/menu/scaling';
import { getExistingStockForPair, setLeftoversForPair } from '../services/menu/leftovers';
import { createStoredMenu, getLatestStoredMenuForPair, getStoredMenuForPair, listStoredMenusForPair, updateStoredMenuResult } from '../services/menu/persistence';

const storeIdEnum = ['euroopt', 'hippo', 'green', 'korona'] as const;
const unitEnum = ['g', 'ml', 'pcs'] as const;
const allergenEnum = ['milk', 'egg', 'peanut', 'tree_nut', 'fish', 'seafood', 'soy', 'gluten'] as const;
const cookwareEnum = [
  'skillet',
  'pot',
  'oven',
  'slow_cooker',
  'microwave',
  'blender',
  'air_fryer',
  'steamer',
  'kettle',
] as const;

const mealEnum = z.enum(['breakfast', 'lunch', 'dinner']);

const mealComponentEnum = z.enum(['soup', 'main', 'side', 'salad', 'dessert']);

const memberSchema = z.object({
  id: z.string().min(1).max(60),
  name: z.string().min(1).max(60),
  group: z.enum(['adult', 'child']),
  meals: z.array(mealEnum).min(1).max(3),
  qty: z.number().int().min(1).max(10),
});

const mealComponentsSchema = z.object({
  lunch: z.array(mealComponentEnum).max(5),
  dinner: z.array(mealComponentEnum).max(5),
});

const menuRequestShape = z
  .object({
    storeId: z.enum(storeIdEnum),
    adults: z.number().int().min(0).max(20),
    children: z.number().int().min(0).max(20),
    budget: z.number().min(0.01).max(100000),
    currency: z.literal('BYN'),
    allergens: z.array(z.enum(allergenEnum)).max(8).default([]),
    customAllergens: z.array(z.string().min(1).max(60)).max(60).default([]),
    disliked: z.array(z.string().min(1).max(60)).max(60).default([]),
    cookware: z.array(z.enum(cookwareEnum)).max(9).default([]),
    members: z.array(memberSchema).max(20).optional().default([]),
    mealComponents: mealComponentsSchema.optional(),
  })
  .refine((d) => d.adults + d.children + d.members.reduce((s, m) => s + m.qty, 0) >= 1, {
    message: 'Хотя бы один взрослый или ребёнок',
  });

const menuRequestSchema = menuRequestShape;

const pickSchema = z.object({
  recipe_ids: z.array(z.string().min(1).max(200)).min(1),
});

const saveSchema = z.object({
  menu: z
    .object({
      id: z.string().min(1).max(200),
      request: menuRequestShape,
    })
    .passthrough(),
});

const replaceSchema = z.object({
  replacements: z
    .array(
      z.object({
        day: z.number().int().min(1).max(7),
        meal: mealEnum,
        role: mealComponentEnum,
        recipeId: z.string().min(1).max(200),
      })
    )
    .min(1)
    .max(21),
});

export async function menuRoutes(app: FastifyInstance) {
  app.addHook('preHandler', telegramAuthMiddleware);

  const providersOptions = (existingStock?: GenerateMenuAiOptions['existingStock']): GenerateMenuAiOptions => ({
    providers: defaultProviders(),
    ...(existingStock ? { existingStock } : {}),
  });

  app.get('/stores', { preHandler: requireTelegramAuth }, async () => {
    const providers = defaultProviders();
    const stores = await providers.prices.getStores();
    return {
      stores,
      isMockPrices: providers.prices.isMock,
      priceSourceLabel: providers.prices.sourceLabel,
    };
  });

  app.get('/allergens', { preHandler: requireTelegramAuth }, () => ({
    allergens: ALLERGENS,
    legalDisclaimer: 'Подбор исключает рецепты с указанными ингредиентами на основе курируемого каталога; данные не заменяют консультацию врача.',
  }));

  app.get('/ingredients/search', { preHandler: requireTelegramAuth }, async (request, reply) => {
    const query = z.object({ q: z.string().min(1).max(60) }).safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: 'Empty query' });
    const q = query.data.q;
    const results = searchIngredients(q);
    const groups = searchIngredientGroups(q);
    const suggestion = results.length > 0 ? null : suggestIngredientName(q);
    return { q, results, groups, suggestion, exact: results.some((r) => r.name.toLowerCase() === q.toLowerCase()) };
  });

  app.get('/', { preHandler: requireTelegramAuth }, async (request, reply) => {
    const pair = await getPairByUser(request.telegramUser!.id);
    if (!pair) return reply.code(404).send({ error: 'Pair not found' });
    const stored = await getLatestStoredMenuForPair(pair.id);
    return { menu: stored?.result ?? null, createdAt: stored?.created_at ?? null };
  });

  app.get('/history', { preHandler: requireTelegramAuth }, async (request, reply) => {
    const pair = await getPairByUser(request.telegramUser!.id);
    if (!pair) return reply.code(404).send({ error: 'Pair not found' });
    const rows = await listStoredMenusForPair(pair.id);
    return {
      menus: rows
        .filter((row) => {
          const r = row.result as { recipes?: unknown[] } | null | undefined;
          return !!r && Array.isArray(r.recipes);
        })
        .map((row) => ({
        id: row.result.id,
        createdAt: row.created_at,
        store: row.result.store,
        params: row.params,
        budget: row.result.budget,
        totalCost: row.result.totalCost,
        overspend: row.result.overspend,
        recipesCount: row.result.recipes.length,
      })),
    };
  });

  app.post('/generate', { preHandler: requireTelegramAuth }, async (request, reply) => {
    const parsed = menuRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid menu params' });

    const pair = await getPairByUser(request.telegramUser!.id);
    if (!pair) return reply.code(404).send({ error: 'Pair not found' });

    const existingStock = await getExistingStockForPair(pair.id);

    // AI-driven week: Gemini builds dishes within the budget (revising against
    // real store prices); any failure falls back to the deterministic planner.
    const result = await generateMenuWithAi(parsed.data, {
      ...providersOptions(existingStock),
      randomize: true,
    });
    if ('code' in result) {
      if (result.code === 'invalid_store') return reply.code(400).send({ error: result.message, code: result.code });
      return reply.code(422).send({ error: result.message, code: result.code });
    }

    return reply.code(200).send({ menu: result });
  });

  app.post('/save', { preHandler: requireTelegramAuth }, async (request, reply) => {
    const parsed = saveSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid menu payload' });

    const pair = await getPairByUser(request.telegramUser!.id);
    if (!pair) return reply.code(404).send({ error: 'Pair not found' });

    await createStoredMenu(pair.id, parsed.data.menu.request, parsed.data.menu as never);
    return reply.code(201).send({ saved: true, id: parsed.data.menu.id });
  });

  const leftoverSchema = z.object({
    items: z
      .array(
        z.object({
          ingredientId: z.string().min(1).max(200),
          qty: z.number().positive().max(1000000),
          unit: z.enum(unitEnum),
        })
      )
      .max(300),
  });

  app.get('/leftovers', { preHandler: requireTelegramAuth }, async (request, reply) => {
    const pair = await getPairByUser(request.telegramUser!.id);
    if (!pair) return reply.code(404).send({ error: 'Pair not found' });
    const leftovers = await getExistingStockForPair(pair.id);
    return { leftovers };
  });

  app.put('/leftovers', { preHandler: requireTelegramAuth }, async (request, reply) => {
    const parsed = leftoverSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid leftovers' });

    const pair = await getPairByUser(request.telegramUser!.id);
    if (!pair) return reply.code(404).send({ error: 'Pair not found' });

    await setLeftoversForPair(
      pair.id,
      parsed.data.items.map((i) => ({ ingredientId: i.ingredientId, qty: i.qty, unit: i.unit }))
    );
    return reply.code(200).send({ saved: true });
  });

  app.post('/leftovers/suggest', { preHandler: requireTelegramAuth }, async (request, reply) => {
    const pair = await getPairByUser(request.telegramUser!.id);
    if (!pair) return reply.code(404).send({ error: 'Pair not found' });

    const menu = (await getLatestStoredMenuForPair(pair.id))?.result;
    if (!menu) return reply.code(200).send({ items: [] });

    const items: { ingredientId: string; name: string; qty: number; unit: string }[] = [];
    for (const item of menu.shoppingList.items) {
      if (item.missing || item.stale || item.purchaseQuantity <= 0 || item.packageQuantity <= 0) continue;
      const bought = convertQuantity(
        item.purchaseQuantity * item.packageQuantity,
        item.packageUnit,
        item.requiredUnit,
        undefined
      );
      if (bought === null) continue;
      const leftover = Math.max(0, bought - item.requiredQuantity);
      if (leftover <= 0.001) continue;
      items.push({
        ingredientId: item.ingredientId,
        name: item.name,
        qty: round2(leftover),
        unit: item.requiredUnit,
      });
    }
    return { items };
  });

  app.get('/:id', { preHandler: requireTelegramAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const pair = await getPairByUser(request.telegramUser!.id);
    if (!pair) return reply.code(404).send({ error: 'Pair not found' });

    const stored = await getStoredMenuForPair(id, pair.id);
    if (!stored) return reply.code(404).send({ error: 'Menu not found' });
    return { menu: stored.result };
  });

  app.get('/:id/variants', { preHandler: requireTelegramAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = z
      .object({ day: z.coerce.number().int().min(1).max(7), meal: mealEnum, role: mealComponentEnum })
      .safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: 'Invalid slot' });

    const pair = await getPairByUser(request.telegramUser!.id);
    if (!pair) return reply.code(404).send({ error: 'Pair not found' });

    const stored = await getStoredMenuForPair(id, pair.id);
    if (!stored) return reply.code(404).send({ error: 'Menu not found' });

    const menu = stored.result;
    const current = menu.days
      .find((d) => d.day === query.data.day)
      ?.meals.find((m) => m.meal === query.data.meal)
      ?.components.find((c) => c.role === query.data.role)?.recipe.recipe.id;
    if (!current) return reply.code(404).send({ error: 'Slot not found' });

    const variants = await listSlotVariants(menu, query.data.meal, query.data.role, current, providersOptions());
    return { variants };
  });

  app.post('/:id/replace', { preHandler: requireTelegramAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = replaceSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid replacement' });

    const pair = await getPairByUser(request.telegramUser!.id);
    if (!pair) return reply.code(404).send({ error: 'Pair not found' });

    const stored = await getStoredMenuForPair(id, pair.id);
    if (!stored) return reply.code(404).send({ error: 'Menu not found' });

    const menu = stored.result;
    const replacements = parsed.data.replacements.filter((r) => {
      const slot = menu.days
        .find((d) => d.day === r.day)
        ?.meals.find((m) => m.meal === r.meal)
        ?.components.find((c) => c.role === r.role);
      return !!slot && slot.recipe.recipe.id !== r.recipeId;
    });
    if (replacements.length === 0) {
      return reply.code(400).send({ error: 'Нечего заменять' });
    }

    const updated = await replaceMenuSlots(menu, replacements, providersOptions(await getExistingStockForPair(pair.id)));
    if (!updated) return reply.code(400).send({ error: 'Один из заменяющих рецептов не подходит для этого слота' });

    await updateStoredMenuResult(id, pair.id, updated);
    return { menu: updated };
  });

  app.get('/:id/shopping-list', { preHandler: requireTelegramAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const pair = await getPairByUser(request.telegramUser!.id);
    if (!pair) return reply.code(404).send({ error: 'Pair not found' });

    const stored = await getStoredMenuForPair(id, pair.id);
    if (!stored) return reply.code(404).send({ error: 'Menu not found' });
    const menu = stored.result;
    return {
      menuId: menu.id,
      store: menu.store,
      budget: menu.budget,
      totalCost: menu.totalCost,
      remainingBudget: menu.remainingBudget,
      overspend: menu.overspend,
      priceSourceLabel: menu.priceSourceLabel,
      servings: menu.servings,
      recipes: menu.recipes.map((r) => ({
        id: r.recipe.id,
        name: r.recipe.name,
        cost: r.cost,
        servings: r.servings,
      })),
      shoppingList: menu.shoppingList,
      warnings: menu.warnings,
    };
  });

  app.post('/:id/pick', { preHandler: requireTelegramAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = pickSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid selection' });

    const pair = await getPairByUser(request.telegramUser!.id);
    if (!pair) return reply.code(404).send({ error: 'Pair not found' });

    const stored = await getStoredMenuForPair(id, pair.id);
    if (!stored) return reply.code(404).send({ error: 'Menu not found' });

    const menu = stored.result;
    const availableIds = new Set(menu.recipes.map((r) => r.recipe.id));
    const picked = parsed.data.recipe_ids.filter((rid) => availableIds.has(rid));
    if (picked.length === 0) {
      return reply.code(400).send({ error: 'Не выбран ни один из рецептов меню' });
    }

    const updated = await rebuildMenuForSelection(menu, picked, providersOptions(await getExistingStockForPair(pair.id)));
    await updateStoredMenuResult(id, pair.id, updated);
    return { menu: updated };
  });
}