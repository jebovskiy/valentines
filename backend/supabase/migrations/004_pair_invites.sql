-- Invite codes for pairing users without sharing Telegram IDs
CREATE TABLE pair_invites (
  code text PRIMARY KEY,
  creator_telegram_id bigint NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pair_invites_creator ON pair_invites (creator_telegram_id);
CREATE INDEX idx_pair_invites_expires ON pair_invites (expires_at);

ALTER TABLE pair_invites ENABLE ROW LEVEL SECURITY;

-- Only service role can read/write (backend manages invites);
-- no anon policies needed since flow goes through backend API.