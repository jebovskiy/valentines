-- Backend notification scheduler tracks which couple events have already been
-- announced, so events don't fire twice (odd days, duplicate webhooks).
ALTER TABLE couple_events ADD COLUMN IF NOT EXISTS notified_at timestamptz;
CREATE INDEX IF NOT EXISTS couple_events_notified_idx ON couple_events (notified_at) WHERE notified_at IS NULL;