-- Migration: switch hot levels to text enums ('flirt'|'warm'|'bold'|'wild')
-- The DB stored hot_level_a/b and heat_level_used as smallint (1-4), but the
-- backend/miniapp use string levels. This converts existing smallint values and
-- enforces the string domain going forward.
-- APPLY: psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f 033_hot_level_text.sql

-- 1. Convert game_sessions.heat_level_used (smallint 1-4 -> text)
ALTER TABLE public.game_sessions
    DROP CONSTRAINT IF EXISTS game_sessions_heat_level_used_check;

ALTER TABLE public.game_sessions
    ALTER COLUMN heat_level_used TYPE text
    USING CASE heat_level_used
        WHEN 1 THEN 'flirt'
        WHEN 2 THEN 'warm'
        WHEN 3 THEN 'bold'
        WHEN 4 THEN 'wild'
        ELSE NULL
    END;

ALTER TABLE public.game_sessions
    ADD CONSTRAINT game_sessions_heat_level_used_check
    CHECK (heat_level_used IN ('flirt', 'warm', 'bold', 'wild') OR heat_level_used IS NULL);

-- 2. Convert pair_settings.hot_level_a (smallint 1-4 -> text)
ALTER TABLE public.pair_settings
    DROP CONSTRAINT IF EXISTS pair_settings_hot_level_a_check;

ALTER TABLE public.pair_settings
    ALTER COLUMN hot_level_a TYPE text
    USING CASE hot_level_a
        WHEN 1 THEN 'flirt'
        WHEN 2 THEN 'warm'
        WHEN 3 THEN 'bold'
        WHEN 4 THEN 'wild'
        ELSE 'warm'
    END;

ALTER TABLE public.pair_settings
    ALTER COLUMN hot_level_a SET DEFAULT 'warm';

ALTER TABLE public.pair_settings
    ADD CONSTRAINT pair_settings_hot_level_a_check
    CHECK (hot_level_a IN ('flirt', 'warm', 'bold', 'wild'));

-- 3. Convert pair_settings.hot_level_b
ALTER TABLE public.pair_settings
    DROP CONSTRAINT IF EXISTS pair_settings_hot_level_b_check;

ALTER TABLE public.pair_settings
    ALTER COLUMN hot_level_b TYPE text
    USING CASE hot_level_b
        WHEN 1 THEN 'flirt'
        WHEN 2 THEN 'warm'
        WHEN 3 THEN 'bold'
        WHEN 4 THEN 'wild'
        ELSE 'warm'
    END;

ALTER TABLE public.pair_settings
    ALTER COLUMN hot_level_b SET DEFAULT 'warm';

ALTER TABLE public.pair_settings
    ADD CONSTRAINT pair_settings_hot_level_b_check
    CHECK (hot_level_b IN ('flirt', 'warm', 'bold', 'wild'));

-- 4. Update get_effective_heat_level to return the min level as text
DROP FUNCTION IF EXISTS public.get_effective_heat_level(uuid);

CREATE OR REPLACE FUNCTION public.get_effective_heat_level(p_pair_id uuid)
RETURNS text LANGUAGE plpgsql STABLE AS $$
DECLARE
    a text;
    b text;
BEGIN
    SELECT hot_level_a, hot_level_b INTO a, b
    FROM public.pair_settings
    WHERE pair_id = p_pair_id;

    -- Order: flirt < warm < bold < wild
    IF a IS NULL THEN RETURN COALESCE(b, 'warm'); END IF;
    IF b IS NULL THEN RETURN a; END IF;

    RETURN CASE
        WHEN a IN ('flirt') AND b IN ('warm','bold','wild') THEN 'flirt'
        WHEN b IN ('flirt') AND a IN ('warm','bold','wild') THEN 'flirt'
        WHEN a IN ('flirt','warm') AND b IN ('bold','wild') THEN 'warm'
        WHEN b IN ('flirt','warm') AND a IN ('bold','wild') THEN 'warm'
        WHEN a IN ('flirt','warm','bold') AND b = 'wild' THEN 'bold'
        WHEN b IN ('flirt','warm','bold') AND a = 'wild' THEN 'bold'
        WHEN a = b THEN a
        ELSE 'warm'
    END;
END;
$$;

COMMENT ON FUNCTION public.get_effective_heat_level(uuid) IS 'Returns min(hot_level_a, hot_level_b) as text (flirt|warm|bold|wild).';