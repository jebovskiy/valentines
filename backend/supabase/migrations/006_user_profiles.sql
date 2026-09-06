-- Store per-user profile data (Telegram username, avatar, custom display name)
CREATE TABLE IF NOT EXISTS user_profiles (
  telegram_user_id bigint PRIMARY KEY,
  username text,
  first_name text,
  display_name text,
  avatar_file_path text,
  updated_at timestamptz NOT NULL DEFAULT now()
);