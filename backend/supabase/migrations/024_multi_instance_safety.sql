-- Multi-instance safety: atomic claim RPCs for the scheduler.
--
-- The backend dispatch (FCM via HTTP v1) is handled inline from the Node
-- process; the legacy pg_net/push_jobs DB pipeline is disconnected so a
-- valentine no longer produces duplicate jobs + webhook posts per device.
-- The scheduler now claims rows atomically (adds claimed_at), dispatches,
-- then marks sent/notified only on success -- so scaled-out backend instances
-- handle each due reminder/event exactly once, and failures get retried.

-- Remove the legacy double-push pipeline: the trigger created 2 push_jobs per
-- device AND posted 2 webhooks at insert time, while the route ALSO dispatches
-- inline (dispatchDirectValentinePushes). Keeping both caused double pushes.
DROP TRIGGER IF EXISTS trigger_create_push_jobs ON valentines;
DROP FUNCTION IF EXISTS create_push_jobs_and_dispatch();

-- Disable the pg_cron webhook sweeps (push retry + reminder dispatch) that
-- operated on the DB pipeline; dispatch is inline now. Wrapped defensively:
-- pg_cron may not be enabled in some environments.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'dispatch-reminders';
      PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'retry-push-jobs';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'pg_cron cleanup skipped: %', SQLERRM;
    END;
  END IF;
END
$$;

DROP FUNCTION IF EXISTS dispatch_due_reminders();

-- Claim markers. A row is claimable when claimed_at IS NULL or the previous
-- claim is older than the stale timeout (crashed worker / failed dispatch).
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS claimed_at timestamptz;
ALTER TABLE couple_events ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

-- ============ Reminders ============
CREATE OR REPLACE FUNCTION claim_due_reminders(p_limit integer DEFAULT 50, p_stale_after interval DEFAULT interval '10 minutes')
RETURNS SETOF reminders
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH claimed AS (
    SELECT id
    FROM reminders
    WHERE is_sent = false
      AND remind_at <= now()
      AND (claimed_at IS NULL OR claimed_at < now() - p_stale_after)
    ORDER BY remind_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE reminders SET claimed_at = now()
  WHERE id IN (SELECT id FROM claimed)
  RETURNING *;
$$;

CREATE OR REPLACE FUNCTION mark_reminder_sent_once(p_id uuid)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE reminders SET is_sent = true, claimed_at = NULL WHERE id = p_id;
$$;

CREATE OR REPLACE FUNCTION release_reminder_claim(p_id uuid)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE reminders SET claimed_at = NULL WHERE id = p_id AND is_sent = false;
$$;

-- ============ Couple events ============
CREATE OR REPLACE FUNCTION claim_unnotified_events(p_limit integer DEFAULT 50, p_stale_after interval DEFAULT interval '10 minutes')
RETURNS SETOF couple_events
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH claimed AS (
    SELECT id
    FROM couple_events
    WHERE notified_at IS NULL
      AND (claimed_at IS NULL OR claimed_at < now() - p_stale_after)
    ORDER BY event_date
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE couple_events SET claimed_at = now()
  WHERE id IN (SELECT id FROM claimed)
  RETURNING *;
$$;

CREATE OR REPLACE FUNCTION mark_event_notified_once(p_id uuid)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE couple_events SET notified_at = now(), claimed_at = NULL WHERE id = p_id;
$$;

CREATE OR REPLACE FUNCTION release_event_claim(p_id uuid)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE couple_events SET claimed_at = NULL WHERE id = p_id AND notified_at IS NULL;
$$;

-- ============ Movie reminders (once per pair per day) ============
-- Atomically records that a movie reminder was sent for a pair today. Only the
-- caller that actually performs the insert/advance gets a row back, so exactly
-- one backend instance dispatches per pair per day.
CREATE OR REPLACE FUNCTION log_movie_reminder_once(p_pair_id uuid, p_sent_date date)
RETURNS SETOF movie_reminder_log
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO movie_reminder_log (pair_id, last_sent_on)
  VALUES (p_pair_id, p_sent_date)
  ON CONFLICT (pair_id) DO UPDATE SET last_sent_on = EXCLUDED.last_sent_on
  WHERE movie_reminder_log.last_sent_on <> EXCLUDED.last_sent_on
  RETURNING *;
$$;

GRANT EXECUTE ON FUNCTION claim_due_reminders(integer, interval) TO service_role;
GRANT EXECUTE ON FUNCTION mark_reminder_sent_once(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION release_reminder_claim(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION claim_unnotified_events(integer, interval) TO service_role;
GRANT EXECUTE ON FUNCTION mark_event_notified_once(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION release_event_claim(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION log_movie_reminder_once(uuid, date) TO service_role;