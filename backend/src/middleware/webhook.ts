import { FastifyRequest, FastifyReply } from 'fastify';
import { createHmac, timingSafeEqual } from 'crypto';
import { config } from '../config';

export async function verifyWebhookSignature(request: FastifyRequest, reply: FastifyReply) {
  const signature = request.headers['x-webhook-signature'] as string;
  if (!signature) {
    return reply.code(401).send({ error: 'Missing webhook signature' });
  }

  const body = JSON.stringify(request.body);
  const expectedSignature = createHmac('sha256', config.WEBHOOK_SHARED_SECRET).update(body).digest('hex');

  const actualBuf = Buffer.from(signature, 'hex');
  const expectedBuf = Buffer.from(expectedSignature, 'hex');

  if (
    actualBuf.length !== expectedBuf.length ||
    actualBuf.length === 0 ||
    !timingSafeEqual(actualBuf, expectedBuf)
  ) {
    return reply.code(401).send({ error: 'Invalid webhook signature' });
  }
}