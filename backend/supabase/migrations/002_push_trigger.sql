-- Function to create push jobs and dispatch via pg_net
CREATE OR REPLACE FUNCTION create_push_jobs_and_dispatch()
RETURNS TRIGGER AS $$
DECLARE
  v_devices RECORD;
  v_webhook_url TEXT := current_setting('app.push_webhook_url', true);
  v_webhook_secret TEXT := current_setting('app.push_webhook_secret', true);
  v_signature TEXT;
  v_payload JSONB;
BEGIN
  -- Only for new valentines
  IF TG_OP <> 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- Create push jobs for each device in the pair
  FOR v_devices IN
    SELECT id FROM devices WHERE pair_id = NEW.pair_id AND push_permission_granted = true
  LOOP
    INSERT INTO push_jobs (valentine_id, device_id, channel, status, attempts)
    VALUES (NEW.id, v_devices.id, 'visible', 'pending', 0)
    ON CONFLICT DO NOTHING;

    INSERT INTO push_jobs (valentine_id, device_id, channel, status, attempts)
    VALUES (NEW.id, v_devices.id, 'data', 'pending', 0)
    ON CONFLICT DO NOTHING;

    -- Dispatch visible push
    v_payload := jsonb_build_object(
      'valentine_id', NEW.id,
      'device_id', v_devices.id,
      'channel', 'visible'
    );
    v_signature := encode(hmac(v_payload::TEXT, v_webhook_secret, 'sha256'), 'hex');
    PERFORM pg_net.http_post(
      v_webhook_url || '/api/push/dispatch',
      v_payload,
      jsonb_build_object('Content-Type', 'application/json', 'X-Webhook-Signature', v_signature)
    ) AS visible_result;

    -- Dispatch data push
    v_payload := jsonb_build_object(
      'valentine_id', NEW.id,
      'device_id', v_devices.id,
      'channel', 'data'
    );
    v_signature := encode(hmac(v_payload::TEXT, v_webhook_secret, 'sha256'), 'hex');
    PERFORM pg_net.http_post(
      v_webhook_url || '/api/push/dispatch',
      v_payload,
      jsonb_build_object('Content-Type', 'application/json', 'X-Webhook-Signature', v_signature)
    ) AS data_result;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on valentines insert
DROP TRIGGER IF EXISTS trigger_create_push_jobs ON valentines;
CREATE TRIGGER trigger_create_push_jobs
AFTER INSERT ON valentines
FOR EACH ROW EXECUTE FUNCTION create_push_jobs_and_dispatch();

-- Settings for the webhook URL and secret (set these in Supabase Dashboard -> Settings -> Database -> Custom Settings)
-- ALTER SYSTEM SET app.push_webhook_url = 'https://your-railway-app.up.railway.app';
-- ALTER SYSTEM SET app.push_webhook_secret = 'your-shared-secret';
-- SELECT pg_reload_conf();