-- Manually adjustable pair streak counter. Auto-increments on the first
-- valentine activity of each day, but can be overridden via API.
ALTER TABLE pairs ADD COLUMN IF NOT EXISTS current_streak integer NOT NULL DEFAULT 0;