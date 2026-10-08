-- Recoverable movie-insight claim: a crashed worker must not freeze the insight.
--
-- WHY
-- `claimMovieInsight` was `upsert({status:'generating'}, {onConflict, ignoreDuplicates})`:
-- it won the race only by INSERTing a brand-new row. Once a row existed it could
-- never win again, and there was no staleness predicate and no `finally` in the
-- caller -- so an OOM-kill, a deploy or a hung AI call left `status='generating'`
-- forever. `getMovieInsight` only returns `status='done'`, so that movie's insight
-- was permanently dead with no retry path (unlike reminders/events, which get a
-- `p_stale_after` from 024).
--
-- The claim is now takeover-able after 5 minutes and the release/finish are
-- separate statements, so the caller can put them in a `finally`.
--
-- APPLY:  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f 028_movie_insight_claim.sql
-- VERIFY:
--   select movie_id, status, claimed_at, now() - claimed_at as age
--     from public.movie_insights where status = 'generating' order by claimed_at;
--   -- force the oldest outstanding claim to go stale and watch the next GET
--   -- take it over (no id to look up: pick it from the data):
--   update public.movie_insights m
--      set claimed_at = now() - interval '1 hour'
--     where m.movie_id = (select i.movie_id
--                           from public.movie_insights i
--                          where i.status = 'generating'
--                          order by i.claimed_at nulls first
--                          limit 1);
-- ROLLBACK:
--   drop function if exists public.claim_movie_insight(uuid, interval);
--   drop function if exists public.finish_movie_insight(uuid, jsonb);
--   drop function if exists public.release_movie_insight(uuid);
--   alter table public.movie_insights drop column if exists claimed_at;
--   drop index if exists public.idx_movie_insights_generating;
--   Rows currently stuck in 'generating' must be reset manually after rollback:
--   delete from public.movie_insights where status = 'generating';

ALTER TABLE public.movie_insights ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

-- Cheap lookup for "which claims are still outstanding / stale".
CREATE INDEX IF NOT EXISTS idx_movie_insights_generating
  ON public.movie_insights (claimed_at)
  WHERE status = 'generating';

-- Wins when the row is new, or when the existing row is a stale claim. Returns
-- false (no row) when the insight is already done or a worker is still on it.
CREATE OR REPLACE FUNCTION claim_movie_insight(
  p_movie_id uuid,
  p_stale_after interval DEFAULT interval '5 minutes'
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH attempt AS (
    INSERT INTO public.movie_insights AS m (movie_id, result, status, claimed_at)
    VALUES (p_movie_id, '{}'::jsonb, 'generating', now())
    ON CONFLICT (movie_id) DO UPDATE
      SET claimed_at = now(),
          result     = '{}'::jsonb,
          created_at = now()
      WHERE m.status = 'generating'
        AND (m.claimed_at IS NULL OR m.claimed_at < now() - p_stale_after)
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM attempt);
$$;

-- Only the row that still holds the claim can finish it: a late worker whose
-- claim was taken over cannot overwrite the fresh result with its stale one.
CREATE OR REPLACE FUNCTION finish_movie_insight(p_movie_id uuid, p_result jsonb)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.movie_insights
     SET result = p_result,
         status = 'done',
         claimed_at = NULL,
         created_at = now()
   WHERE movie_id = p_movie_id
     AND status = 'generating';
$$;

-- Releases the claim (deletes the placeholder row) so a later retry can re-claim.
-- Scoped to 'generating' so it can never wipe a finished insight.
CREATE OR REPLACE FUNCTION release_movie_insight(p_movie_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.movie_insights
   WHERE movie_id = p_movie_id
     AND status = 'generating';
$$;

REVOKE ALL ON FUNCTION public.claim_movie_insight(uuid, interval) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finish_movie_insight(uuid, jsonb)   FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_movie_insight(uuid)         FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_movie_insight(uuid, interval) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_movie_insight(uuid, jsonb)   TO service_role;
GRANT EXECUTE ON FUNCTION public.release_movie_insight(uuid)         TO service_role;