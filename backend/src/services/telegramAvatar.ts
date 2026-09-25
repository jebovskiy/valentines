import { config } from '../config';
import { getUserProfile, upsertUserProfile } from './database';

const TG_API = `https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}`;

interface GetUserProfilePhotosResult {
  ok: boolean;
  result?: {
    total_count: number;
    photos: Array<
      Array<{
        file_id: string;
        width: number;
        height: number;
        file_size?: number;
      }>
    >;
  };
  description?: string;
}

interface GetFileResult {
  ok: boolean;
  result?: {
    file_id: string;
    file_path?: string;
    file_size?: number;
  };
  description?: string;
}

async function callBot<T>(method: string, body: Record<string, unknown>): Promise<T | null> {
  try {
    const response = await fetch(`${TG_API}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => ({}))) as T;
    return data;
  } catch (error) {
    console.error(`TBot ${method} failed:`, error);
    return null;
  }
}

const AVATAR_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

export type AvatarSource = { kind: 'botFile'; filePath: string } | { kind: 'photoUrl'; url: string };

/**
 * Resolve a user's current Telegram profile photo, preferring the cached Bot
 * API file path, then a live Bot API lookup, then the public photo_url that
 * the user supplied via initData (https://t.me/i/userpic/...).
 *
 * The Bot API only serves photos of users the bot has "seen" (i.e. who have
 * chatted with the bot), so without the photo_url fallback the partner's
 * avatar would stay empty for users who never opened the bot chat.
 */
async function fetchBotFile(telegramUserId: number): Promise<string | null> {
  const photosResult = await callBot<GetUserProfilePhotosResult>('getUserProfilePhotos', {
    user_id: telegramUserId,
    offset: 0,
    limit: 1,
  });

  const photos = photosResult?.ok ? photosResult.result?.photos : [];
  const first = photos && photos[0];
  const largest = first && first[first.length - 1];
  if (!largest?.file_id) return null;

  const fileResult = await callBot<GetFileResult>('getFile', { file_id: largest.file_id });
  const filePath = fileResult?.ok ? fileResult.result?.file_path : undefined;
  if (!filePath) return null;

  await upsertUserProfile(
    { telegram_user_id: telegramUserId, avatar_file_path: filePath },
    { refreshUpdatedAt: true }
  ).catch(() => {});
  return filePath;
}

export async function resolveAvatarSource(telegramUserId: number): Promise<AvatarSource | null> {
  const existing = await getUserProfile(telegramUserId).catch(() => null);

  const cachedAgeMs = existing?.updated_at
    ? Date.now() - new Date(existing.updated_at).getTime()
    : Number.POSITIVE_INFINITY;
  if (existing?.avatar_file_path && cachedAgeMs < AVATAR_CACHE_TTL_MS) {
    return { kind: 'botFile', filePath: existing.avatar_file_path };
  }

  const filePath = await fetchBotFile(telegramUserId);
  if (filePath) return { kind: 'botFile', filePath };

  // Fallback: the user's own initData photo_url, refreshed each time the app opens.
  if (existing?.photo_url) return { kind: 'photoUrl', url: existing.photo_url };

  return null;
}

export function avatarProxyPath(telegramUserId: number): string {
  return `/api/users/${telegramUserId}/avatar`;
}