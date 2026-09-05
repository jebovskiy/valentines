export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

export interface Pair {
  id: string;
  telegram_user_a: number;
  telegram_user_b: number;
  created_at: string;
}

export interface Device {
  id: string;
  pair_id: string;
  telegram_user_id: number;
  platform: 'ios' | 'android';
  push_token: string;
  paired_at: string;
  push_permission_granted: boolean;
  widget_added: boolean;
}

export type AnimationType = 'heart_open';

export interface Valentine {
  id: string;
  pair_id: string;
  sender_telegram_id: number;
  animation_type: AnimationType;
  message: string | null;
  sent_at: string;
  delivered_at: string | null;
  seen_at: string | null;
}

export interface ValentineWithSender extends Valentine {
  sender_name: string;
  is_own: boolean;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export interface SendValentineRequest {
  animation_type: AnimationType;
  message?: string | null;
}

export interface PairingInitResult {
  pairingUrl: string;
  token: string;
  expiresAt: string;
}

export interface CompletePairingResult {
  pairId: string;
  partnerTelegramId: number;
  deviceId: string;
}