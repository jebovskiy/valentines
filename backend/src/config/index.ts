import { z } from 'zod';

const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_ANON_KEY: z.string().min(1),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_URL: z.string().url().optional(),
  MINI_APP_URL: z.string().url().optional(),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  FCM_SERVICE_ACCOUNT_JSON: z.string().min(1),
  WEBHOOK_SHARED_SECRET: z.string().min(32),
  PAIRING_TOKEN_TTL_MINUTES: z.coerce.number().default(10),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-3.5-flash-lite'),
  AI_PROVIDER: z
    .preprocess((v) => (typeof v === 'string' ? v.trim().toLowerCase() : v), z.enum(['gemini', 'deepseek', 'groq', 'openrouter']).catch('gemini')),
  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_MODEL: z.string().default('deepseek-v4-flash'),
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().default('deepseek/deepseek-v4.1-flash'),
  POISKKINO_API_KEY: z.string().optional(),
  GOOGLE_MAPS_API_KEY: z.string().optional(),
});

const parsed = envSchema.parse(process.env);

if (!parsed.APP_URL) {
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    parsed.APP_URL = `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  } else {
    parsed.APP_URL = `http://localhost:${parsed.PORT}`;
  }
}

if (!parsed.MINI_APP_URL) {
  parsed.MINI_APP_URL = `https://valentines-sigma-neon.vercel.app`;
}

export const config = parsed;

export const KNOWN_ANIMATION_TYPES = [
  'heart_open',
  'sparkle',
  'moon',
  'flame',
  'bloom_petals',
  'golden_halo',
] as const;
export type AnimationType = typeof KNOWN_ANIMATION_TYPES[number];

export function isKnownAnimationType(type: string): type is AnimationType {
  return KNOWN_ANIMATION_TYPES.includes(type as AnimationType);
}