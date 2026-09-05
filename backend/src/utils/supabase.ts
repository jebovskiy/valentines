import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config';

let supabaseAdmin: SupabaseClient | null = null;
let supabaseAnon: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return supabaseAdmin;
}

export function getSupabaseAnon(): SupabaseClient {
  if (!supabaseAnon) {
    supabaseAnon = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
  }
  return supabaseAnon;
}

export const supabase = getSupabaseAdmin();