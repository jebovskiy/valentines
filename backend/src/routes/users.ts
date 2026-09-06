import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getPairByUser, getUserProfile, upsertUserProfile, updateUserDisplayName, updatePairUserName } from '../services/database';
import { getAvatarFilePath, avatarProxyPath } from '../services/telegramAvatar';
import { telegramAuthMiddleware, requireTelegramAuth } from '../middleware/auth';
import { config } from '../config';

const updateNameSchema = z.object({
  name: z.string().min(1).max(50).trim(),
});

export async function usersRoutes(app: FastifyInstance) {
  const protectedRoutes = { preHandler: [telegramAuthMiddleware, requireTelegramAuth] };

  app.get('/me', protectedRoutes, async (request, reply) => {
    const userId = request.telegramUser!.id;

    const pair = await getPairByUser(userId);
    const userProfile = await getUserProfile(userId).catch(() => null);

    // Persist fresh Telegram identity on every open so partner can see latest nick/first name
    await upsertUserProfile({
      telegram_user_id: userId,
      username: request.telegramUser!.username ?? userProfile?.username ?? null,
      first_name: request.telegramUser!.first_name ?? userProfile?.first_name ?? null,
    }).catch(() => {});

    const me = {
      id: userId,
      username: request.telegramUser!.username ?? userProfile?.username ?? null,
      first_name: request.telegramUser!.first_name ?? userProfile?.first_name ?? null,
      display_name: userProfile?.display_name ?? (pair
        ? (pair.telegram_user_a === userId ? pair.user_a_name : pair.user_b_name)
        : request.telegramUser!.first_name ?? null),
      avatar_url: avatarProxyPath(userId),
    };

    if (!pair) {
      return { me, partner: null };
    }

    const partnerId = pair.telegram_user_a === userId ? pair.telegram_user_b : pair.telegram_user_a;
    const partnerProfile = await getUserProfile(partnerId).catch(() => null);
    const partnerPairName = pair.telegram_user_a === partnerId ? pair.user_a_name : pair.user_b_name;

    const partner = {
      id: partnerId,
      username: partnerProfile?.username ?? null,
      first_name: partnerProfile?.first_name ?? partnerPairName ?? null,
      display_name: partnerProfile?.display_name ?? partnerPairName ?? partnerProfile?.first_name ?? null,
      avatar_url: avatarProxyPath(partnerId),
    };

    return { me, partner };
  });

  app.patch('/me/name', protectedRoutes, async (request, reply) => {
    const body = updateNameSchema.parse(request.body);
    const userId = request.telegramUser!.id;
    const name = body.name;

    const pair = await getPairByUser(userId);
    if (!pair) {
      return reply.code(404).send({ error: 'Pair not found' });
    }

    try {
      await updateUserDisplayName(userId, name);
      await updatePairUserName(pair, userId, name);
    } catch (error) {
      return reply.code(500).send({ error: (error as Error).message });
    }

    return { success: true, name };
  });

  app.get('/:id/avatar', async (request, reply) => {
    const params = z.object({ id: z.coerce.number().int().positive() }).parse(request.params);
    const userId = params.id;

    let filePath: string | null = null;
    try {
      filePath = await getAvatarFilePath(userId);
    } catch (error) {
      app.log.error({ msg: 'avatar resolve failed' });
    }
    if (!filePath) {
      return reply.code(404).send({ error: 'No avatar' });
    }

    const fileUrl = `https://api.telegram.org/file/bot${config.TELEGRAM_BOT_TOKEN}/${filePath}`;
    try {
      const response = await fetch(fileUrl);
      if (!response.ok) {
        return reply.code(response.status).send({ error: 'Avatar unavailable' });
      }
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      const buffer = Buffer.from(await response.arrayBuffer());
      reply.header('content-type', contentType);
      reply.header('cache-control', 'public, max-age=86400');
      return reply.send(buffer);
    } catch (error) {
      app.log.error({ msg: 'avatar fetch failed' });
      return reply.code(502).send({ error: 'Avatar unavailable' });
    }
  });
}