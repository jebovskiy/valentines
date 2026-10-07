-- One row per (pair, kp_id): the DB-level guarantee behind "add movie" idempotency.
--
-- WHY
-- `POST /api/movies` and `POST /api/movies/batch` both pre-checked with
-- `getMovieByKp` and then inserted (classic TOCTOU): two concurrent adds, or the
-- same kp_id twice inside one /batch, both pass the check and both insert. There
-- was no unique constraint anywhere in 001-025 to catch it, and
-- `getMovieByKp().maybeSingle()` then throws PGRST116 on the next read, so the
-- whole movie list endpoint breaks for that pair.
--
-- DEDUPE IS DELIBERATELY CONSERVATIVE
-- Rows that carry user data (reviews, watches, insights) are never deleted.
-- Only redundant rows with no children are removed, and only the losing copy.
-- If anything remains duplicated the index is skipped with a WARNING instead of
-- failing the migration -- so check the PRE-FLIGHT queries first.
--
-- APPLY:  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f 029_movies_unique_kp.sql
-- PRE-FLIGHT (read-only, run first):
--   select pair_id, kp_id, count(*) from public.movies
--    where kp_id is not null group by 1, 2 having count(*) > 1;
--   -- ...and which of those copies carry user data:
--   select m.id, m.status, m.added_at,
--          (select count(*) from public.movie_reviews r where r.movie_id = m.id) as reviews,
--          (select count(*) from public.movie_watches w where w.movie_id = m.id) as watches,
--          (select count(*) from public.movie_insights i where i.movie_id = m.id) as insights
--     from public.movies m
--    where m.kp_id is not null
--      and exists (select 1 from public.movies d
--                   where d.pair_id = m.pair_id and d.kp_id = m.kp_id and d.id <> m.id)
--    order by m.pair_id, m.kp_id, m.added_at;
-- VERIFY:
--   select indexname, indexdef from pg_indexes
--    where schemaname='public' and tablename='movies' and indexname='movies_pair_kp_uniq';
-- ROLLBACK: drop index if exists public.movies_pair_kp_uniq;
--   (rows deleted by the dedupe are not recoverable from this migration.)

DO $$
DECLARE
  v_removed  integer := 0;
  v_blocked  integer := 0;
  v_groups   integer := 0;
BEGIN
  -- How many duplicated groups exist at all, for the report.
  SELECT count(*) INTO v_groups FROM (
    SELECT 1 FROM public.movies
     WHERE kp_id IS NOT NULL
     GROUP BY pair_id, kp_id
    HAVING count(*) > 1
  ) dup;

  -- Keep the "best" copy of each group: watched beats unwatched, then oldest.
  WITH ranked AS (
    SELECT m.id,
           row_number() OVER (
             PARTITION BY m.pair_id, m.kp_id
             ORDER BY (m.status = 'watched') DESC NULLS LAST, m.added_at, m.id
           ) AS rn
    FROM public.movies m
    WHERE m.kp_id IS NOT NULL
  ),
  losable AS (
    SELECT r.id
    FROM ranked r
    WHERE r.rn > 1
      AND NOT EXISTS (SELECT 1 FROM public.movie_reviews  rv WHERE rv.movie_id = r.id)
      AND NOT EXISTS (SELECT 1 FROM public.movie_watches  w  WHERE w.movie_id  = r.id)
      AND NOT EXISTS (SELECT 1 FROM public.movie_insights i  WHERE i.movie_id = r.id)
  ),
  deleted AS (
    DELETE FROM public.movies m
    USING losable l
    WHERE m.id = l.id
    RETURNING 1
  )
  SELECT count(*) INTO v_removed FROM deleted;

  -- What is left over after the safe cleanup.
  SELECT count(*) INTO v_blocked FROM (
    SELECT 1 FROM public.movies
     WHERE kp_id IS NOT NULL
     GROUP BY pair_id, kp_id
    HAVING count(*) > 1
  ) dup;

  IF v_removed > 0 THEN
    RAISE NOTICE 'movies: removed % childless duplicate rows; % groups were duplicated in total', v_removed, v_groups;
  ELSE
    RAISE NOTICE 'movies: % duplicated (pair_id, kp_id) groups found, nothing safe to remove automatically', v_groups;
  END IF;

  IF v_blocked > 0 THEN
    RAISE WARNING 'movies: % duplicated (pair_id, kp_id) groups still remain (they carry reviews/watches/insights). movies_pair_kp_uniq was NOT created. Resolve them with the PRE-FLIGHT queries in the header, then re-run this migration.', v_blocked;
  ELSE
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS movies_pair_kp_uniq ON public.movies (pair_id, kp_id) WHERE kp_id IS NOT NULL';
    RAISE NOTICE 'movies: movies_pair_kp_uniq is in place';
  END IF;
END
$$;