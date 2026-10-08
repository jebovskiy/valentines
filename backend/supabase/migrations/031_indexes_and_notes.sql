-- Phase D: indexes for the paths Phase A-C made hot, plus comments on the two
-- conventions that are easy to get wrong when reading this schema cold.
--
-- Nothing here changes behaviour: an index only changes how fast an already
-- correct query runs, and a comment only changes what the next reader knows.
--
-- APPLY:  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f 031_indexes_and_notes.sql
-- VERIFY:
--   select indexname from pg_indexes
--    where schemaname = 'public'
--      and indexname in ('idx_movie_watches_movie', 'idx_couple_events_pending_date');
--   -- column comments: obj_description() only reads relation (table) comments,
--   -- so a column has to go through col_description(rel, attnum):
--   select n.nspname || '.' || c.relname || '.' || a.attname as col,
--          col_description(c.oid, a.attnum) as comment
--     from pg_attribute a
--     join pg_class c     on c.oid = a.attrelid
--     join pg_namespace n on n.oid = c.relnamespace
--    where n.nspname = 'public'
--      and not a.attisdropped
--      and (c.relname, a.attname) in (('valentines', 'sent_at'),
--                                     ('pairs', 'last_active_date'),
--                                     ('couple_events', 'event_date'));
--   select proname, pg_get_function_identity_arguments(oid)
--     from pg_proc
--    where proname in ('register_valentine_activity', 'claim_unnotified_events');
-- ROLLBACK:
--   drop index if exists public.idx_movie_watches_movie;
--   drop index if exists public.idx_couple_events_pending_date;
--   comment on column public.valentines.sent_at is null;
--   comment on column public.pairs.last_active_date is null;
--   comment on column public.couple_events.event_date is null;

-- ============ 1. Indexes ============

-- getMovieWatchesBatch() reads movie_watches by movie_id IN (...), and
-- 016 created the matching index for movie_reviews but not for its neighbour.
-- Without it every "what did each of us think of these five films" query is a
-- sequential scan of the whole watch history.
CREATE INDEX IF NOT EXISTS idx_movie_watches_movie
  ON public.movie_watches (movie_id);

-- The event claim (030) filters on `notified_at IS NULL` AND a range over
-- event_date. The partial index 013 added covers only the NULL half, so the
-- date window was applied to every unnotified row; leading with event_date lets
-- the ORDER BY event_date in the claim be satisfied from the index as well.
CREATE INDEX IF NOT EXISTS idx_couple_events_pending_date
  ON public.couple_events (event_date)
  WHERE notified_at IS NULL;

-- ============ 2. Comments on the conventions ============

-- The streak day is NOT this timestamp's calendar day. Every request carries
-- the sender's `tz_offset_minutes` in the Date#getTimezoneOffset sense --
-- minutes WEST of UTC, so UTC+3 is -180 -- and register_valentine_activity()
-- subtracts it from UTC to pick the local day. Reading `sent_at::date` in SQL
-- or in application code gives a different, wrong answer for any pair that is
-- not on UTC.
COMMENT ON COLUMN public.valentines.sent_at IS
  'Row creation time, UTC. The streak day is derived separately from the client''s tz_offset_minutes (minutes west of UTC; UTC+3 => -180) by register_valentine_activity() -- never from this column.';

COMMENT ON COLUMN public.pairs.last_active_date IS
  'Pair-LOCAL calendar date the run was last counted on, not UTC. Maintained only by register_valentine_activity() / recompute_pair_streak(); do not write it directly.';

-- Same trap, different table: the reminder window compares this to "today" in
-- the caller's local time, not to current_date.
COMMENT ON COLUMN public.couple_events.event_date IS
  'Local calendar date of the event. The reminder window is event_date >= today AND event_date - remind_days_before <= today, evaluated on the pair''s local date -- see claim_unnotified_events().';

COMMENT ON FUNCTION public.claim_unnotified_events(integer, interval, date) IS
  'Claims up to p_limit unnotified couple_events whose reminder window contains p_today, skipping rows another worker holds (FOR UPDATE SKIP LOCKED). p_today is the caller''s LOCAL date, not current_date; pass NULL to fall back to no date filtering (pre-030 behaviour).';

COMMENT ON FUNCTION public.register_valentine_activity(uuid, integer) IS
  'Counts today''s valentine towards the pair streak, idempotently within a day. p_tz_offset_minutes is minutes WEST of UTC (Date#getTimezoneOffset; UTC+3 => -180): the local day is UTC minus that offset. Returns current/max streak and whether the run advanced or set a record.';

-- ============ 3. Verify ============
-- select indexname from pg_indexes
--  where schemaname = 'public'
--    and indexname in ('idx_movie_watches_movie', 'idx_couple_events_pending_date');
-- select n.nspname || '.' || c.relname || '.' || a.attname as col,
--        col_description(c.oid, a.attnum) as comment
--   from pg_attribute a
--   join pg_class c     on c.oid = a.attrelid
--   join pg_namespace n on n.oid = c.relnamespace
--  where n.nspname = 'public'
--    and not a.attisdropped
--    and (c.relname, a.attname) in (('valentines', 'sent_at'),
--                                   ('pairs', 'last_active_date'),
--                                   ('couple_events', 'event_date'));
