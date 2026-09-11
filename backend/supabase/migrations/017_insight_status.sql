-- Part 1: Add status column to movie_insights for race-safe generation locking.
-- Existing rows are treated as 'done' (completed insights).
ALTER TABLE movie_insights ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'done'
  CHECK (status IN ('generating', 'done'));

-- Part 2: Allow service-role claim via UPDATE ... WHERE status IS NULL for race protection.
-- No RLS change needed: backend uses the service role key.