import { z } from 'zod';

const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_ANON_KEY: z.string().min(1),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_URL: z.string().url(),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  FCM_SERVICE_ACCOUNT_JSON: z.string().min(1),
  WEBHOOK_SHARED_SECRET: z.string().min(32),
  PAIRING_TOKEN_TTL_MINUTES: z.coerce.number().default(10),
});

export const config = envSchema.parse(process.env);

export const KNOWN_ANIMATION_TYPES = ['heart_open'] as const;
export type AnimationType = typeof KNOWN_ANIMATION_TYPES[number];

export function isKnownAnimationType(type: string): type is AnimationType {
  return KNOWN_ANIMATION_TYPES.includes(type as AnimationType);
}