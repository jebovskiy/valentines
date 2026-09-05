import { FastifyRequest, FastifyReply } from 'fastify';
import { validateTelegramInitData, extractInitDataFromHeader, TelegramInitData } from '../utils/telegram';

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

export function requireTelegramAuth(request: FastifyRequest, reply: FastifyReply, done: () => void) {
  if (!request.telegramUser) {
    return reply.code(401).send({ error: 'Authentication required' });
  }
  done();
}