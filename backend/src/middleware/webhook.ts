import type { FastifyRequest, FastifyReply } from 'fastify';
import { createHmac, timingSafeEqual } from 'crypto';
import { config } from '../config';

// Signature check is fully synchronous, so this can be a callback-style hook
// (arity 3). It must not return the reply: `FastifyReply` is thenable and
// returning it makes the hook look Promise-returning where a void return is
// expected. `done()` is called unconditionally for the same reason as
// requireTelegramAuth — the 401 short-circuits the route via `reply.sent`.
export function verifyWebhookSignature(
  request: FastifyRequest,
  reply: FastifyReply,
  done: () => void,
): void {
  const signature = request.headers['x-webhook-signature'] as string;
  if (!signature) {
    void reply.code(401).send({ error: 'Missing webhook signature' });
    done();
    return;
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
    void reply.code(401).send({ error: 'Invalid webhook signature' });
    done();
    return;
  }

  done();
}