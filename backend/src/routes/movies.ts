import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  getPairByUser,
  getPairById,
  getPartnerTelegramId,
  getMovies,
  getMovieById,
  getMovieByKp,
  createMovie,
  deleteMovie,
  markMovieStatus,
  getMovieReviews,
  getMovieReviewsBatch,
  upsertMovieReview,
  getMovieWatches,
  getMovieWatchesBatch,
  upsertMovieWatch,
  getMovieInsight,
  claimMovieInsight,
  finishMovieInsight,
  abandonMovieInsight,
} from '../services/database';
import { searchPoiskkino, getPoiskkinoDetail, PoiskkinoDetail, PoiskkinoPart } from '../services/poiskkino';
import { generateMovieInsights, classifyMovieAspects, MovieReviewInput } from '../services/gemini';
import { computeCompatibility, normalizeWeights, DEFAULT_ASPECT_WEIGHTS } from '../services/taste';
import {
  getTasteProfile,
  upsertTasteProfile,
  saveMovieAspectScores,
} from '../services/database';
import type { MovieReview, MovieWatch } from '../services/database';
import { telegramAuthMiddleware, requireTelegramAuth } from '../middleware/auth';
import {
  sendMovieAddedNotification,
  sendMovieWatchedNotification,
  sendMovieReviewRequestNotification,
  sendMovieInsightReadyNotification,
  sendMovieShareNotification,
} from '../services/telegramNotifier';
import { dispatchMoviePushes } from '../services/pushDispatcher';

const createMovieSchema = z.object({
  kp_id: z.number().int().positive().optional(),
  title: z.string().min(1).max(300).optional(),
  year: z.number().int().positive().nullable().optional(),
}).refine((v) => v.kp_id || v.title, { message: 'kp_id or title is required' });

const reviewSchema = z.object({
  visuals: z.number().int().min(1).max(5),
  plot: z.number().int().min(1).max(5),
  acting: z.number().int().min(1).max(5),
  music: z.number().int().min(1).max(5),
  atmosphere: z.number().int().min(1).max(5),
  humor: z.number().int().min(1).max(5),
  comment: z.string().max(1000).nullable().optional(),
});

const batchItemSchema = z.object({
  kp_id: z.number().int().positive().optional(),
  title: z.string().min(1).max(300).optional(),
  year: z.number().int().positive().nullable().optional(),
}).refine((v) => v.kp_id || v.title, { message: 'kp_id or title is required' });

const batchSchema = z.object({
  items: z.array(batchItemSchema).min(1).max(50),
});

const aspectWeightsSchema = z.object({
  visual: z.number().int().min(1).max(5),
  plot: z.number().int().min(1).max(5),
  acting: z.number().int().min(1).max(5),
  music: z.number().int().min(1).max(5),
  atmosphere: z.number().int().min(1).max(5),
  humor: z.number().int().min(1).max(5),
});

const tasteProfileSchema = z.object({
  aspect_weights: aspectWeightsSchema,
});

function toCandidate(m: PoiskkinoDetail): {
  kp_id: number;
  name: string | null;
  alternative_name: string | null;
  year: number | null;
  poster_url: string | null;
  rating_kp: number | null;
  rating_imdb: number | null;
  genres: string[];
  type: string | null;
} {
  return {
    kp_id: m.kp_id,
    name: m.name,
    alternative_name: m.alternative_name,
    year: m.year,
    poster_url: m.poster_url,
    rating_kp: m.rating_kp,
    rating_imdb: m.rating_imdb,
    genres: m.genres,
    type: m.type,
  };
}

function parseRuntimeMinutes(runtime: string | null): number | null {
  if (!runtime) return null;
  const match = runtime.match(/\d+/);
  return match ? Number(match[0]) : null;
}

function parseRatingValue(rating: string | null): number | null {
  if (!rating) return null;
  const match = rating.match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

async function ensureMovieAspectScores(movieId: string, app: FastifyInstance): Promise<void> {
  try {
    const movie = await getMovieById(movieId);
    if (!movie || movie.aspect_scores) return;

    const classification = await classifyMovieAspects({
      title: movie.title,
      year: movie.year,
      genres: movie.genre ? movie.genre.split(',').map((g) => g.trim()).filter(Boolean) : [],
      runtime: parseRuntimeMinutes(movie.runtime),
      rating: parseRatingValue(movie.rating),
      description: movie.description,
    });
    if (classification) {
      await saveMovieAspectScores(movie.id, classification.aspect_scores);
      app.log.info(`Aspect scores saved for movie "${movie.title}" (${movie.id})`);
    }
  } catch (error) {
    app.log.error(`Aspect score generation failed for movie ${movieId}: ${(error as Error).message}`);
  }
}

const aspectBackfillLock = new Set<string>();

function backfillAspectScores(movies: { id: string; aspect_scores: unknown }[], app: FastifyInstance): void {
  for (const movie of movies) {
    if (movie.aspect_scores || aspectBackfillLock.has(movie.id)) continue;
    aspectBackfillLock.add(movie.id);
    void ensureMovieAspectScores(movie.id, app);
  }
}

export async function moviesRoutes(app: FastifyInstance) {
  app.addHook('preHandler', telegramAuthMiddleware);

  app.get('/', { preHandler: requireTelegramAuth }, async (request, reply) => {
    const pair = await getPairByUser(request.telegramUser!.id);
    if (!pair) return reply.code(404).send({ error: 'Pair not found' });

    const movies = await getMovies(pair.id);
    if (movies.length === 0) return { movies: [] };

    backfillAspectScores(movies, app);

    const partnerTelegramId = await getPartnerTelegramId(pair.id, request.telegramUser!.id);
    const [allReviews, allWatches, tasteProfile, partnerProfile] = await Promise.all([
      getMovieReviewsBatch(movies.map((m) => m.id)),
      getMovieWatchesBatch(movies.map((m) => m.id)),
      getTasteProfile(request.telegramUser!.id),
      partnerTelegramId ? getTasteProfile(partnerTelegramId) : Promise.resolve(null),
    ]);
    const weights = tasteProfile ? normalizeWeights(tasteProfile.aspect_weights) : DEFAULT_ASPECT_WEIGHTS;
    const partnerWeights = partnerProfile ? normalizeWeights(partnerProfile.aspect_weights) : null;

    const reviewsByMovie = new Map<string, MovieReview[]>();
    for (const r of allReviews) {
      const list = reviewsByMovie.get(r.movie_id) ?? [];
      list.push(r);
      reviewsByMovie.set(r.movie_id, list);
    }
    const watchesByMovie = new Map<string, MovieWatch[]>();
    for (const w of allWatches) {
      const list = watchesByMovie.get(w.movie_id) ?? [];
      list.push(w);
      watchesByMovie.set(w.movie_id, list);
    }

    const items = movies.map((movie) => ({
      ...movie,
      reviews: reviewsByMovie.get(movie.id) ?? [],
      watches: (watchesByMovie.get(movie.id) ?? []).map((w) => w.author_telegram_id),
      added_by_name:
        movie.added_by === pair.telegram_user_a ? pair.user_a_name : pair.user_b_name || 'Партнер',
      taste_match: movie.aspect_scores ? computeCompatibility(weights, movie.aspect_scores) : null,
      partner_taste_match:
        movie.aspect_scores && partnerWeights ? computeCompatibility(partnerWeights, movie.aspect_scores) : null,
    }));
    return { movies: items };
  });

  app.get('/taste-profile', { preHandler: requireTelegramAuth }, async (request) => {
    const profile = await getTasteProfile(request.telegramUser!.id);
    return { aspect_weights: profile ? normalizeWeights(profile.aspect_weights) : DEFAULT_ASPECT_WEIGHTS };
  });

  app.post('/taste-profile', { preHandler: requireTelegramAuth }, async (request, reply) => {
    const parsed = tasteProfileSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid taste profile' });
    const weights = normalizeWeights(parsed.data.aspect_weights);
    await upsertTasteProfile(request.telegramUser!.id, weights);
    return { aspect_weights: weights };
  });

  app.get('/:id/aspects', { preHandler: requireTelegramAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const pair = await getPairByUser(request.telegramUser!.id);
    if (!pair) return reply.code(404).send({ error: 'Pair not found' });

    const movie = await getMovieById(id);
    if (!movie || movie.pair_id !== pair.id) return reply.code(404).send({ error: 'Movie not found' });

    const partnerTelegramId = await getPartnerTelegramId(pair.id, request.telegramUser!.id);
    const [profile, partnerProfile] = await Promise.all([
      getTasteProfile(request.telegramUser!.id),
      partnerTelegramId ? getTasteProfile(partnerTelegramId) : Promise.resolve(null),
    ]);
    const weights = profile ? normalizeWeights(profile.aspect_weights) : DEFAULT_ASPECT_WEIGHTS;
    const partnerWeights = partnerProfile ? normalizeWeights(partnerProfile.aspect_weights) : null;
    return {
      aspect_scores: movie.aspect_scores,
      taste_match: movie.aspect_scores ? computeCompatibility(weights, movie.aspect_scores) : null,
      partner_taste_match:
        movie.aspect_scores && partnerWeights ? computeCompatibility(partnerWeights, movie.aspect_scores) : null,
    };
  });

  app.get('/search', { preHandler: requireTelegramAuth }, async (request, reply) => {
    const { q } = request.query as { q?: string };
    if (!q || q.trim().length < 2) return reply.code(400).send({ error: 'Query too short' });
    try {
      const results = await searchPoiskkino(q.trim());
      return { results };
    } catch (error) {
      app.log.error(`Poiskkino search failed: ${(error as Error).message}`);
      return reply.code(502).send({ error: 'Search service unavailable' });
    }
  });

  app.get('/parts', { preHandler: requireTelegramAuth }, async (request, reply) => {
    const { kp_id } = request.query as { kp_id?: string };
    const id = Number(kp_id);
    if (!Number.isInteger(id) || id <= 0) return reply.code(400).send({ error: 'Invalid kp_id' });
    try {
      const detail = await getPoiskkinoDetail(id);
      if (!detail) return reply.code(404).send({ error: 'Movie not found' });
      return { movie: toCandidate(detail), parts: detail.parts };
    } catch (error) {
      app.log.error(`Poiskkino parts failed: ${(error as Error).message}`);
      return reply.code(502).send({ error: 'Search service unavailable' });
    }
  });

  app.post('/batch', { preHandler: requireTelegramAuth }, async (request, reply) => {
    const parsed = batchSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid batch data' });

    const pair = await getPairByUser(request.telegramUser!.id);
    if (!pair) return reply.code(404).send({ error: 'Pair not found' });

    const addedMovies = [];
    const duplicates: number[] = [];
    const authorName =
      pair.telegram_user_a === request.telegramUser!.id ? pair.user_a_name : pair.user_b_name;

    for (const item of parsed.data.items) {
      if (item.kp_id) {
        const existing = await getMovieByKp(pair.id, item.kp_id);
        if (existing) {
          duplicates.push(item.kp_id);
          continue;
        }
      }
      let detail = null;
      let title = item.title;
      if (item.kp_id) {
        try {
          detail = await getPoiskkinoDetail(item.kp_id);
          if (detail) title = detail.name || detail.alternative_name || title;
        } catch (error) {
          app.log.error(`Poiskkino detail failed: ${(error as Error).message}`);
        }
      }
      if (!title) continue;

      const genreStr = detail?.genres?.length ? detail.genres.join(', ') : null;
      const plot = detail?.description || detail?.short_description || null;
      const posterUrl = detail?.poster_url || null;
      const runtimeStr = detail?.movie_length ? `${detail.movie_length} мин` : null;
      const imdbRating = detail?.rating_imdb ? String(detail.rating_imdb) : null;

      const movie = await createMovie({
        pair_id: pair.id,
        added_by: request.telegramUser!.id,
        kp_id: item.kp_id ?? null,
        title,
        year: item.year ?? detail?.year ?? null,
        poster_url: posterUrl,
        genre: genreStr,
        description: plot,
        runtime: runtimeStr,
        rating: detail?.rating_kp ? `КП ${detail.rating_kp}` : imdbRating,
      });
      addedMovies.push(movie);
      void ensureMovieAspectScores(movie.id, app);

      const partnerId = await getPartnerTelegramId(pair.id, request.telegramUser!.id);
      if (partnerId) {
        void sendMovieAddedNotification(partnerId, movie, authorName).catch((e) =>
          app.log.error('Movie added Telegram notification failed:', e),
        );
      }
      void dispatchMoviePushes(
        pair.id,
        request.telegramUser!.id,
        {
          event: 'added',
          title: 'Новый фильм в списке',
          message: `«${movie.year ? `${movie.title} (${movie.year})` : movie.title}»`,
          movie_title: movie.title,
        },
      ).catch((e) => app.log.error('Movie added push failed:', e));
    }

    return reply.code(201).send({ added: addedMovies, duplicates });
  });

  app.post('/', { preHandler: requireTelegramAuth }, async (request, reply) => {
    const parsed = createMovieSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid movie data' });

    const pair = await getPairByUser(request.telegramUser!.id);
    if (!pair) return reply.code(404).send({ error: 'Pair not found' });

    if (parsed.data.kp_id) {
      const existing = await getMovieByKp(pair.id, parsed.data.kp_id);
      if (existing) {
        void ensureMovieAspectScores(existing.id, app);
        return reply.code(200).send({ movieId: existing.id, duplicate: true });
      }
    }

    let detail = null;
    let title = parsed.data.title;
    if (parsed.data.kp_id) {
      try {
        detail = await getPoiskkinoDetail(parsed.data.kp_id);
        if (detail) title = detail.name || detail.alternative_name || title;
      } catch (error) {
        app.log.error(`Poiskkino detail failed: ${(error as Error).message}`);
      }
    }
    if (!title) return reply.code(400).send({ error: 'Title is required' });

    const genreStr = detail?.genres?.length ? detail.genres.join(', ') : null;
    const countryStr = detail?.countries?.length ? detail.countries.join(', ') : null;
    const plot = detail?.description || detail?.short_description || null;
    const posterUrl = detail?.poster_url || null;
    const runtimeStr = detail?.movie_length ? `${detail.movie_length} мин` : null;
    const imdbRating = detail?.rating_imdb ? String(detail.rating_imdb) : null;

    const movie = await createMovie({
      pair_id: pair.id,
      added_by: request.telegramUser!.id,
      kp_id: parsed.data.kp_id ?? null,
      title,
      year: parsed.data.year ?? detail?.year ?? null,
      poster_url: posterUrl,
      genre: genreStr,
      description: plot,
      runtime: runtimeStr,
      rating: detail?.rating_kp ? `КП ${detail.rating_kp}` : imdbRating,
    });

    void ensureMovieAspectScores(movie.id, app);

    const authorName =
      pair.telegram_user_a === request.telegramUser!.id ? pair.user_a_name : pair.user_b_name;
    const partnerId = await getPartnerTelegramId(pair.id, request.telegramUser!.id);
    if (partnerId) {
      void sendMovieAddedNotification(partnerId, movie, authorName).catch((e) =>
        app.log.error('Movie added Telegram notification failed:', e),
      );
    }
    void dispatchMoviePushes(
      pair.id,
      request.telegramUser!.id,
      {
        event: 'added',
        title: 'Новый фильм в списке',
        message: `«${movie.year ? `${movie.title} (${movie.year})` : movie.title}»`,
        movie_title: movie.title,
      },
    ).catch((e) => app.log.error('Movie added push failed:', e));

    return reply.code(201).send({ movie });
  });

  app.post('/evening', { preHandler: requireTelegramAuth }, async (request, reply) => {
    const pair = await getPairByUser(request.telegramUser!.id);
    if (!pair) return reply.code(404).send({ error: 'Pair not found' });

    const movies = await getMovies(pair.id);
    if (movies.length === 0) return reply.code(404).send({ error: 'No movies in the list' });

    const candidates = movies.filter((m) => m.status === 'want_to_watch');
    const pool = candidates.length > 0 ? candidates : movies;
    const movie = pool[Math.floor(Math.random() * pool.length)];
    request.log.info({ userId: request.telegramUser!.id, movieId: movie.id }, 'evening pick');
    return { movie };
  });

  app.delete('/:id', { preHandler: requireTelegramAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const pair = await getPairByUser(request.telegramUser!.id);
    if (!pair) return reply.code(404).send({ error: 'Pair not found' });
    await deleteMovie(id, pair.id);
    return { ok: true };
  });

  app.post('/:id/watched', { preHandler: requireTelegramAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const pair = await getPairByUser(request.telegramUser!.id);
    if (!pair) return reply.code(404).send({ error: 'Pair not found' });

    const movie = await getMovieById(id);
    if (!movie || movie.pair_id !== pair.id) return reply.code(404).send({ error: 'Movie not found' });

    await Promise.all([
      upsertMovieWatch(movie.id, request.telegramUser!.id),
      markMovieStatus(movie.id, 'watched', movie.watched_at ?? new Date().toISOString()),
    ]);

    const [watches, reviews] = await Promise.all([
      getMovieWatches(movie.id),
      getMovieReviews(movie.id),
    ]);

    const partnerId = await getPartnerTelegramId(pair.id, request.telegramUser!.id);
    const partnerReviewed = partnerId !== null && reviews.some((r) => r.author_telegram_id === partnerId);

    if (partnerId && !partnerReviewed) {
      const authorName =
        pair.telegram_user_a === request.telegramUser!.id ? pair.user_a_name : pair.user_b_name;
      void sendMovieWatchedNotification(partnerId, movie, authorName).catch((e) =>
        app.log.error('Movie watched Telegram notification failed:', e),
      );
    }
    void dispatchMoviePushes(
      pair.id,
      request.telegramUser!.id,
      {
        event: 'watched',
        title: 'Фильм посмотрели',
        message: `«${movie.title}» − отметил(а), что посмотрел(а)`,
        movie_title: movie.title,
      },
    ).catch((e) => app.log.error('Movie watched push failed:', e));

    return { movie, watches: watches.map((w) => w.author_telegram_id), bothReviewed: partnerId !== null && partnerReviewed };
  });

  app.post('/:id/review', { preHandler: requireTelegramAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = reviewSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid review data' });

    const pair = await getPairByUser(request.telegramUser!.id);
    if (!pair) return reply.code(404).send({ error: 'Pair not found' });

    const movie = await getMovieById(id);
    if (!movie || movie.pair_id !== pair.id) return reply.code(404).send({ error: 'Movie not found' });

    const review = await upsertMovieReview({
      movie_id: movie.id,
      author_telegram_id: request.telegramUser!.id,
      visuals: parsed.data.visuals,
      plot: parsed.data.plot,
      acting: parsed.data.acting,
      music: parsed.data.music,
      atmosphere: parsed.data.atmosphere,
      humor: parsed.data.humor,
      review_text: parsed.data.comment ?? null,
    });

    const reviews = await getMovieReviews(movie.id);
    const partnerId = await getPartnerTelegramId(pair.id, request.telegramUser!.id);
    const partnerReviewed = partnerId !== null && reviews.some((r) => r.author_telegram_id === partnerId);
    const bothReviewed = reviews.length >= 2;

    if (partnerId && !partnerReviewed) {
      const partnerName =
        pair.telegram_user_a === partnerId ? pair.user_a_name : pair.user_b_name;
      void sendMovieReviewRequestNotification(partnerId, movie, partnerName).catch((e) =>
        app.log.error('Review request Telegram notification failed:', e),
      );
      void dispatchMoviePushes(
        pair.id,
        request.telegramUser!.id,
        {
          event: 'review_request',
          title: 'Ваш отзыв ждут',
          message: `Партнёр оставил отзыв на «${movie.title}» — ваша очередь!`,
          movie_title: movie.title,
        },
      ).catch((e) => app.log.error('Review request push failed:', e));
    }

    if (bothReviewed) {
      const claimed = await claimMovieInsight(movie.id);
      if (claimed) {
        void (async () => {
          try {
            const pairInfo = await getPairById(pair.id);
            const inputs: MovieReviewInput[] = reviews.map((r) => ({
              author_name:
                r.author_telegram_id === pair.telegram_user_a
                  ? (pairInfo?.user_a_name ?? 'Партнёр 1')
                  : (pairInfo?.user_b_name ?? 'Партнёр 2'),
              visuals: r.visuals,
              plot: r.plot,
              acting: r.acting,
              music: r.music,
              atmosphere: r.atmosphere,
              humor: r.humor,
              comment: r.review_text,
            }));
            const [a, b] = inputs;
            const insight = await generateMovieInsights(
              { title: movie.title, year: movie.year, genre: movie.genre, plot: movie.description },
              [a, b],
            );
            const stored = await getMovieInsight(movie.id);
            if (stored) {
              await abandonMovieInsight(movie.id);
              return;
            }
            await finishMovieInsight(movie.id, insight as unknown as Record<string, unknown>);
            const summary = insight.summary || insight.verdict || null;
            const authorSet = new Set(reviews.map((r) => r.author_telegram_id));
            for (const chatId of [pair.telegram_user_a, pair.telegram_user_b]) {
              if (authorSet.has(chatId)) {
                void sendMovieInsightReadyNotification(chatId, movie, summary).catch((e) =>
                  app.log.error('Insight Telegram notification failed:', e),
                );
              }
            }
            void dispatchMoviePushes(pair.id, null, {
              event: 'insight',
              title: 'Анализ фильма готов',
              message: `Общий отзыв по «${movie.title}» готов${summary ? `: ${summary}` : ''}`,
              movie_title: movie.title,
            }).catch((e) => app.log.error('Insight push failed:', e));
          } catch (error) {
            app.log.error(`Insight generation failed: ${(error as Error).message}`);
            try {
              await abandonMovieInsight(movie.id);
            } catch (abandonError) {
              app.log.error(`Failed to abandon insight claim: ${(abandonError as Error).message}`);
            }
          }
        })();
      }
    }

    return { review, bothReviewed };
  });

  app.get('/:id/insight', { preHandler: requireTelegramAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const pair = await getPairByUser(request.telegramUser!.id);
    if (!pair) return reply.code(404).send({ error: 'Pair not found' });

    const movie = await getMovieById(id);
    if (!movie || movie.pair_id !== pair.id) return reply.code(404).send({ error: 'Movie not found' });

    const insight = await getMovieInsight(movie.id);
    return { insight };
  });

  app.post('/:id/share', { preHandler: requireTelegramAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const pair = await getPairByUser(request.telegramUser!.id);
    if (!pair) return reply.code(404).send({ error: 'Pair not found' });

    const movie = await getMovieById(id);
    if (!movie || movie.pair_id !== pair.id) return reply.code(404).send({ error: 'Movie not found' });

    const authorName =
      pair.telegram_user_a === request.telegramUser!.id ? pair.user_a_name : pair.user_b_name;
    const partnerId = await getPartnerTelegramId(pair.id, request.telegramUser!.id);
    if (partnerId) {
      await sendMovieShareNotification(partnerId, movie, authorName).catch((e) =>
        app.log.error('Movie share Telegram notification failed:', e),
      );
    }
    void dispatchMoviePushes(
      pair.id,
      request.telegramUser!.id,
      {
        event: 'share',
        title: 'Вам поделились фильмом',
        message: `Партнёр предлагает посмотреть «${movie.title}»`,
        movie_title: movie.title,
      },
    ).catch((e) => app.log.error('Movie share push failed:', e));
    return { ok: true };
  });
}