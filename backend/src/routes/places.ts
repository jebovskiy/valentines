import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { telegramAuthMiddleware, requireTelegramAuth } from '../middleware/auth';
import { searchPlaces, fetchPlacePhoto, PlacesError } from '../services/places';

const searchSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radius_m: z.number().int().positive().max(50000).nullable().optional(),
  mood: z.string().max(30).nullable().optional(),
  category: z.string().max(30).nullable().optional(),
  budget: z.string().max(10).nullable().optional(),
  open_now: z.boolean().nullable().optional(),
  count: z.number().int().min(1).max(20).optional(),
});

export async function placesRoutes(app: FastifyInstance) {
  app.addHook('preHandler', telegramAuthMiddleware);

  app.post('/search', { preHandler: requireTelegramAuth }, async (request, reply) => {
    const parsed = searchSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid search params' });

    try {
      const result = await searchPlaces({
        lat: parsed.data.lat,
        lng: parsed.data.lng,
        radiusM: parsed.data.radius_m ?? null,
        mood: parsed.data.mood ?? null,
        category: parsed.data.category ?? null,
        budget: parsed.data.budget ?? 'any',
        count: parsed.data.count ?? 10,
      });
      return result;
    } catch (error) {
      if (error instanceof PlacesError) {
        if (error.kind === 'integration_not_connected') {
          return reply.code(503).send({ error: error.message, code: error.kind });
        }
        app.log.error(`Places search failed: ${error.message}`);
        return reply.code(502).send({ error: error.message, code: error.kind });
      }
      app.log.error(`Places search error: ${(error as Error).message}`);
      return reply.code(500).send({ error: 'Places search failed', code: 'internal' });
    }
  });

  app.get('/photo', { preHandler: requireTelegramAuth }, async (request, reply) => {
    const { name } = request.query as { name?: string };
    if (!name || !name.startsWith('places/')) {
      return reply.code(400).send({ error: 'Invalid photo name' });
    }
    const photo = await fetchPlacePhoto(name);
    if (!photo) return reply.code(404).send({ error: 'Photo not available' });
    reply.header('Content-Type', photo.contentType ?? 'image/jpeg');
    reply.header('Cache-Control', 'public, max-age=86400');
    return reply.send(photo.buffer);
  });
}