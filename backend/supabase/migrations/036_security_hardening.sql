-- Migration 036: security hardening
-- APPLY: psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f 036_security_hardening.sql

-- ============ 1. pair_settings: drop the client UPDATE policies ============
-- Settings are written exclusively by the backend through the service_role,
-- which bypasses RLS. The two per-partner UPDATE policies let any authenticated
-- client flip the OTHER partner's columns (heat level, hot_18_confirmed_b),
-- i.e. consent could be forged. SELECT stays so Realtime keeps working.
DROP POLICY IF EXISTS "Partner A can update their settings" ON public.pair_settings;
DROP POLICY IF EXISTS "Partner B can update their settings" ON public.pair_settings;

-- ============ 2. add_level_ready: pin search_path + drop the PUBLIC grant ============
-- A SECURITY DEFINER function without a fixed search_path can be hijacked by a
-- caller-controlled schema; the default PUBLIC EXECUTE grant let an anon key
-- call it too.
CREATE OR REPLACE FUNCTION public.add_level_ready(
    p_session_id uuid,
    p_user_id bigint
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

REVOKE ALL ON FUNCTION public.add_level_ready(uuid, bigint) FROM PUBLIC;

-- ============ 3. encrypt/decrypt_answer hardening ============
-- Two problems with the originals:
--   * no `SET search_path`, and pgcrypto lives in the `extensions` schema, so
--     pgp_sym_encrypt could resolve to an attacker-supplied shadow function;
--   * when `app.answer_enc_key` was unset, hmac(..., NULL) returned NULL and
--     pgp_sym_encrypt(NULL, ...) silently returned NULL, so the answer was
--     stored as an empty blob (data loss) with no error.
-- The functions now fail loudly when the key is missing.
CREATE OR REPLACE FUNCTION public.encrypt_answer(
    p_answer text,
    p_session_id uuid,
    p_user_id bigint
) RETURNS bytea LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
    v_key text;
    v_passphrase text;
BEGIN
    v_key := current_setting('app.answer_enc_key', true);
    IF v_key IS NULL OR v_key = '' THEN
        RAISE EXCEPTION 'answer encryption key (app.answer_enc_key) is not configured';
    END IF;
    v_passphrase := encode(hmac((p_session_id || ':' || p_user_id)::bytea, v_key::bytea, 'sha256'), 'hex');
    RETURN pgp_sym_encrypt(p_answer, v_passphrase, 'compress=0, cipher-algo=aes256');
END;
$$;

CREATE OR REPLACE FUNCTION public.decrypt_answer(
    p_encrypted bytea,
    p_session_id uuid,
    p_user_id bigint
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
    v_key text;
    v_passphrase text;
BEGIN
    v_key := current_setting('app.answer_enc_key', true);
    IF v_key IS NULL OR v_key = '' THEN
        RAISE EXCEPTION 'answer encryption key (app.answer_enc_key) is not configured';
    END IF;
    v_passphrase := encode(hmac((p_session_id || ':' || p_user_id)::bytea, v_key::bytea, 'sha256'), 'hex');
    RETURN pgp_sym_decrypt(p_encrypted, v_passphrase, 'compress=0, cipher-algo=aes256');
END;
$$;

REVOKE ALL ON FUNCTION public.encrypt_answer(text, uuid, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decrypt_answer(bytea, uuid, bigint) FROM PUBLIC;

-- ============ 4. Companion device secret ============
-- The companion API was authenticated by the device_id alone, which is a uuid
-- that also travels inside push payloads and logs, so it is not a secret.
-- Pairing now issues a random per-device token and only its SHA-256 hash is
-- stored here.
ALTER TABLE public.devices
    ADD COLUMN IF NOT EXISTS device_secret_hash text;

CREATE INDEX IF NOT EXISTS idx_devices_secret_hash
    ON public.devices(device_secret_hash)
    WHERE device_secret_hash IS NOT NULL;

-- ============ 5. Reminder ============
-- Set the key once per database (Supabase Dashboard -> Settings -> Database ->
-- Custom Postgres Config, or):
--   ALTER DATABASE postgres SET app.answer_enc_key = '<32-byte-random>';
-- For a managed secret store prefer Supabase Vault and read it inside the
-- functions instead of a GUC.
