-- Streak gamification: keep the best consecutive-days streak of the pair.
-- A streak day counts when the pair exchanged at least one valentine that day.
ALTER TABLE pairs ADD COLUMN IF NOT EXISTS max_streak integer NOT NULL DEFAULT 0;