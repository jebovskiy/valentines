-- «Куда пойти» — date spot picker sessions and swipe votes
CREATE TABLE IF NOT EXISTS date_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id uuid NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
  initiator_id bigint NOT NULL,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  places jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'done')),
  match jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_date_sessions_pair_active
  ON date_sessions (pair_id, created_at DESC)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS date_votes (
  session_id uuid NOT NULL REFERENCES date_sessions(id) ON DELETE CASCADE,
  user_id bigint NOT NULL,
  place_index integer NOT NULL CHECK (place_index BETWEEN 0 AND 2),
  choice text NOT NULL CHECK (choice IN ('like', 'dislike')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, user_id, place_index)
);

CREATE INDEX IF NOT EXISTS idx_date_votes_session ON date_votes (session_id);

ALTER TABLE date_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE date_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Pair members can read date_sessions" ON date_sessions;
CREATE POLICY "Pair members can read date_sessions" ON date_sessions
  FOR SELECT USING (
    auth.uid() IS NULL OR
    EXISTS (
      SELECT 1 FROM pairs p
      WHERE p.id = date_sessions.pair_id
        AND (p.telegram_user_a::text = auth.uid()::text
             OR p.telegram_user_b::text = auth.uid()::text)
    )
  );

DROP POLICY IF EXISTS "Service role can insert date_sessions" ON date_sessions;
CREATE POLICY "Service role can insert date_sessions" ON date_sessions
  FOR INSERT WITH CHECK (auth.uid() IS NULL);

DROP POLICY IF EXISTS "Service role can update date_sessions" ON date_sessions;
CREATE POLICY "Service role can update date_sessions" ON date_sessions
  FOR UPDATE USING (auth.uid() IS NULL);

DROP POLICY IF EXISTS "Service role can delete date_sessions" ON date_sessions;
CREATE POLICY "Service role can delete date_sessions" ON date_sessions
  FOR DELETE USING (auth.uid() IS NULL);

DROP POLICY IF EXISTS "Pair members can read date_votes" ON date_votes;
CREATE POLICY "Pair members can read date_votes" ON date_votes
  FOR SELECT USING (
    auth.uid() IS NULL OR
    EXISTS (
      SELECT 1 FROM date_sessions s
      JOIN pairs p ON p.id = s.pair_id
      WHERE s.id = date_votes.session_id
        AND (p.telegram_user_a::text = auth.uid()::text
             OR p.telegram_user_b::text = auth.uid()::text)
    )
  );

DROP POLICY IF EXISTS "Service role can insert date_votes" ON date_votes;
CREATE POLICY "Service role can insert date_votes" ON date_votes
  FOR INSERT WITH CHECK (auth.uid() IS NULL);

-- Realtime: make sure both tables are in the realtime publication for live swipes.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'date_sessions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.date_sessions;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'date_votes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.date_votes;
  END IF;
END $$;