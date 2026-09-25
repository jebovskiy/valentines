-- Store the user's Telegram profile photo URL (from initData) so partners who
-- haven't interacted with the bot directly can still be shown an avatar.
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS photo_url text;