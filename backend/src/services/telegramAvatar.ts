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

export async function getAvatarFilePath(telegramUserId: number, forceRefresh = false): Promise<string | null> {
  const existing = await getUserProfile(telegramUserId).catch(() => null);
  if (!forceRefresh && existing?.avatar_file_path) {
    return existing.avatar_file_path;
  }

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

  await upsertUserProfile({ telegram_user_id: telegramUserId, avatar_file_path: filePath }).catch(() => {});
  return filePath;
}

export function avatarProxyPath(telegramUserId: number): string {
  return `/api/users/${telegramUserId}/avatar`;
}