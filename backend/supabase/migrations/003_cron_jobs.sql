-- pg_cron sweep job for retrying failed/pending push jobs
-- Runs every 2 minutes to pick up stuck jobs

-- Function to retry pending push jobs
CREATE OR REPLACE FUNCTION retry_pending_push_jobs()
RETURNS VOID AS $$
DECLARE
  v_job RECORD;
  v_webhook_url TEXT := current_setting('app.push_webhook_url', true);
  v_webhook_secret TEXT := current_setting('app.push_webhook_secret', true);
  v_signature TEXT;
  v_payload JSONB;
BEGIN
  -- Find pending jobs that haven't been attempted in 2+ minutes
  FOR v_job IN
    SELECT id, valentine_id, device_id, channel
    FROM push_jobs
    WHERE status = 'pending'
      AND (last_attempt_at IS NULL OR last_attempt_at < now() - INTERVAL '2 minutes')
      AND attempts < 5
    LIMIT 100
  LOOP
    -- Update attempt count and timestamp
    UPDATE push_jobs
    SET attempts = attempts + 1, last_attempt_at = now()
    WHERE id = v_job.id;

    -- Dispatch via pg_net
    v_payload := jsonb_build_object(
      'valentine_id', v_job.valentine_id,
      'device_id', v_job.device_id,
      'channel', v_job.channel
    );
    v_signature := encode(hmac(v_payload::TEXT, v_webhook_secret, 'sha256'), 'hex');
    PERFORM pg_net.http_post(
      v_webhook_url || '/api/push/dispatch',
      v_payload,
      jsonb_build_object('Content-Type', 'application/json', 'X-Webhook-Signature', v_signature)
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule the sweep job (runs every 2 minutes)
-- Note: pg_cron must be enabled in Supabase
SELECT cron.schedule(
  'retry-push-jobs',
  '*/2 * * * *', -- every 2 minutes
  $$ SELECT retry_pending_push_jobs(); $$
);

-- Optional: cleanup old completed push jobs (keep last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_push_jobs()
RETURNS VOID AS $$
BEGIN
  DELETE FROM push_jobs
  WHERE status IN ('sent', 'failed')
    AND created_at < now() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT cron.schedule(
  'cleanup-push-jobs',
  '0 3 * * *', -- daily at 3 AM
  $$ SELECT cleanup_old_push_jobs(); $$
);

-- Optional: cleanup expired pairing tokens
CREATE OR REPLACE FUNCTION cleanup_expired_pairing_tokens()
RETURNS VOID AS $$
BEGIN
  DELETE FROM pairing_tokens WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT cron.schedule(
  'cleanup-pairing-tokens',
  '0 * * * *', -- hourly
  $$ SELECT cleanup_expired_pairing_tokens(); $$
);