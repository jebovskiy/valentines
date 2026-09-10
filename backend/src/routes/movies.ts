import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  getPairByUser,
  getPairById,
  getPartnerTelegramId,
  getMovies,
  getMovieById,
  getMovieByImdb,
  createMovie,
  deleteMovie,
  markMovieStatus,
  getMovieReviews,
  upsertMovieReview,
  getMovieWatches,
  upsertMovieWatch,
  getMovieInsight,
  upsertMovieInsight,
} from '../services/database';
import { searchOmdb, getOmdbDetail } from '../services/omdb';
import { generateMovieInsights, MovieReviewInput } from '../services/gemini';
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
  imdb_id: z.string().min(1).optional(),
  title: z.string().min(1).max(300).optional(),
  year: z.string().max(10).nullable().optional(),
}).refine((v) => v.imdb_id || v.title, { message: 'imdb_id or title is required' });

const reviewSchema = z.object({
  visuals: z.number().int().min(1).max(5),
  plot: z.number().int().min(1).max(5),
  acting: z.number().int().min(1).max(5),
  music: z.number().int().min(1).max(5),
  atmosphere: z.number().int().min(1).max(5),
  humor: z.number().int().min(1).max(5),
  comment: z.string().max(1000).nullable().optional(),
});

export async function moviesRoutes(app: FastifyInstance) {
  app.addHook('preHandler', telegramAuthMiddleware);

  app.get('/', { preHandler: requireTelegramAuth }, async (request, reply) => {
    const pair = await getPairByUser(request.telegramUser!.id);
    if (!pair) return reply.code(404).send({ error: 'Pair not found' });

    const movies = await getMovies(pair.id);
    const items = [];
    for (const movie of movies) {
      const [reviews, watches] = await Promise.all([
        getMovieReviews(movie.id),
        getMovieWatches(movie.id),
      ]);
      items.push({
        ...movie,
        reviews,
        watches: watches.map((w) => w.author_telegram_id),
        added_by_name:
          movie.added_by === pair.telegram_user_a ? pair.user_a_name : pair.user_b_name || 'Партнер',
      });
    }
    return { movies: items };
  });

  app.get('/search', { preHandler: requireTelegramAuth }, async (request, reply) => {
    const { q } = request.query as { q?: string };
    if (!q || q.trim().length < 2) return reply.code(400).send({ error: 'Query too short' });
    try {
      const results = await searchOmdb(q.trim());
      return { results };
    } catch (error) {
      app.log.error(`OMDB search failed: ${(error as Error).message}`);
      return reply.code(502).send({ error: 'Search service unavailable' });
    }
  });

  app.post('/', { preHandler: requireTelegramAuth }, async (request, reply) => {
    const parsed = createMovieSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid movie data' });

    const pair = await getPairByUser(request.telegramUser!.id);
    if (!pair) return reply.code(404).send({ error: 'Pair not found' });

    if (parsed.data.imdb_id) {
      const existing = await getMovieByImdb(pair.id, parsed.data.imdb_id);
      if (existing) return reply.code(200).send({ movieId: existing.id, duplicate: true });
    }

    let detail = null;
    let title = parsed.data.title;
    if (parsed.data.imdb_id) {
      try {
        detail = await getOmdbDetail(parsed.data.imdb_id);
        if (detail) title = detail.title;
      } catch (error) {
        app.log.error(`OMDB detail failed: ${(error as Error).message}`);
      }
    }
    if (!title) return reply.code(400).send({ error: 'Title is required' });

    const movie = await createMovie({
      pair_id: pair.id,
      added_by: request.telegramUser!.id,
      imdb_id: parsed.data.imdb_id ?? null,
      title,
      year: detail?.year ?? parsed.data.year ?? null,
      poster_url: detail?.poster ?? null,
      genre: detail?.genre ?? null,
      plot: detail?.plot ?? null,
      runtime: detail?.runtime ?? null,
      imdb_rating: detail?.imdb_rating ?? null,
    });

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
      comment: parsed.data.comment ?? null,
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

    if (bothReviewed && !(await getMovieInsight(movie.id))) {
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
            comment: r.comment,
          }));
          const [a, b] = inputs;
          const insight = await generateMovieInsights(
            { title: movie.title, year: movie.year, genre: movie.genre, plot: movie.plot },
            [a, b],
          );
          const stored = await getMovieInsight(movie.id);
          if (stored) return;
          await upsertMovieInsight(movie.id, insight as unknown as Record<string, unknown>);
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
        }
      })();
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