import { createHmac } from 'crypto';
import { config } from '../config';

export interface TelegramInitData {
  user: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
    is_premium?: boolean;
  };
  auth_date: number;
  hash: string;
  query_id?: string;
}

export function validateTelegramInitData(initData: string): TelegramInitData | null {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  params.delete('hash');

  if (!hash) return null;

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = createHmac('sha256', 'WebAppData').update(config.TELEGRAM_BOT_TOKEN).digest();
  const calculatedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (calculatedHash !== hash) return null;

  const authDate = parseInt(params.get('auth_date') || '0', 10);
  const now = Math.floor(Date.now() / 1000);
  if (now - authDate > 86400) return null; // 24 hours

  const userParam = params.get('user');
  if (!userParam) return null;

  try {
    const user = JSON.parse(userParam);
    return {
      user,
      auth_date: authDate,
      hash,
      query_id: params.get('query_id') || undefined,
    };
  } catch {
    return null;
  }
}

export function extractInitDataFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith('tma ')) return null;
  return authHeader.slice(4);
}