-- Greetings ("доброе утро" / "спокойной ночи") for a pair.
-- Idempotent: safe to re-run if a partial attempt already created the table.
CREATE TABLE IF NOT EXISTS greetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id uuid NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
  sender_telegram_id bigint NOT NULL,
  type text NOT NULL DEFAULT 'morning' CHECK (type IN ('morning', 'night')),
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_greetings_pair_type ON greetings (pair_id, type, sent_at DESC);

ALTER TABLE greetings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view greetings from their pair" ON greetings;
CREATE POLICY "Users can view greetings from their pair" ON greetings
  FOR SELECT USING (
    pair_id IN (
      SELECT id FROM pairs
      WHERE telegram_user_a = (current_setting('request.jwt.claims', true)::json->>'user_id')::bigint
         OR telegram_user_b = (current_setting('request.jwt.claims', true)::json->>'user_id')::bigint
    )
  );

DROP POLICY IF EXISTS "Users can insert greetings to their pair" ON greetings;
CREATE POLICY "Users can insert greetings to their pair" ON greetings
  FOR INSERT WITH CHECK (
    pair_id IN (
      SELECT id FROM pairs
      WHERE telegram_user_a = (current_setting('request.jwt.claims', true)::json->>'user_id')::bigint
         OR telegram_user_b = (current_setting('request.jwt.claims', true)::json->>'user_id')::bigint
    )
    AND sender_telegram_id = (current_setting('request.jwt.claims', true)::json->>'user_id')::bigint
  );