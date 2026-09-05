-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_net";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- Pairs table
CREATE TABLE pairs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_a bigint NOT NULL,
  telegram_user_b bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_pair_users UNIQUE (telegram_user_a, telegram_user_b)
);

CREATE INDEX idx_pairs_user_a ON pairs (telegram_user_a);
CREATE INDEX idx_pairs_user_b ON pairs (telegram_user_b);

-- Devices table (companion apps)
CREATE TABLE devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id uuid NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
  telegram_user_id bigint NOT NULL,
  platform text NOT NULL CHECK (platform IN ('ios', 'android')),
  push_token text NOT NULL,
  paired_at timestamptz NOT NULL DEFAULT now(),
  push_permission_granted boolean NOT NULL DEFAULT false,
  widget_added boolean NOT NULL DEFAULT false,
  CONSTRAINT unique_device_per_pair_user_platform UNIQUE (pair_id, telegram_user_id, platform)
);

CREATE INDEX idx_devices_pair_id ON devices (pair_id);
CREATE INDEX idx_devices_telegram_user ON devices (telegram_user_id);

-- Valentines table
CREATE TABLE valentines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id uuid NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
  sender_telegram_id bigint NOT NULL,
  animation_type text NOT NULL DEFAULT 'heart_open',
  message text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  seen_at timestamptz
);

CREATE INDEX idx_valentines_pair_id ON valentines (pair_id);
CREATE INDEX idx_valentines_sent_at ON valentines (sent_at DESC);

-- Push jobs queue (for retries and audit)
CREATE TABLE push_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  valentine_id uuid NOT NULL REFERENCES valentines(id) ON DELETE CASCADE,
  device_id uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('visible', 'data')),
  status text NOT NULL CHECK (status IN ('pending', 'sent', 'failed')) DEFAULT 'pending',
  attempts int NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_push_jobs_status ON push_jobs (status);
CREATE INDEX idx_push_jobs_valentine_id ON push_jobs (valentine_id);
CREATE INDEX idx_push_jobs_device_id ON push_jobs (device_id);
CREATE INDEX idx_push_jobs_last_attempt ON push_jobs (last_attempt_at) WHERE status = 'pending';

-- Pairing tokens (one-time use for companion app pairing)
CREATE TABLE pairing_tokens (
  token uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id bigint NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pairing_tokens_expires ON pairing_tokens (expires_at);
CREATE INDEX idx_pairing_tokens_user ON pairing_tokens (telegram_user_id);

-- RLS policies (enable RLS and add policies)
ALTER TABLE pairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE valentines ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pairing_tokens ENABLE ROW LEVEL SECURITY;

-- Service role has full access (via service_role_key)
-- Anon key policies for Mini App access:
-- Pairs: users can only see their own pair
CREATE POLICY "Users can view their own pair" ON pairs
  FOR SELECT USING (
    telegram_user_a = (current_setting('request.jwt.claims', true)::json->>'user_id')::bigint
    OR telegram_user_b = (current_setting('request.jwt.claims', true)::json->>'user_id')::bigint
  );

-- Devices: users can only see their own devices
CREATE POLICY "Users can view their own devices" ON devices
  FOR SELECT USING (
    telegram_user_id = (current_setting('request.jwt.claims', true)::json->>'user_id')::bigint
  );

-- Valentines: users can only see valentines from their pair
CREATE POLICY "Users can view valentines from their pair" ON valentines
  FOR SELECT USING (
    pair_id IN (
      SELECT id FROM pairs
      WHERE telegram_user_a = (current_setting('request.jwt.claims', true)::json->>'user_id')::bigint
         OR telegram_user_b = (current_setting('request.jwt.claims', true)::json->>'user_id')::bigint
    )
  );

CREATE POLICY "Users can insert valentines to their pair" ON valentines
  FOR INSERT WITH CHECK (
    pair_id IN (
      SELECT id FROM pairs
      WHERE telegram_user_a = (current_setting('request.jwt.claims', true)::json->>'user_id')::bigint
         OR telegram_user_b = (current_setting('request.jwt.claims', true)::json->>'user_id')::bigint
    )
    AND sender_telegram_id = (current_setting('request.jwt.claims', true)::json->>'user_id')::bigint
  );