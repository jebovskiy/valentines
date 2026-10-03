import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getPairByUser } from '../services/database';
import { telegramAuthMiddleware, requireTelegramAuth } from '../middleware/auth';
import { userRateLimit } from '../middleware/rateLimit';
import {
  DEFAULT_RECAP_PERIOD,
  RECAP_PERIODS,
  buildRecapAggregates,
  fetchRecapRawData,
  generateRecapSummary,
  periodStartFor,
  type RecapPeriodKey,
} from '../services/recap';

const RECAP_PERIOD_KEYS = Object.keys(RECAP_PERIODS) as [RecapPeriodKey, ...RecapPeriodKey[]];

// Сводка собирается с вызовом LLM, поэтому запросов на открытие экрана должно быть мало.
const recapRateLimit = userRateLimit({ key: 'recap', max: 5, timeWindowMs: 60_000 });

const recapQuerySchema = z.object({
  period: z.enum(RECAP_PERIOD_KEYS).default(DEFAULT_RECAP_PERIOD),
  // Смещение устройства в минутах, как у Date#getTimezoneOffset: UTC+3 => -180.
  // Без него час активности считался бы в UTC и был бы бессмысленным.
  tz_offset_minutes: z.coerce.number().int().min(-840).max(840).optional(),
});

export async function recapRoutes(app: FastifyInstance) {
  app.addHook('preHandler', telegramAuthMiddleware);

  app.get(
    '/',
    { preHandler: [requireTelegramAuth, recapRateLimit] },
    async (request, reply) => {
      const query = recapQuerySchema.parse(request.query);
      const pair = await getPairByUser(request.telegramUser!.id);
      if (!pair) {
        return reply.code(404).send({ error: 'Pair not found' });
      }

      const periodStart = periodStartFor(query.period, new Date());
      const raw = await fetchRecapRawData(
        pair.id,
        query.period,
        periodStart,
        {
          telegram_user_a: pair.telegram_user_a,
          telegram_user_b: pair.telegram_user_b,
          user_a_name: pair.user_a_name,
          user_b_name: pair.user_b_name,
          max_streak: pair.max_streak,
        },
        query.tz_offset_minutes ?? 0
      );

      const aggregates = buildRecapAggregates(raw);
      const summary = await generateRecapSummary(aggregates);

      return { recap: { period: query.period, aggregates, summary } };
    }
  );
}