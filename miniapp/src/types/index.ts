export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export interface Pair {
  id: string;
  telegram_user_a: number;
  telegram_user_b: number;
  user_a_name: string | null;
  user_b_name: string | null;
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

export type AnimationType = 'heart_open' | 'sparkle' | 'moon' | 'flame';

export interface AnimationDef {
  type: AnimationType;
  emoji: string;
  label: string;
}

export const ANIMATIONS: AnimationDef[] = [
  { type: 'heart_open', emoji: '💌', label: 'Валентинка' },
  { type: 'sparkle', emoji: '✨', label: 'Блеск' },
  { type: 'moon', emoji: '🌙', label: 'Ночь' },
  { type: 'flame', emoji: '🔥', label: 'Страсть' },
];

export function getAnimation(type: AnimationType): AnimationDef {
  return ANIMATIONS.find((a) => a.type === type) ?? ANIMATIONS[0];
}

export interface Valentine {
  id: string;
  pair_id: string;
  sender_telegram_id: number;
  animation_type: AnimationType;
  message: string | null;
  photo_url: string | null;
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

export const TEST_TELEGRAM_ID = 461666389;

export interface SendValentineRequest {
  animation_type: AnimationType;
  message?: string | null;
  recipient?: 'partner' | 'self';
  photo_base64?: string | null;
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

export interface UserProfile {
  id: number;
  username: string | null;
  first_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
}