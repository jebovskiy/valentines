-- Aspect scores for movies (cached Gemini classification, 6 aspects 1-5)
ALTER TABLE movies ADD COLUMN IF NOT EXISTS aspect_scores jsonb;

-- Taste profiles: per-user importance weights for the 6 aspects (1-5)
CREATE TABLE IF NOT EXISTS taste_profiles (
  user_telegram_id bigint PRIMARY KEY,
  aspect_weights jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);