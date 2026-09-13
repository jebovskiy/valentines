import { FastifyInstance } from 'fastify';
import { telegramAuthMiddleware, requireTelegramAuth } from '../middleware/auth';
import { config } from '../config';

export async function integrationsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', telegramAuthMiddleware);

  app.get('/', { preHandler: requireTelegramAuth }, async () => {
    return {
      integrations: [
        {
          id: 'google_places',
          name: 'Google Places',
          description: 'Места рядом: рестораны, парки, кино и другие локации для свиданий.',
          icon: '📍',
          connected: Boolean(config.GOOGLE_MAPS_API_KEY),
          capabilities: ['«Куда пойти» — подбор 3 мест для свидания по бюджету, расстоянию и настроению'],
        },
        {
          id: 'gemini',
          name: 'Gemini AI',
          description: 'Анализ фильмов, профиль вкуса и совместимость ваших оценок.',
          icon: '🤖',
          connected: Boolean(config.GEMINI_API_KEY),
          capabilities: ['Инсайты по фильмам', 'Профиль вкуса', 'Совпадение вкусов'],
        },
        {
          id: 'poiskkino',
          name: 'ПоискКино',
          description: 'Каталог фильмов: названия, постеры, рейтинги и жанры.',
          icon: '🎬',
          connected: true,
          capabilities: ['Каталог фильмов для вашего списка'],
        },
      ],
    };
  });
}