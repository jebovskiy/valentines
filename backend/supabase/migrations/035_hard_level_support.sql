-- Migration 035: Add 'hard' heat level support to existing database
-- This migration modifies existing CHECK constraints and the function to include 'hard'

-- 1. Update game_sessions.heat_level_used CHECK constraint
ALTER TABLE public.game_sessions
    DROP CONSTRAINT IF EXISTS game_sessions_heat_level_used_check;

ALTER TABLE public.game_sessions
    ADD CONSTRAINT game_sessions_heat_level_used_check
    CHECK (heat_level_used IN ('flirt', 'warm', 'bold', 'wild', 'hard') OR heat_level_used IS NULL);

-- 2. Update pair_settings.hot_level_a CHECK constraint
ALTER TABLE public.pair_settings
    DROP CONSTRAINT IF EXISTS pair_settings_hot_level_a_check;

ALTER TABLE public.pair_settings
    ADD CONSTRAINT pair_settings_hot_level_a_check
    CHECK (hot_level_a IN ('flirt', 'warm', 'bold', 'wild', 'hard'));

-- 3. Update pair_settings.hot_level_b CHECK constraint
ALTER TABLE public.pair_settings
    DROP CONSTRAINT IF EXISTS pair_settings_hot_level_b_check;

ALTER TABLE public.pair_settings
    ADD CONSTRAINT pair_settings_hot_level_b_check
    CHECK (hot_level_b IN ('flirt', 'warm', 'bold', 'wild', 'hard'));

-- 4. Update get_effective_heat_level function to include 'hard' in ordering
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

    -- Order: flirt < warm < bold < wild < hard
    IF a IS NULL THEN RETURN COALESCE(b, 'warm'); END IF;
    IF b IS NULL THEN RETURN a; END IF;

    RETURN CASE
        WHEN a IN ('flirt') AND b IN ('warm','bold','wild','hard') THEN 'flirt'
        WHEN b IN ('flirt') AND a IN ('warm','bold','wild','hard') THEN 'flirt'
        WHEN a IN ('flirt','warm') AND b IN ('bold','wild','hard') THEN 'warm'
        WHEN b IN ('flirt','warm') AND a IN ('bold','wild','hard') THEN 'warm'
        WHEN a IN ('flirt','warm','bold') AND b IN ('wild','hard') THEN 'bold'
        WHEN b IN ('flirt','warm','bold') AND a IN ('wild','hard') THEN 'bold'
        WHEN a IN ('flirt','warm','bold','wild') AND b = 'hard' THEN 'wild'
        WHEN b IN ('flirt','warm','bold','wild') AND a = 'hard' THEN 'wild'
        WHEN a = b THEN a
        ELSE 'warm'
    END;
END;
$$;

COMMENT ON FUNCTION public.get_effective_heat_level(uuid) IS 'Returns min(hot_level_a, hot_level_b) as text (flirt|warm|bold|wild|hard).';