-- Scheduler: stop the event claim from starving itself.
--
-- WHY
-- claim_unnotified_events() selected the OLDEST unnotified rows
-- (ORDER BY event_date, LIMIT 50) with no date window at all.
-- processUpcomingEvents() then ran remindersAreDue() on each claimed row and
-- released the ones outside their window. So one event already in the past --
-- or a birthday a year away -- occupied one of those 50 slots on every
-- 10-minute sweep, was released, and was re-claimed on the next one, while the
-- events that actually were due sat behind them in the same queue. Past 50
-- not-yet-due events nothing due was ever reached.
--
-- claim_due_reminders() already carried the equivalent predicate
-- (`remind_at <= now()`); the events one was simply missing.
--
-- p_today is supplied by the caller instead of reading `current_date` because
-- the window is a local-calendar comparison on the TypeScript side
-- (remindersAreDue() zeroes the local clock) and the two sides have to agree,
-- otherwise SQL would hand over rows TypeScript immediately rejects.
--
-- It is optional so a backend that does not know about it yet keeps working
-- unchanged: without p_today the function behaves exactly as it did before,
-- so the migration and the deploy can land in either order.
--
-- APPLY:  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f 030_event_claim_window.sql
-- VERIFY:
--   select proname, pg_get_function_identity_arguments(oid)
--     from pg_proc where proname = 'claim_unnotified_events';
--   -- one row: (p_limit integer, p_stale_after interval, p_today date)
--   select * from public.claim_unnotified_events(50, interval '10 minutes', current_date);
--   -- and the two-argument form still resolves for an un-migrated backend:
--   select * from public.claim_unnotified_events(50, interval '10 minutes');
-- ROLLBACK:
--   drop function if exists public.claim_unnotified_events(integer, interval, date);
--   -- then restore the 024 version of claim_unnotified_events(integer, interval).

-- The old signature is dropped rather than overloaded: two functions of the
-- same name would leave the unfiltered one callable forever, which is the bug
-- this migration exists to remove.
DROP FUNCTION IF EXISTS public.claim_unnotified_events(integer, interval);

CREATE OR REPLACE FUNCTION public.claim_unnotified_events(
  p_limit integer DEFAULT 50,
  p_stale_after interval DEFAULT interval '10 minutes',
  p_today date DEFAULT NULL
)
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
      -- The reminder window evaluated in calendar dates, exactly as
      -- remindersAreDue() does it: due on or before today, event not yet past.
      AND (
        p_today IS NULL
        OR (event_date >= p_today AND event_date - remind_days_before <= p_today)
      )
    ORDER BY event_date
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE couple_events SET claimed_at = now()
  WHERE id IN (SELECT id FROM claimed)
  RETURNING *;
$$;

REVOKE ALL ON FUNCTION public.claim_unnotified_events(integer, interval, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_unnotified_events(integer, interval, date) TO service_role;
