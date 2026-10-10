-- Migration: add level_ready tracking for rising heat mode
-- APPLY: psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f 034_game_session_level_ready.sql

ALTER TABLE public.game_sessions
    ADD COLUMN IF NOT EXISTS level_ready jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.game_sessions.level_ready IS 'Array of user IDs who have pressed "Continue" for current level gate in rising heat mode.';

-- RPC function to add user to level_ready array
CREATE OR REPLACE FUNCTION public.add_level_ready(
    p_session_id uuid,
    p_user_id bigint
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE public.game_sessions
    SET level_ready = (
        CASE
            WHEN level_ready IS NULL THEN '[]'::jsonb
            ELSE level_ready
        END || to_jsonb(p_user_id)
    )
    WHERE id = p_session_id
      AND NOT (level_ready ? p_user_id::text);
END;
$$;

-- RLS already enabled on game_sessions, no new policies needed (service_role bypasses)