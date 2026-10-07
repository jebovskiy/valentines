-- Streak as a stored, atomically maintained value instead of a full-table scan.
--
-- WHY
-- `services/streak.ts` recomputed the run on every GET /api/pairs/streak, on the
-- POST /api/valentines streak gate AND after the insert: three SELECTs of up to
-- 5000 `valentines.sent_at` rows plus up to three `pairs` UPDATEs per POST, all in
-- Node. Worse, the runs were derived in JS, so two concurrent sends could both
-- read the same history and both write a value that the other had already beaten.
--
-- The streak is now:
--   * `pairs.last_active_date` -- the pair-local day the run was last counted on
--   * `pairs.current_streak`   -- the cached run length (authoritative on write)
--   * `pairs.max_streak`       -- the record, never decreased
-- Writes go through one atomic statement; reads are O(1).
--
-- Day boundaries use the caller's `p_tz_offset_minutes`. SIGN CONVENTION: minutes
-- WEST of UTC, exactly like `Date#getTimezoneOffset()` and like the
-- `tz_offset_minutes` query/body parameter /api/recap already accepts (UTC+3 =>
-- -180). That is why every local time is computed by SUBTRACTING the offset. A
-- default of 0 keeps the previous UTC behaviour, so existing callers are
-- unaffected.
--
-- APPLY:  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f 027_streak_rpcs.sql
-- VERIFY:
--   select last_active_date, current_streak, max_streak from public.pairs
--    where id = 'a4948be-c221-412b-adb6-9e7e02b74e3e';
--   select current_streak, max_streak, advanced, new_record
--     from public.register_valentine_activity('a4948be-c221-412b-adb6-9e7e02b74e3e'::uuid, 180);
-- ROLLBACK:
--   drop function if exists public.register_valentine_activity(uuid, integer);
--   drop function if exists public.recompute_pair_streak(uuid, integer);
--   alter table public.pairs drop column if exists last_active_date;
--   The old TS recompute in services/streak.ts still works off `valentines`, so
--   reverting this migration plus commit 479b58f's caller restores the old path.

-- ============ 1. The anchor column ============
-- last_active_date = the newest pair-local day with activity. The read path uses
-- it to decide whether the cached run is still alive (today or yesterday), which
-- is what makes the streak decay without any write when a day is simply missed.
ALTER TABLE public.pairs ADD COLUMN IF NOT EXISTS last_active_date date;

-- ============ 2. Hot path: register today's activity ============
-- Called once per POST /api/valentines after the row is inserted.
-- Idempotent within a day: two sends on the same local day return the same
-- numbers and `advanced = false`, so a retried request cannot inflate the run.
CREATE OR REPLACE FUNCTION register_valentine_activity(
  p_pair_id uuid,
  p_tz_offset_minutes integer DEFAULT 0
)
RETURNS TABLE (current_streak integer, max_streak integer, advanced boolean, new_record boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH target AS (
    SELECT ((now() AT TIME ZONE 'UTC') - make_interval(mins => COALESCE(p_tz_offset_minutes, 0)))::date AS day
  ),
  locked AS (
    SELECT p.id,
           p.current_streak   AS prev_current,
           p.max_streak       AS prev_max,
           p.last_active_date AS prev_day,
           target.day         AS day
    FROM pairs AS p
    CROSS JOIN target
    WHERE p.id = p_pair_id
    FOR UPDATE OF p
  ),
  computed AS (
    SELECT id,
           day,
           prev_day,
           prev_max,
           CASE
             WHEN prev_day = day     THEN GREATEST(prev_current, 1)  -- already counted today
             WHEN prev_day = day - 1 THEN prev_current + 1           -- consecutive day
             ELSE 1                                                    -- first day / broken run
           END AS new_current
    FROM locked
  ),
  updated AS (
    UPDATE pairs AS p
    SET last_active_date = c.day,
        current_streak   = c.new_current,
        max_streak       = GREATEST(c.prev_max, c.new_current)
    FROM computed AS c
    WHERE p.id = c.id
    RETURNING p.current_streak, p.max_streak, c.prev_max, c.prev_day, c.day
  )
  SELECT u.current_streak::integer,
         u.max_streak::integer,
         (u.prev_day IS DISTINCT FROM u.day) AS advanced,
         (u.max_streak > u.prev_max)          AS new_record
  FROM updated AS u;
$$;

-- ============ 3. Authoritative rebuild ============
-- Full gaps-and-islands recompute from `valentines`, still in one statement and
-- still holding the row lock. Used by PATCH /api/pairs/streak (self-heal) and by
-- the backfill below -- deliberately NOT on any read path.
CREATE OR REPLACE FUNCTION recompute_pair_streak(
  p_pair_id uuid,
  p_tz_offset_minutes integer DEFAULT 0
)
RETURNS TABLE (current_streak integer, max_streak integer, advanced boolean, new_record boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH span AS (
    SELECT make_interval(mins => COALESCE(p_tz_offset_minutes, 0)) AS shift
  ),
  today AS (
    SELECT (((now() AT TIME ZONE 'UTC') - (SELECT shift FROM span))::date) AS day
  ),
  days AS (
    SELECT DISTINCT ((v.sent_at AT TIME ZONE 'UTC') - (SELECT shift FROM span))::date AS day
    FROM valentines AS v
    WHERE v.pair_id = p_pair_id
  ),
  islands AS (
    -- `day` must be carried through, otherwise the run grouping below
    -- cannot see it.
    SELECT day, day - (row_number() OVER (ORDER BY day))::int AS grp
    FROM days
  ),
  runs AS (
    SELECT grp, count(*)::int AS len, max(day) AS last_day
    FROM islands
    GROUP BY grp
  ),
  computed AS (
    SELECT
      coalesce((SELECT max(len)::int FROM runs WHERE last_day >= (SELECT day FROM today) - 1), 0) AS new_current,
      coalesce((SELECT max(len)::int FROM runs), 0)                                             AS new_max,
      (SELECT max(last_day) FROM runs)                                                          AS last_day
  ),
  locked AS (
    SELECT p.id, p.current_streak AS prev_current, p.max_streak AS prev_max
    FROM pairs AS p
    WHERE p.id = p_pair_id
    FOR UPDATE
  ),
  updated AS (
    UPDATE pairs AS p
    SET current_streak   = c.new_current,
        max_streak       = GREATEST(l.prev_max, c.new_max),
        last_active_date = c.last_day
    FROM locked AS l
    CROSS JOIN computed AS c
    WHERE p.id = l.id
    RETURNING p.current_streak, p.max_streak, l.prev_current, l.prev_max
  )
  SELECT u.current_streak::integer,
         u.max_streak::integer,
         (u.current_streak <> u.prev_current) AS advanced,
         (u.max_streak > u.prev_max)           AS new_record
  FROM updated AS u;
$$;

-- ============ 4. Backfill existing pairs ============
-- Idempotent: only pairs that were never anchored are rebuilt, so re-running the
-- migration cannot roll a current streak backwards.
DO $$
DECLARE
  r     record;
  fixed integer := 0;
BEGIN
  FOR r IN
    SELECT DISTINCT pair_id FROM public.valentines
  LOOP
    PERFORM public.recompute_pair_streak(r.pair_id, 0);
    fixed := fixed + 1;
  END LOOP;
  RAISE NOTICE 'streak backfill: anchored % pairs with activity (UTC, offset 0)', fixed;
END
$$;

-- Pairs with no activity at all: make the "never anchored" state explicit so the
-- read path does not fall back to a recompute on every request.
UPDATE public.pairs
   SET last_active_date = NULL
 WHERE last_active_date IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.valentines v WHERE v.pair_id = pairs.id);

-- ============ 5. Grants ============
REVOKE ALL ON FUNCTION public.register_valentine_activity(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recompute_pair_streak(uuid, integer)       FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_valentine_activity(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.recompute_pair_streak(uuid, integer)       TO service_role;

-- Supports the recompute's day scan and the migration itself. (Also the index
-- phase D asks for: `valentines(pair_id, sent_at DESC)`.)
CREATE INDEX IF NOT EXISTS idx_valentines_pair_sent_at ON public.valentines (pair_id, sent_at DESC);