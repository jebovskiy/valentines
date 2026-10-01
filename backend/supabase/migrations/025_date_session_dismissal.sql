-- «Куда пойти» — per-user acknowledgement of a finished session.
-- The match has to stay visible until BOTH partners close it (otherwise the
-- partner who is still waiting would never see the result), but it must never
-- come back for a user who already dismissed it on the result screen.
ALTER TABLE date_sessions
  ADD COLUMN IF NOT EXISTS dismissed_by bigint[] NOT NULL DEFAULT '{}'::bigint[];

-- The "active"/latest lookup orders by created_at for a pair regardless of the
-- session status, and the partial index above only covers active rows.
CREATE INDEX IF NOT EXISTS idx_date_sessions_pair_created
  ON date_sessions (pair_id, created_at DESC);
