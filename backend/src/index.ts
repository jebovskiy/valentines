import fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { config } from './config';
import { pairsRoutes } from './routes/pairs';
import { valentinesRoutes } from './routes/valentines';
import { pushRoutes } from './routes/push';
import { companionRoutes } from './routes/companion';
import { usersRoutes } from './routes/users';
import { greetingsRoutes } from './routes/greetings';
import { notesRoutes } from './routes/notes';
import { remindersRoutes } from './routes/reminders';
import { eventsRoutes } from './routes/events';
import { moviesRoutes } from './routes/movies';
import { placesRoutes, placesPhotoRoutes } from './routes/places';
import { datesRoutes } from './routes/dates';
import { integrationsRoutes } from './routes/integrations';
import { gamesRoutes } from './routes/games';
import { menuRoutes } from './routes/menu';
import { botRoutes } from './routes/bot';
import { registerBot } from './services/telegramBot';
import { ensureStorageBucket } from './utils/storage';
import { startNotificationScheduler } from './services/notificationScheduler';
import { startUpdateBroadcast } from './services/updateBroadcaster';

const app = fastify({ logger: true });

function activeAiModel(): string {
  switch (config.AI_PROVIDER) {
    case 'deepseek':
      return config.DEEPSEEK_MODEL;
    case 'groq':
      return config.GROQ_MODEL;
    case 'openrouter':
      return config.OPENROUTER_MODEL;
    default:
      return config.GEMINI_MODEL;
  }
}

function logAiConfig(): void {
  console.log(
    `[llm] ai config: provider=${config.AI_PROVIDER} model=${activeAiModel()}` +
      ` openrouterKey=${config.OPENROUTER_API_KEY ? 'set' : 'missing'}` +
      ` deepseekKey=${config.DEEPSEEK_API_KEY ? 'set' : 'missing'}` +
      ` groqKey=${config.GROQ_API_KEY ? 'set' : 'missing'}` +
      ` geminiKey=${config.GEMINI_API_KEY ? 'set' : 'missing'}`
  );
}

async function start() {
  logAiConfig();
  await app.register(cors, { origin: true });
  await app.register(helmet);
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });

  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  await ensureStorageBucket();

  await app.register(pairsRoutes, { prefix: '/api/pairs' });
  await app.register(valentinesRoutes, { prefix: '/api/valentines' });
  await app.register(pushRoutes, { prefix: '/api/push' });
  await app.register(companionRoutes, { prefix: '/api/companion' });
  await app.register(usersRoutes, { prefix: '/api/users' });
  await app.register(greetingsRoutes, { prefix: '/api/greetings' });
  await app.register(notesRoutes, { prefix: '/api/notes' });
  await app.register(remindersRoutes, { prefix: '/api/reminders' });
  await app.register(eventsRoutes, { prefix: '/api/events' });
  await app.register(moviesRoutes, { prefix: '/api/movies' });
  await app.register(placesRoutes, { prefix: '/api/places' });
  
  await app.register(datesRoutes, { prefix: '/api/dates' });
  
await app.register(gamesRoutes, { prefix: '/api/games' });
  await app.register(integrationsRoutes, { prefix: '/api/integrations' });
  await app.register(menuRoutes, { prefix: '/api/menu' });
  await app.register(botRoutes, { prefix: '/telegram' });

  // Background notification delivery that doesn't depend on Supabase cron
  // settings: sends Telegram + companion pushes for due reminders and events.
  startNotificationScheduler();
  startUpdateBroadcast();

try {
    await app.listen({ port: config.PORT, host: '0.0.0.0' });
    console.log(`Server running on port ${config.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  // Point the Telegram bot at this server so /start, /help, etc. work.
  if (config.APP_URL && config.APP_URL.startsWith('http')) {
    void registerBot(config.APP_URL);
  }
}

start();


