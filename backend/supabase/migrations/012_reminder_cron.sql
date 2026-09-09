-- pg_cron job: send due reminder notifications every minute
CREATE OR REPLACE FUNCTION dispatch_due_reminders()
RETURNS VOID AS $$
DECLARE
  v_reminder RECORD;
  v_webhook_url TEXT := current_setting('app.push_webhook_url', true);
  v_webhook_secret TEXT := current_setting('app.push_webhook_secret', true);
  v_payload JSONB;
  v_signature TEXT;
BEGIN
  FOR v_reminder IN
    SELECT id, pair_id, title
    FROM reminders
    WHERE is_sent = false AND remind_at <= now()
    LIMIT 20
  LOOP
    v_payload := jsonb_build_object('reminder_id', v_reminder.id);
    v_signature := encode(hmac(v_payload::TEXT, v_webhook_secret, 'sha256'), 'hex');

    PERFORM pg_net.http_post(
      v_webhook_url || '/api/reminders/dispatch',
      v_payload,
      jsonb_build_object('Content-Type', 'application/json', 'X-Webhook-Signature', v_signature)
    );

    -- Mark as sent immediately so we don't re-fire while the webhook is still
    -- processing. The webhook handler will reschedule recurring reminders.
    UPDATE reminders SET is_sent = true WHERE id = v_reminder.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT cron.schedule(
  'dispatch-reminders',
  '* * * * *',  -- every minute
  $$ SELECT dispatch_due_reminders(); $$
);