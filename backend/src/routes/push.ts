import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { dispatchPush, retryPendingPushJobs } from '../services/pushDispatcher';
import { verifyWebhookSignature } from '../middleware/webhook';

const pushDispatchSchema = z.object({
  valentine_id: z.string().uuid(),
  device_id: z.string().uuid(),
  channel: z.enum(['visible', 'data']),
});

export async function pushRoutes(app: FastifyInstance) {
  app.addHook('preHandler', verifyWebhookSignature);

  app.post('/dispatch', async (request) => {
    const body = pushDispatchSchema.parse(request.body);
    await dispatchPush(body);
    return { success: true };
  });

  app.post('/retry', async () => {
    await retryPendingPushJobs();
    return { success: true };
  });
}