import type { FastifyInstance } from 'fastify';
import { config } from '../config';
import { handleBotText, registerBot, type TelegramUpdate } from '../services/telegramBot';

export function botRoutes(app: FastifyInstance) {
  // Telegram pushes updates here (see setWebhook in registerBot).
  app.post('/', async (request, reply) => {
    const secret = request.headers['x-telegram-bot-api-secret-token'] as string | undefined;
    if (!secret || secret !== config.WEBHOOK_SHARED_SECRET) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const update = request.body as TelegramUpdate;
    if (update?.message?.text) {
      // Fire and forget; failures are logged on the send side.
      void handleBotText(update.message).catch((error) => console.error('TBot webhook handler:', error));
    }
    return { ok: true };
  });

  app.get('/set', async (request, reply) => {
    if (process.env.NODE_ENV === 'production') return reply.code(403).send({ error: 'Disabled in production' });
    const publicUrl = (request.query as { url?: string }).url;
    if (!publicUrl) return reply.code(400).send({ error: '?url= is required' });
    await registerBot(publicUrl);
    return { ok: true };
  });
}