import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config';

/**
 * The admin/anon clients are created without a generated `Database` type (the
 * `db:generate` script needs a live project id), so Supabase answers with
 * `any` rows. Callers narrow that to a real row type with a single cast:
 *
 *   const { data, error } = (await supabase...single()) as QueryResult<Greeting>;
 */
export type QueryResult<T> = { data: T; error: PostgrestError | null };


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