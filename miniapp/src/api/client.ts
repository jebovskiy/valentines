import { getInitData, getTelegramSelfPhotoUrl } from '../utils/telegram';
import type {
  Pair,
  Valentine,
  ValentineWithSender,
  SendValentineRequest,
  PairingInitResult,
  CompletePairingResult,
  UserProfile,
  ApiResponse,
  Greeting,
  GreetingType,
} from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

async function fetchWithAuth<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const initData = getInitData();
  const headers = new Headers(options.headers);
  if (initData) {
    headers.set('Authorization', `tma ${initData}`);
  }
  const hasBody = options.body !== undefined && options.body !== null;
  if (hasBody) {
    headers.set('Content-Type', 'application/json');
  }

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const text = await response.text();
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text || `HTTP ${response.status}` };
    }

    if (!response.ok) {
      return { error: (data.error as string) || `HTTP ${response.status}` };
    }

    return { data: data as T };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

export const api = {
  // Pairs
  getMyPair: () => fetchWithAuth<{ pair: Pair; pairing: { android_paired: boolean } }>('/api/pairs/me'),
  createPair: (partnerTelegramId: number) =>
    fetchWithAuth<{ pair_id: string }>('/api/pairs', {
      method: 'POST',
      body: JSON.stringify({ partner_telegram_id: partnerTelegramId }),
    }),
  createInvite: () => fetchWithAuth<{ code: string; expires_at: string }>('/api/pairs/invite', { method: 'POST' }),
  joinInvite: (code: string) =>
    fetchWithAuth<{ pair_id: string }>('/api/pairs/join', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  // Pairing
  initiatePairing: () => fetchWithAuth<PairingInitResult>('/api/pairs/pairing/initiate', { method: 'POST' }),
  completePairing: (token: string, platform: 'ios' | 'android', pushToken: string) =>
    fetchWithAuth<CompletePairingResult>('/api/pairs/pairing/complete', {
      method: 'POST',
      body: JSON.stringify({ token, platform, push_token: pushToken }),
    }),
  getPairingStatus: (token: string) =>
    fetchWithAuth<{ status: 'pending' | 'completed' | 'expired' }>(`/api/pairs/pairing/${token}/status`),

  // Valentines
  getValentines: () => fetchWithAuth<{ valentines: Valentine[] }>('/api/valentines'),
  getValentine: (id: string) => fetchWithAuth<{ valentine: ValentineWithSender }>(`/api/valentines/${id}`),
  sendValentine: (payload: SendValentineRequest) =>
    fetchWithAuth<{ valentine: Valentine }>('/api/valentines', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  markSeen: (id: string) =>
    fetchWithAuth<{ success: boolean }>(`/api/valentines/${id}/seen`, { method: 'POST' }),

  // Greetings ("доброе утро")
  getGreetings: () => fetchWithAuth<{ greetings: Greeting[] }>('/api/greetings'),
  sendGreeting: (type: GreetingType) =>
    fetchWithAuth<{ greeting: Greeting }>('/api/greetings', {
      method: 'POST',
      body: JSON.stringify({ type }),
    }),

  // Users / profile
  getMyProfile: () => fetchWithAuth<{ me: UserProfile; partner: UserProfile | null }>('/api/users/me'),
  updateMyName: (name: string) =>
    fetchWithAuth<{ success: boolean; name: string }>('/api/users/me/name', {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }),
  avatarUrl: (telegramUserId: number) => `${API_URL}/api/users/${telegramUserId}/avatar?v=3`,
  // Own avatar: prefer the photo_url Telegram itself gives us in initData
  // (always loadable in the WebView), fall back to the backend proxy.
  selfAvatarUrl: (telegramUserId: number) =>
    getTelegramSelfPhotoUrl() || `${API_URL}/api/users/${telegramUserId}/avatar?v=3`,
};