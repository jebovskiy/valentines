import type { FastifyRequest, FastifyReply } from 'fastify';
import type { TelegramInitData } from '../utils/telegram';
import { validateTelegramInitData, extractInitDataFromHeader } from '../utils/telegram';

declare module 'fastify' {
  interface FastifyRequest {
    telegramUser?: TelegramInitData['user'];
    telegramInitData?: TelegramInitData;
  }
}

export async function telegramAuthMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const initData = extractInitDataFromHeader(request.headers.authorization);
  if (!initData) {
    return reply.code(401).send({ error: 'Missing or invalid Authorization header' });
  }

  const validated = validateTelegramInitData(initData);
  if (!validated) {
    return reply.code(401).send({ error: 'Invalid Telegram initData' });
  }

  request.telegramUser = validated.user;
  request.telegramInitData = validated;
}

// FastifyReply is thenable (`reply.then()` exists so a handler can `return reply`),
// so returning it here would make this hook look Promise-returning to
// no-misused-promises. Send the 401 without returning the reply and always call
// `done()`: once the reply is sent, Fastify skips the remaining hooks and the
// route handler (`reply.sent === true` guards in hooks.js/handleRequest.js).
export function requireTelegramAuth(request: FastifyRequest, reply: FastifyReply, done: () => void): void {
  if (!request.telegramUser) {
    void reply.code(401).send({ error: 'Authentication required' });
  }
  done();
}