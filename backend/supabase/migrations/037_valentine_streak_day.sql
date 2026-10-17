-- Sky as "one star per streak day".
--
-- WHY
-- The miniapp sky screen grouped valentines by the VIEWER's local `getDate()`,
-- so the same pair could see different day boundaries depending on who opened the
-- screen (and the streak counter, which uses the SENDER's tz, disagreed again).
-- To draw one star per day the day has to be canonical: recorded once, at insert
-- time, with the sender's timezone -- exactly the day the streak RPC counts.
--
-- `valentines.streak_day` is that day. It mirrors
-- `register_valentine_activity`'s `(now() AT TIME ZONE 'UTC' - p_tz)::date` and is
-- written by POST /api/valentines from `localDay(new Date(), tz_offset_minutes)`.
--
-- APPLY:  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f 037_valentine_streak_day.sql
-- VERIFY:
--   select column_name, data_type from information_schema.columns
--    where table_name = 'valentines' and column_name = 'streak_day';  -- 1 row: date
--   -- days should roughly match valentines sent, per pair:
--   select pair_id, count(*) valentines, count(distinct streak_day) days
--     from public.valentines group by pair_id order by valentines desc limit 3;
-- ROLLBACK:
--   drop index if exists public.idx_valentines_pair_streak_day;
--   alter table public.valentines drop column if exists streak_day;

ALTER TABLE public.valentines ADD COLUMN IF NOT EXISTS streak_day date;

COMMENT ON COLUMN public.valentines.streak_day IS
  'Pair-local activity day (sender timezone) used to draw one sky star per day; matches pairs.last_active_date and the streak counter.';

-- Supports GET /api/pairs/streak/days, which reads a pair's rows newest-first.
CREATE INDEX IF NOT EXISTS idx_valentines_pair_streak_day
  ON public.valentines (pair_id, streak_day DESC);

-- Backfill legacy rows. The original day boundary was never recorded, so the best
-- available approximation is the UTC day of `sent_at`. New rows use the sender's
-- timezone; a pair active only across midnight UTC may therefore see at most one
-- star shifted for its pre-migration history.
UPDATE public.valentines
   SET streak_day = (sent_at AT TIME ZONE 'UTC')::date
 WHERE streak_day IS NULL;
