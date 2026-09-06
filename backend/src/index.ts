import fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { config } from './config';
import { pairsRoutes } from './routes/pairs';
import { valentinesRoutes } from './routes/valentines';
import { pushRoutes } from './routes/push';
import { companionRoutes } from './routes/companion';

const app = fastify({ logger: true });

async function start() {
  await app.register(cors, { origin: true });
  await app.register(helmet);
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });

  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  await app.register(pairsRoutes, { prefix: '/api/pairs' });
  await app.register(valentinesRoutes, { prefix: '/api/valentines' });
  await app.register(pushRoutes, { prefix: '/api/push' });
  await app.register(companionRoutes, { prefix: '/api/companion' });

  try {
    await app.listen({ port: config.PORT, host: '0.0.0.0' });
    console.log(`Server running on port ${config.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();