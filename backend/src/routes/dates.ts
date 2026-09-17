import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { telegramAuthMiddleware, requireTelegramAuth } from '../middleware/auth';
import { getPairByUser } from '../services/database';
import { searchPlaces, PlacesError, type Place, type PlacesSearchInput } from '../services/places';
import {
  getLatestDateSession,
  getDateSessionById,
  deleteActiveDateSessions,
  createDateSessionRow,
  upsertDateVote,
  touchDateSession,
  finishDateSession,
  getDateSessionVotes,
  getRecentSessionPlaces,
  type DateSessionRow,
} from '../services/dates';

const paramsSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radius_m: z.number().int().positive().max(50000).nullable().optional(),
  mood: z.string().max(30).nullable().optional(),
  category: z.string().max(30).nullable().optional(),
  budget: z.string().max(10).nullable().optional(),
  open_now: z.boolean().nullable().optional(),
  count: z.number().int().min(1).max(20).optional(),
});

const createSessionSchema = z.object({ params: paramsSchema });

const voteSchema = z.object({
  place_index: z.number().int().min(0).max(2),
  choice: z.enum(['like', 'dislike']),
});

/**
 * Pick a short, varied set of places for the date: prefer different
 * categories and higher ratings. Skipped places from recent sessions and
 * duplicated Google listings (same name+address).
 */
function pickTopPlaces(candidates: Place[], count = 3, excludeIds: Set<string> = new Set()): Place[] {
  const unique = new Map<string, Place>();
  for (const p of candidates) {
    if (excludeIds.has(p.id)) continue;
    const key = `${p.name}|${p.address}`;
    const dup = [...unique.values()].some((u) => `${u.name}|${u.address}` === key);
    if (!unique.has(p.id) && !dup) unique.set(p.id, p);
  }

  const scored = [...unique.values()].sort(
    (a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (a.distanceM ?? Number.MAX_SAFE_INTEGER) - (b.distanceM ?? Number.MAX_SAFE_INTEGER),
  );
  const chosen: Place[] = [];
  const usedTypes = new Set<string>();

  for (const p of scored) {
    if (chosen.length >= count) break;
    const label = p.typeLabel;
    if (!label || usedTypes.has(label)) continue;
    usedTypes.add(label);
    chosen.push(p);
  }
  for (const p of scored) {
    if (chosen.length >= count) break;
    if (!chosen.some((c) => c.id === p.id)) chosen.push(p);
  }
  return chosen.slice(0, count);
}

async function withVotes(session: DateSessionRow): Promise<DateSessionRow> {
  session.votes = await getDateSessionVotes(session.id);
  return session;
}

export async function datesRoutes(app: FastifyInstance) {
  app.addHook('preHandler', telegramAuthMiddleware);

  app.get('/active', { preHandler: requireTelegramAuth }, async (request, reply) => {
    const pair = await getPairByUser(request.telegramUser!.id);
    if (!pair) return reply.code(404).send({ error: 'Pair not found' });

    const session = await getLatestDateSession(pair.id);
    return { session };
  });

  app.post('/', { preHandler: requireTelegramAuth }, async (request, reply) => {
    const parsed = createSessionSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid date params' });

    const pair = await getPairByUser(request.telegramUser!.id);
    if (!pair) return reply.code(404).send({ error: 'Pair not found' });

    const params = parsed.data.params;
    const searchInput: PlacesSearchInput = {
      lat: params.lat,
      lng: params.lng,
      radiusM: params.radius_m ?? null,
      mood: params.mood ?? null,
      category: params.category ?? null,
      budget: params.budget ?? 'any',
      count: params.count ?? 10,
    };

    let searchResult;
    try {
      searchResult = await searchPlaces(searchInput);
    } catch (error) {
      if (error instanceof PlacesError) {
        if (error.kind === 'integration_not_connected') {
          return reply.code(503).send({ error: error.message, code: error.kind });
        }
        app.log.error(`Places search for date session failed: ${error.message}`);
        return reply.code(502).send({ error: error.message, code: error.kind });
      }
      app.log.error(`Date session search error: ${(error as Error).message}`);
      return reply.code(500).send({ error: 'Failed to find places', code: 'internal' });
    }

    if (searchResult.places.length === 0) {
      return reply.code(404).send({ error: 'Не нашли подходящих мест — попробуйте расширить фильтры', code: 'empty' });
    }

    const recent = await getRecentSessionPlaces(pair.id, 3);
    const excludeIds = new Set(recent.map((r) => r.id));
    let places = pickTopPlaces(searchResult.places, 3, excludeIds);
    if (places.length < 3) {
      const extra = pickTopPlaces(searchResult.places, 3, new Set()).filter(
        (p) => !places.some((c) => c.id === p.id),
      );
      places = [...places, ...extra].slice(0, 3);
    }
    if (places.length === 0) {
      return reply.code(404).send({ error: 'Не нашли подходящих мест — попробуйте расширить фильтры', code: 'empty' });
    }

    await deleteActiveDateSessions(pair.id);
    const session = await createDateSessionRow(pair.id, request.telegramUser!.id, params as Record<string, unknown>, places);
    return reply.code(201).send({ session });
  });

  app.post('/:id/vote', { preHandler: requireTelegramAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = voteSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid vote data' });

    const pair = await getPairByUser(request.telegramUser!.id);
    if (!pair) return reply.code(404).send({ error: 'Pair not found' });

    const session = await getDateSessionById(id);
    if (!session) return reply.code(404).send({ error: 'Session not found' });
    if (session.pair_id !== pair.id) return reply.code(403).send({ error: 'Not your pair session' });
    if (session.status === 'done') {
      return reply.code(409).send({ error: 'Session already finished' });
    }

    await upsertDateVote(id, request.telegramUser!.id, parsed.data.place_index, parsed.data.choice);

    const votes = await getDateSessionVotes(id);
    const memberIds = [pair.telegram_user_a, pair.telegram_user_b];
    const votesByUser = new Map<number, Map<number, 'like' | 'dislike'>>();
    for (const v of votes) {
      if (!votesByUser.has(v.user_id)) votesByUser.set(v.user_id, new Map());
      votesByUser.get(v.user_id)!.set(v.place_index, v.choice);
    }

    const bothVotedAll = memberIds.every((mid) => {
      const mine = votesByUser.get(mid);
      return !!mine && mine.has(0) && mine.has(1) && mine.has(2);
    });

    if (bothVotedAll) {
      const likesByUser = new Map<number, Set<number>>();
      for (const [uid, mine] of votesByUser) {
        const likes = new Set<number>();
        for (const [idx, choice] of mine) {
          if (choice === 'like') likes.add(idx);
        }
        likesByUser.set(uid, likes);
      }
      const first = likesByUser.get(memberIds[0]) ?? new Set<number>();
      const second = likesByUser.get(memberIds[1]) ?? new Set<number>();
      const mutual = [...first].filter((i) => second.has(i));

      let match: Record<string, unknown> | null = { matched: false };
      if (mutual.length > 0) {
        const index = mutual[0];
        match = { matched: true, index, place: (session.places as Place[])[index] ?? null };
      }
      await finishDateSession(id, match);
    } else {
      await touchDateSession(id);
    }

    const updated = await getDateSessionById(id);
    return { session: updated ? await withVotes(updated) : updated };
  });

  app.post('/:id/done', { preHandler: requireTelegramAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const pair = await getPairByUser(request.telegramUser!.id);
    if (!pair) return reply.code(404).send({ error: 'Pair not found' });

    const session = await getDateSessionById(id);
    if (!session || session.pair_id !== pair.id) return reply.code(404).send({ error: 'Session not found' });

    await finishDateSession(id, session.match);
    return { ok: true };
  });
}