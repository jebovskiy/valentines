-- Store display names so the Mini App can show "вы и Аня · 47 дней вместе"
ALTER TABLE pairs ADD COLUMN IF NOT EXISTS user_a_name text;
ALTER TABLE pairs ADD COLUMN IF NOT EXISTS user_b_name text;

ALTER TABLE pair_invites ADD COLUMN IF NOT EXISTS creator_first_name text;