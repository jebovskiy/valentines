-- «Игры» — card-based game sessions and answers
CREATE TABLE IF NOT EXISTS game_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id uuid NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
  initiator_id bigint NOT NULL,
  game_id text NOT NULL,
  mood text,
  rounds jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'done')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_game_sessions_pair_active
  ON game_sessions (pair_id, created_at DESC)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS game_answers (
  session_id uuid NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  user_id bigint NOT NULL,
  round_index integer NOT NULL,
  answer text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, user_id, round_index)
);

CREATE INDEX IF NOT EXISTS idx_game_answers_session ON game_answers (session_id);

ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_answers ENABLE ROW LEVEL SECURITY;

-- Policies for game_sessions
DROP POLICY IF EXISTS "Pair members can read game_sessions" ON game_sessions;
CREATE POLICY "Pair members can read game_sessions" ON game_sessions
  FOR SELECT USING (
    auth.uid() IS NULL OR
    EXISTS (
      SELECT 1 FROM pairs p
      WHERE p.id = game_sessions.pair_id
        AND (p.telegram_user_a::text = auth.uid()::text
             OR p.telegram_user_b::text = auth.uid()::text)
    )
  );

DROP POLICY IF EXISTS "Service role can insert game_sessions" ON game_sessions;
CREATE POLICY "Service role can insert game_sessions" ON game_sessions
  FOR INSERT WITH CHECK (auth.uid() IS NULL);

DROP POLICY IF EXISTS "Service role can update game_sessions" ON game_sessions;
CREATE POLICY "Service role can update game_sessions" ON game_sessions
  FOR UPDATE USING (auth.uid() IS NULL);

DROP POLICY IF EXISTS "Service role can delete game_sessions" ON game_sessions;
CREATE POLICY "Service role can delete game_sessions" ON game_sessions
  FOR DELETE USING (auth.uid() IS NULL);

-- Policies for game_answers
DROP POLICY IF EXISTS "Pair members can read game_answers" ON game_answers;
CREATE POLICY "Pair members can read game_answers" ON game_answers
  FOR SELECT USING (
    auth.uid() IS NULL OR
    EXISTS (
      SELECT 1 FROM game_sessions s
      JOIN pairs p ON p.id = s.pair_id
      WHERE s.id = game_answers.session_id
        AND (p.telegram_user_a::text = auth.uid()::text
             OR p.telegram_user_b::text = auth.uid()::text)
    )
  );

DROP POLICY IF EXISTS "Service role can insert game_answers" ON game_answers;
CREATE POLICY "Service role can insert game_answers" ON game_answers
  FOR INSERT WITH CHECK (auth.uid() IS NULL);

-- Realtime: make sure both tables are in the realtime publication for live updates.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'game_sessions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.game_sessions;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'game_answers') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.game_answers;
  END IF;
END $$;
