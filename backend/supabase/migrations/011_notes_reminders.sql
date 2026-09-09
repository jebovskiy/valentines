-- Shared notes between partners
CREATE TABLE IF NOT EXISTS notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id uuid NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
  author_id bigint NOT NULL,
  content text NOT NULL,
  category text NOT NULL DEFAULT 'idea',
  is_pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notes_pair ON notes (pair_id, created_at DESC);

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Pair members can read notes" ON notes;
CREATE POLICY "Pair members can read notes" ON notes
  FOR SELECT USING (
    auth.uid() IS NULL OR
    EXISTS (
      SELECT 1 FROM pairs p
      WHERE p.id = notes.pair_id
        AND (p.telegram_user_a::text = auth.uid()::text
             OR p.telegram_user_b::text = auth.uid()::text)
    )
  );

DROP POLICY IF EXISTS "Pair members can insert notes" ON notes;
CREATE POLICY "Pair members can insert notes" ON notes
  FOR INSERT WITH CHECK (auth.uid() IS NULL);

DROP POLICY IF EXISTS "Pair members can update notes" ON notes;
CREATE POLICY "Pair members can update notes" ON notes
  FOR UPDATE USING (auth.uid() IS NULL);

DROP POLICY IF EXISTS "Pair members can delete notes" ON notes;
CREATE POLICY "Pair members can delete notes" ON notes
  FOR DELETE USING (auth.uid() IS NULL);

-- Scheduled reminders
CREATE TABLE IF NOT EXISTS reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id uuid NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
  author_id bigint NOT NULL,
  title text NOT NULL,
  message text,
  remind_at timestamptz NOT NULL,
  is_recurring boolean NOT NULL DEFAULT false,
  recurrence text,
  is_sent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reminders_pair ON reminders (pair_id, remind_at);
CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders (is_sent, remind_at) WHERE is_sent = false;

ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Pair members can read reminders" ON reminders;
CREATE POLICY "Pair members can read reminders" ON reminders
  FOR SELECT USING (
    auth.uid() IS NULL OR
    EXISTS (
      SELECT 1 FROM pairs p
      WHERE p.id = reminders.pair_id
        AND (p.telegram_user_a::text = auth.uid()::text
             OR p.telegram_user_b::text = auth.uid()::text)
    )
  );

DROP POLICY IF EXISTS "Pair members can insert reminders" ON reminders;
CREATE POLICY "Pair members can insert reminders" ON reminders
  FOR INSERT WITH CHECK (auth.uid() IS NULL);

DROP POLICY IF EXISTS "Pair members can delete reminders" ON reminders;
CREATE POLICY "Pair members can delete reminders" ON reminders
  FOR DELETE USING (auth.uid() IS NULL);

-- Couple events (anniversaries, birthdays, etc.)
CREATE TABLE IF NOT EXISTS couple_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id uuid NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
  name text NOT NULL,
  event_date date NOT NULL,
  event_type text NOT NULL DEFAULT 'custom',
  remind_days_before integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_pair ON couple_events (pair_id, event_date);

ALTER TABLE couple_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Pair members can read events" ON couple_events;
CREATE POLICY "Pair members can read events" ON couple_events
  FOR SELECT USING (
    auth.uid() IS NULL OR
    EXISTS (
      SELECT 1 FROM pairs p
      WHERE p.id = couple_events.pair_id
        AND (p.telegram_user_a::text = auth.uid()::text
             OR p.telegram_user_b::text = auth.uid()::text)
    )
  );

DROP POLICY IF EXISTS "Pair members can insert events" ON couple_events;
CREATE POLICY "Pair members can insert events" ON couple_events
  FOR INSERT WITH CHECK (auth.uid() IS NULL);

DROP POLICY IF EXISTS "Pair members can update events" ON couple_events;
CREATE POLICY "Pair members can update events" ON couple_events
  FOR UPDATE USING (auth.uid() IS NULL);

DROP POLICY IF EXISTS "Pair members can delete events" ON couple_events;
CREATE POLICY "Pair members can delete events" ON couple_events
  FOR DELETE USING (auth.uid() IS NULL);