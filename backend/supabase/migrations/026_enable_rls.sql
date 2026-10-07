-- RLS hardening: enable RLS on the tables that were left wide open, and replace
-- the permissive "auth.uid() IS NULL" policies with claim-scoped SELECT policies.
--
-- WHY
-- Verified against 001-025:
--   * 7 public tables never enabled RLS at all: user_profiles, movies,
--     movie_watches, movie_reviews, movie_insights, movie_reminder_log,
--     taste_profiles. Any anon/authenticated PostgREST caller could read (and,
--     where grants allowed, write) every row of them.
--   * notes / reminders / couple_events policies are `auth.uid() IS NULL OR ...`
--     which is TRUE for every anon request -> a full cross-tenant read/write hole.
--     Same shape on date_sessions, date_votes, game_sessions, game_answers,
--     menus, leftovers.
--   * The miniapp only ever reads through the backend (service_role) and only
--     *subscribes* to three tables via Realtime: valentines, date_sessions,
--     game_sessions (miniapp/src/api/supabase.ts). Everything else needs no
--     policy at all.
--
-- The realtime policies are keyed on the `user_id` JWT claim minted by the
-- backend (GET /api/users/realtime-token, src/services/realtimeToken.ts). Until
-- that token is configured the client stays anonymous and simply receives no
-- realtime rows -- which is also the pre-026 behaviour for `valentines`, and is
-- covered by the 5s polling fallback in ListScreen.
--
-- The backend is unaffected: it uses the service_role key, which bypasses RLS.
--
-- APPLY:  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f 026_enable_rls.sql
-- VERIFY: select tablename, rowsecurity from pg_tables where schemaname = 'public' order by 1;
--         select tablename, policyname, cmd from pg_policies where schemaname = 'public' order by 1, 2;
-- ROLLBACK:
--   \i <(cat <<'SQL'
--   alter table public.user_profiles  disable row level security;
--   alter table public.movies         disable row level security;
--   alter table public.movie_watches  disable row level security;
--   alter table public.movie_reviews  disable row level security;
--   alter table public.movie_insights disable row level security;
--   alter table public.movie_reminder_log disable row level security;
--   alter table public.taste_profiles disable row level security;
--   SQL)
--   The 28 dropped policies were all no-ops for the backend; the previous shapes
--   can be restored from 011 / 019 / 020 / 021 / 023 if a client ever needs anon reads.

-- ============ 1. Tables that never enabled RLS ============
-- No anon/authenticated client reads these: the miniapp has no direct PostgREST
-- queries at all (verified: every `.from(...)` in miniapp/src is inside
-- src/api/supabase.ts and is a Realtime channel, not a query).
ALTER TABLE public.user_profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movies             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movie_watches      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movie_reviews      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movie_insights     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movie_reminder_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taste_profiles     ENABLE ROW LEVEL SECURITY;

-- ============ 2. Drop the permissive policies ============
-- These three are pure backend data (all reads/writes go through the API) and
-- the `auth.uid() IS NULL` branches made them world-writable.
DROP POLICY IF EXISTS "Pair members can read notes"          ON public.notes;
DROP POLICY IF EXISTS "Pair members can insert notes"        ON public.notes;
DROP POLICY IF EXISTS "Pair members can update notes"        ON public.notes;
DROP POLICY IF EXISTS "Pair members can delete notes"        ON public.notes;

DROP POLICY IF EXISTS "Pair members can read reminders"      ON public.reminders;
DROP POLICY IF EXISTS "Pair members can insert reminders"    ON public.reminders;
DROP POLICY IF EXISTS "Pair members can delete reminders"    ON public.reminders;

DROP POLICY IF EXISTS "Pair members can read events"         ON public.couple_events;
DROP POLICY IF EXISTS "Pair members can insert events"       ON public.couple_events;
DROP POLICY IF EXISTS "Pair members can update events"       ON public.couple_events;
DROP POLICY IF EXISTS "Pair members can delete events"       ON public.couple_events;

-- The "Service role can ..." policies are all `auth.uid() IS NULL`, i.e. they
-- authorised anon writes rather than the service role (which bypasses RLS).
DROP POLICY IF EXISTS "Service role can insert date_sessions" ON public.date_sessions;
DROP POLICY IF EXISTS "Service role can update date_sessions" ON public.date_sessions;
DROP POLICY IF EXISTS "Service role can delete date_sessions" ON public.date_sessions;
DROP POLICY IF EXISTS "Pair members can read date_votes"      ON public.date_votes;

DROP POLICY IF EXISTS "Service role can insert game_sessions" ON public.game_sessions;
DROP POLICY IF EXISTS "Service role can update game_sessions" ON public.game_sessions;
DROP POLICY IF EXISTS "Service role can delete game_sessions" ON public.game_sessions;
DROP POLICY IF EXISTS "Service role can insert game_answers"  ON public.game_answers;

DROP POLICY IF EXISTS "Service role can insert menus"         ON public.menus;
DROP POLICY IF EXISTS "Service role can update menus"         ON public.menus;
DROP POLICY IF EXISTS "Service role can delete menus"         ON public.menus;

DROP POLICY IF EXISTS "Service role can manage leftovers"    ON public.leftovers;

-- Not subscribed by the client: RLS stays on, zero policies = deny all.
DROP POLICY IF EXISTS "Users can view their own pair"         ON public.pairs;
DROP POLICY IF EXISTS "Users can view their own devices"      ON public.devices;
DROP POLICY IF EXISTS "Users can view greetings from their pair"  ON public.greetings;
DROP POLICY IF EXISTS "Users can insert greetings to their pair" ON public.greetings;
-- Writes go through the backend only; the anon INSERT policies were unreachable
-- for writes anyway (the client has no PostgREST writes) and unsafe.
DROP POLICY IF EXISTS "Users can insert valentines to their pair" ON public.valentines;

-- ============ 3. Realtime tables: claim-scoped SELECT ============
-- Single source of truth for the claim shape, so valentines/date_sessions/
-- game_sessions cannot drift apart again.
DROP POLICY IF EXISTS "Users can view valentines from their pair" ON public.valentines;
DROP POLICY IF EXISTS "Pair members can read date_sessions"        ON public.date_sessions;
DROP POLICY IF EXISTS "Pair members can read game_sessions"        ON public.game_sessions;

CREATE POLICY "Users can view valentines from their pair"
  ON public.valentines
  FOR SELECT
  USING (
    pair_id IN (
      SELECT id FROM public.pairs
      WHERE telegram_user_a = (current_setting('request.jwt.claims', true)::json->>'user_id')::bigint
         OR telegram_user_b = (current_setting('request.jwt.claims', true)::json->>'user_id')::bigint
    )
  );

CREATE POLICY "Pair members can read date_sessions"
  ON public.date_sessions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.pairs p
      WHERE p.id = date_sessions.pair_id
        AND (
          p.telegram_user_a = (current_setting('request.jwt.claims', true)::json->>'user_id')::bigint
          OR p.telegram_user_b = (current_setting('request.jwt.claims', true)::json->>'user_id')::bigint
        )
    )
  );

CREATE POLICY "Pair members can read game_sessions"
  ON public.game_sessions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.pairs p
      WHERE p.id = game_sessions.pair_id
        AND (
          p.telegram_user_a = (current_setting('request.jwt.claims', true)::json->>'user_id')::bigint
          OR p.telegram_user_b = (current_setting('request.jwt.claims', true)::json->>'user_id')::bigint
        )
    )
  );

-- ============ 4. Realtime publication ============
-- valentines was NEVER added to supabase_realtime (only date_sessions,
-- date_votes, game_sessions, game_answers were), so subscribeToValentines could
-- not deliver a single row. Add it, idempotently.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'valentines'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.valentines;
      RAISE NOTICE 'added public.valentines to supabase_realtime';
    END IF;
  ELSE
    RAISE WARNING 'publication supabase_realtime not found; realtime is not enabled on this project';
  END IF;
END
$$;

-- ============ 5. Lock down the SECURITY DEFINER RPCs ============
-- Postgres grants EXECUTE on a new function to PUBLIC by default, so the seven
-- `GRANT ... TO service_role` statements in 024 only ADDED a grant -- they never
-- removed the anonymous one. Every one of those functions is SECURITY DEFINER and
-- writes rows (claim/mark/release reminders, events, movie reminder log), which
-- means an anon key could mark reminders as sent, forge claims or spam the log.
REVOKE ALL ON FUNCTION public.claim_due_reminders(integer, interval)      FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_reminder_sent_once(uuid)               FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_reminder_claim(uuid)                FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_unnotified_events(integer, interval) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_event_notified_once(uuid)             FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_event_claim(uuid)                  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_movie_reminder_once(uuid, date)        FROM PUBLIC;
-- Legacy pg_net pipeline helpers (no longer called by the backend;
-- only the pg_cron jobs still invoke them, and cron runs as the
-- `postgres` superuser, which always has EXECUTE).
REVOKE ALL ON FUNCTION public.retry_pending_push_jobs()                  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_old_push_jobs()                    FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_expired_pairing_tokens()           FROM PUBLIC;
-- Defensive: keep the service role able to call them too, in case any
-- environment wires them through the API instead of cron.
GRANT EXECUTE ON FUNCTION public.retry_pending_push_jobs()               TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_old_push_jobs()                 TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_pairing_tokens()        TO service_role;

-- ============ 6. Report the result ============
DO $$
DECLARE
  total int;
  enabled int;
BEGIN
  SELECT count(*) INTO total
    FROM pg_tables
    WHERE schemaname = 'public' AND tablename NOT LIKE 'pg_%';
  SELECT count(*) INTO enabled
    FROM pg_tables
    WHERE schemaname = 'public' AND tablename NOT LIKE 'pg_%' AND rowsecurity;
  RAISE NOTICE 'RLS: % of % public tables enabled', enabled, total;
END
$$;