-- Migration: pair settings, game heat levels, encrypted answers with TTL
-- APPLY: psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f 032_pair_settings_game_heat.sql
-- ROLLBACK: DROP TABLE IF EXISTS public.pair_settings; ALTER TABLE public.game_sessions DROP COLUMN IF EXISTS heat_level_used, DROP COLUMN IF EXISTS expires_at; ALTER TABLE public.game_answers DROP COLUMN IF EXISTS encrypted_answer, DROP COLUMN IF EXISTS expires_at;

-- ============ 1. Enable pgcrypto for encryption ============
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============ 2. pair_settings table ============
CREATE TABLE public.pair_settings (
    pair_id         uuid PRIMARY KEY REFERENCES public.pairs(id) ON DELETE CASCADE,
    -- Heat level per partner (1=flirt, 2=warm, 3=bold, 4=wild)
    -- min(hot_level_a, hot_level_b) used by createGameSession
    hot_level_a     smallint NOT NULL DEFAULT 2 CHECK (hot_level_a BETWEEN 1 AND 4),
    hot_level_b     smallint NOT NULL DEFAULT 2 CHECK (hot_level_b BETWEEN 1 AND 4),
    -- 18+ confirmation flags
    hot_18_confirmed_a boolean NOT NULL DEFAULT false,
    hot_18_confirmed_b boolean NOT NULL DEFAULT false,
    -- 18+ category enabled globally for this pair
    hot_18_enabled  boolean NOT NULL DEFAULT true,
    updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.pair_settings IS 'Per-pair game settings: heat levels, 18+ consent';
COMMENT ON COLUMN public.pair_settings.hot_level_a IS 'Partner A heat level: 1=flirt, 2=warm, 3=bold, 4=wild';
COMMENT ON COLUMN public.pair_settings.hot_level_b IS 'Partner B heat level: 1=flirt, 2=warm, 3=bold, 4=wild';
COMMENT ON COLUMN public.pair_settings.hot_18_confirmed_a IS 'Partner A confirmed 18+ age';
COMMENT ON COLUMN public.pair_settings.hot_18_confirmed_b IS 'Partner B confirmed 18+ age';
COMMENT ON COLUMN public.pair_settings.hot_18_enabled IS 'Global toggle for 18+ category';

-- RLS: only pair members can read/write their own partner's settings
ALTER TABLE public.pair_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pair members can read pair_settings"
    ON public.pair_settings
    FOR SELECT
    USING (
        pair_id IN (
            SELECT id FROM public.pairs
            WHERE telegram_user_a = (current_setting('request.jwt.claims', true)::json->>'user_id')::bigint
               OR telegram_user_b = (current_setting('request.jwt.claims', true)::json->>'user_id')::bigint
        )
    );

CREATE POLICY "Partner A can update their settings"
    ON public.pair_settings
    FOR UPDATE
    USING (
        pair_id IN (
            SELECT id FROM public.pairs
            WHERE telegram_user_a = (current_setting('request.jwt.claims', true)::json->>'user_id')::bigint
        )
    )
    WITH CHECK (
        pair_id IN (
            SELECT id FROM public.pairs
            WHERE telegram_user_a = (current_setting('request.jwt.claims', true)::json->>'user_id')::bigint
        )
    );

CREATE POLICY "Partner B can update their settings"
    ON public.pair_settings
    FOR UPDATE
    USING (
        pair_id IN (
            SELECT id FROM public.pairs
            WHERE telegram_user_b = (current_setting('request.jwt.claims', true)::json->>'user_id')::bigint
        )
    )
    WITH CHECK (
        pair_id IN (
            SELECT id FROM public.pairs
            WHERE telegram_user_b = (current_setting('request.jwt.claims', true)::json->>'user_id')::bigint
        )
    );

-- Auto-create settings row when pair is created
CREATE OR REPLACE FUNCTION public.ensure_pair_settings()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO public.pair_settings (pair_id)
    VALUES (NEW.id)
    ON CONFLICT (pair_id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_ensure_pair_settings ON public.pairs;
CREATE TRIGGER trigger_ensure_pair_settings
    AFTER INSERT ON public.pairs
    FOR EACH ROW EXECUTE FUNCTION public.ensure_pair_settings();

-- Backfill for existing pairs
INSERT INTO public.pair_settings (pair_id)
SELECT id FROM public.pairs
ON CONFLICT (pair_id) DO NOTHING;

-- ============ 3. game_sessions: add heat_level_used + expires_at ============
ALTER TABLE public.game_sessions
    ADD COLUMN IF NOT EXISTS heat_level_used smallint CHECK (heat_level_used BETWEEN 1 AND 4),
    ADD COLUMN IF NOT EXISTS expires_at timestamptz;

COMMENT ON COLUMN public.game_sessions.heat_level_used IS 'Actual heat level used for this session (1=flirt..4=wild)';
COMMENT ON COLUMN public.game_sessions.expires_at IS 'Auto-delete timestamp for session data (TTL ~7 days)';

-- Index for TTL cleanup
CREATE INDEX IF NOT EXISTS idx_game_sessions_expires_at ON public.game_sessions(expires_at) WHERE expires_at IS NOT NULL;

-- Set default expires_at for new sessions (7 days)
CREATE OR REPLACE FUNCTION public.set_game_session_expiry()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.expires_at := now() + interval '7 days';
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_game_session_expiry ON public.game_sessions;
CREATE TRIGGER trigger_set_game_session_expiry
    BEFORE INSERT ON public.game_sessions
    FOR EACH ROW EXECUTE FUNCTION public.set_game_session_expiry();

-- ============ 4. game_answers: encrypted storage + TTL ============
ALTER TABLE public.game_answers
    ADD COLUMN IF NOT EXISTS encrypted_answer bytea,
    ADD COLUMN IF NOT EXISTS expires_at timestamptz;

COMMENT ON COLUMN public.game_answers.encrypted_answer IS 'pgcrypto-encrypted answer (for 18+ rounds only). NULL for non-18+.';
COMMENT ON COLUMN public.game_answers.expires_at IS 'Auto-delete timestamp for answer data (TTL ~7 days)';

-- Index for TTL cleanup
CREATE INDEX IF NOT EXISTS idx_game_answers_expires_at ON public.game_answers(expires_at) WHERE expires_at IS NOT NULL;

-- RLS on game_answers: only pair members can read answers for their game sessions
ALTER TABLE public.game_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pair members can read game_answers"
    ON public.game_answers
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.game_sessions gs
            JOIN public.pairs p ON p.id = gs.pair_id
            WHERE gs.id = game_answers.session_id
              AND (
                  p.telegram_user_a = (current_setting('request.jwt.claims', true)::json->>'user_id')::bigint
                  OR p.telegram_user_b = (current_setting('request.jwt.claims', true)::json->>'user_id')::bigint
              )
        )
    );

-- Backend inserts bypass RLS (service_role). Client only subscribes via Realtime.
-- Set expires_at on insert (7 days)
CREATE OR REPLACE FUNCTION public.set_game_answer_expiry()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.expires_at := now() + interval '7 days';
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_game_answer_expiry ON public.game_answers;
CREATE TRIGGER trigger_set_game_answer_expiry
    BEFORE INSERT ON public.game_answers
    FOR EACH ROW EXECUTE FUNCTION public.set_game_answer_expiry();

-- ============ 5. Encryption helpers (pgcrypto) ============
-- Simple symmetric encryption using session_id + user_id as key material.
-- Key derivation: HMAC-SHA256 of (session_id || ':' || user_id) with a server secret.
-- For production, replace with proper KMS / envelope encryption.
-- The server secret should be set via Supabase Vault or environment variable.

CREATE OR REPLACE FUNCTION public.encrypt_answer(
    p_answer text,
    p_session_id uuid,
    p_user_id bigint
) RETURNS bytea LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_key bytea;
    v_iv  bytea;
    v_ct  bytea;
BEGIN
    -- Derive key from session_id + user_id + server secret
    -- In production, store secret in Supabase Vault: vault.get_secret('answer_enc_key')
    v_key := encode(hmac((p_session_id || ':' || p_user_id)::bytea, current_setting('app.answer_enc_key', true)::bytea, 'sha256'), 'hex');
    v_key := decode(substr(v_key, 1, 64), 'hex'); -- 32 bytes for AES-256
    v_iv := gen_random_bytes(12); -- 96-bit IV for AES-GCM
    v_ct := pgp_sym_encrypt(p_answer, v_key || v_iv, 'compress=0, cipher-algo=aes256');
    RETURN v_iv || v_ct; -- prepend IV for decryption
END;
$$;

CREATE OR REPLACE FUNCTION public.decrypt_answer(
    p_encrypted bytea,
    p_session_id uuid,
    p_user_id bigint
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_key bytea;
    v_iv  bytea;
    v_ct  bytea;
    v_pt  text;
BEGIN
    v_key := encode(hmac((p_session_id || ':' || p_user_id)::bytea, current_setting('app.answer_enc_key', true)::bytea, 'sha256'), 'hex');
    v_key := decode(substr(v_key, 1, 64), 'hex');
    v_iv := substr(p_encrypted, 1, 12);
    v_ct := substr(p_encrypted, 13);
    v_pt := pgp_sym_decrypt(v_iv || v_ct, v_key, 'compress=0, cipher-algo=aes256');
    RETURN v_pt;
END;
$$;

-- Set the encryption key from environment (must be configured in Supabase Dashboard -> Settings -> Database -> Custom Postgres Config)
-- ALTER SYSTEM SET app.answer_enc_key = 'your-32-byte-base64-key-here';
-- SELECT pg_reload_conf();

-- ============ 6. Realtime: add game_answers to publication ============
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename = 'game_answers'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.game_answers;
            RAISE NOTICE 'added public.game_answers to supabase_realtime';
        END IF;
    ELSE
        RAISE WARNING 'publication supabase_realtime not found; realtime is not enabled on this project';
    END IF;
END
$$;

-- ============ 6. Cron job for TTL cleanup (runs daily) ============
-- Note: requires pg_cron extension enabled in Supabase
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.schedule(
            'cleanup-expired-game-data',
            '0 3 * * *', -- 03:00 UTC daily
            $$
            DELETE FROM public.game_answers WHERE expires_at IS NOT NULL AND expires_at < now();
            DELETE FROM public.game_sessions WHERE expires_at IS NOT NULL AND expires_at < now();
            $$
        );
        RAISE NOTICE 'Scheduled cron job cleanup-expired-game-data';
    ELSE
        RAISE NOTICE 'pg_cron not available; TTL cleanup must be run manually or via external scheduler';
    END IF;
END
$$;

-- ============ 7. Helper: get effective heat level for a pair ============
CREATE OR REPLACE FUNCTION public.get_effective_heat_level(p_pair_id uuid)
RETURNS smallint LANGUAGE sql STABLE AS $$
    SELECT LEAST(
        COALESCE(hot_level_a, 2),
        COALESCE(hot_level_b, 2)
    ) FROM public.pair_settings WHERE pair_id = p_pair_id;
$$;

COMMENT ON FUNCTION public.get_effective_heat_level(uuid) IS 'Returns min(hot_level_a, hot_level_b) for the pair (1=flirt..4=wild).';

-- ============ 8. Helper: check if pair has 18+ enabled and confirmed ============
CREATE OR REPLACE FUNCTION public.pair_allows_hot_18(p_pair_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
    SELECT hot_18_enabled
         AND hot_18_confirmed_a
         AND hot_18_confirmed_b
    FROM public.pair_settings
    WHERE pair_id = p_pair_id;
$$;

COMMENT ON FUNCTION public.pair_allows_hot_18(uuid) IS 'True if pair has 18+ category enabled and both partners confirmed age.';