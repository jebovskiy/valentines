import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { telegramAuthMiddleware, requireTelegramAuth } from '../middleware/auth';
import { getPairByUser } from '../services/database';
import { ALLERGENS } from '../services/menu/allergens';
import { defaultProviders } from '../services/menu/providers';
import { generateMenu, rebuildMenuForSelection, type GenerateMenuOptions } from '../services/menu/planner';
import { createStoredMenu, getLatestStoredMenuForPair, getStoredMenuForPair, updateStoredMenuResult } from '../services/menu/persistence';

const storeIdEnum = ['euroopt', 'hippo', 'green', 'korona'] as const;
const allergenEnum = ['milk', 'egg', 'peanut', 'tree_nut', 'fish', 'seafood', 'soy', 'gluten'] as const;
const cookwareEnum = ['skillet', 'pot', 'oven', 'slow_cooker', 'microwave'] as const;

const menuRequestSchema = z
  .object({
    storeId: z.enum(storeIdEnum),
    adults: z.number().int().min(0).max(20),
    children: z.number().int().min(0).max(20),
    budget: z.number().min(0.01).max(100000),
    currency: z.literal('BYN'),
    allergens: z.array(z.enum(allergenEnum)).max(8).default([]),
    customAllergens: z.array(z.string().min(1).max(60)).max(20).default([]),
    disliked: z.array(z.string().min(1).max(60)).max(20).default([]),
    cookware: z.array(z.enum(cookwareEnum)).max(5).default([]),
  })
  .refine((d) => d.adults + d.children >= 1, {
    message: 'Хотя бы один взрослый или ребёнок',
  });

const pickSchema = z.object({
  recipe_ids: z.array(z.string().min(1).max(200)).min(1),
});

export async function menuRoutes(app: FastifyInstance) {
  app.addHook('preHandler', telegramAuthMiddleware);

  const providersOptions = (): GenerateMenuOptions => ({ providers: defaultProviders() });

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

  app.get('/', { preHandler: requireTelegramAuth }, async (request, reply) => {
    const pair = await getPairByUser(request.telegramUser!.id);
    if (!pair) return reply.code(404).send({ error: 'Pair not found' });
    const stored = await getLatestStoredMenuForPair(pair.id);
    return { menu: stored?.result ?? null, createdAt: stored?.created_at ?? null };
  });

  app.post('/generate', { preHandler: requireTelegramAuth }, async (request, reply) => {
    const parsed = menuRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid menu params' });

    const pair = await getPairByUser(request.telegramUser!.id);
    if (!pair) return reply.code(404).send({ error: 'Pair not found' });

    const result = await generateMenu(parsed.data, { providers: defaultProviders(), randomize: true });
    if ('code' in result) {
      if (result.code === 'invalid_store') return reply.code(400).send({ error: result.message, code: result.code });
      if (result.code === 'budget_too_low') {
        return reply
          .code(422)
          .send({ error: result.message, code: result.code, minCost: result.minCost, budget: result.budget });
      }
      if (result.code === 'menu_incomplete') {
        return reply
          .code(422)
          .send({
            error: result.message,
            code: result.code,
            filledSlots: result.filledSlots,
            totalSlots: result.totalSlots,
            reason: result.reason,
            missingSlots: result.missingSlots,
          });
      }
      return reply.code(422).send({ error: result.message, code: result.code });
    }

    await createStoredMenu(pair.id, parsed.data, result);
    return reply.code(201).send({ menu: result });
  });

  app.get('/:id', { preHandler: requireTelegramAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const pair = await getPairByUser(request.telegramUser!.id);
    if (!pair) return reply.code(404).send({ error: 'Pair not found' });

    const stored = await getStoredMenuForPair(id, pair.id);
    if (!stored) return reply.code(404).send({ error: 'Menu not found' });
    return { menu: stored.result };
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

    const updated = await rebuildMenuForSelection(menu, picked, providersOptions());
    await updateStoredMenuResult(id, pair.id, updated);
    return { menu: updated };
  });
}