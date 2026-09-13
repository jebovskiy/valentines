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
import { placesRoutes } from './routes/places';
import { datesRoutes } from './routes/dates';
import { integrationsRoutes } from './routes/integrations';
import { ensureStorageBucket } from './utils/storage';
import { startNotificationScheduler } from './services/notificationScheduler';
import { startUpdateBroadcast } from './services/updateBroadcaster';

const app = fastify({ logger: true });

async function start() {
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
  await app.register(integrationsRoutes, { prefix: '/api/integrations' });

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
}

start();