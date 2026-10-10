// Set dummy env vars before any other imports
process.env.SUPABASE_URL = 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.TELEGRAM_BOT_TOKEN = 'test-token';
process.env.FCM_SERVICE_ACCOUNT_JSON = '{}';
process.env.WEBHOOK_SHARED_SECRET = 'test-secret-key-32-characters-long';