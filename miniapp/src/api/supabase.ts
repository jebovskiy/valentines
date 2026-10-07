import { createClient, RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { Valentine } from '../types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!supabase && SUPABASE_URL && SUPABASE_ANON_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  if (!supabase) {
    throw new Error('Supabase not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  }
  return supabase;
}

/**
 * Authorises the realtime socket before subscribing.
 *
 * The anon key alone carries no claims, and the RLS policies added in migration
 * 026 key on `user_id` from the JWT, so without this the socket either receives
 * nothing or (under the old `auth.uid() IS NULL` policies) would have read every
 * pair's rows. The token is minted by the backend from the same Telegram initData
 * that authorises every API call.
 *
 * A missing token is not an error: we stay anonymous and the polling fallbacks
 * keep the screens correct, which is exactly how it behaved before.
 */
async function subscribeChannel(
  name: string,
  token: string | null,
  build: (channel: RealtimeChannel) => RealtimeChannel,
): Promise<RealtimeChannel> {
  const client = getSupabase();
  if (token) {
    try {
      await client.realtime.setAuth(token);
    } catch {
      // A rejected token is not worth breaking a screen over.
    }
  }
  return build(client.channel(name)).subscribe();
}

export function subscribeToValentines(
  pairId: string,
  token: string | null,
  onInsert: (valentine: Valentine) => void,
  onUpdate: (valentine: Valentine) => void,
  onDelete: (valentine: Valentine) => void,
): Promise<RealtimeChannel> {
  return subscribeChannel(`valentines:${pairId}`, token, (channel) =>
    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'valentines',
          filter: `pair_id=eq.${pairId}`,
        },
        (payload) => onInsert(payload.new as Valentine),
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'valentines',
          filter: `pair_id=eq.${pairId}`,
        },
        (payload) => onUpdate(payload.new as Valentine),
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'valentines',
          filter: `pair_id=eq.${pairId}`,
        },
        (payload) => onDelete(payload.old as Valentine),
      ),
  );
}

export function unsubscribeFromValentines(channel: RealtimeChannel): void {
  getSupabase().removeChannel(channel);
}

export function subscribeToDateSessions(
  pairId: string,
  token: string | null,
  onChange: () => void,
): Promise<RealtimeChannel> {
  return subscribeChannel(`dates:${pairId}`, token, (channel) =>
    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'date_sessions',
          filter: `pair_id=eq.${pairId}`,
        },
        () => onChange(),
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'date_sessions',
          filter: `pair_id=eq.${pairId}`,
        },
        () => onChange(),
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'date_sessions',
          filter: `pair_id=eq.${pairId}`,
        },
        () => onChange(),
      ),
  );
}

export function unsubscribeFromDateSessions(channel: RealtimeChannel): void {
  getSupabase().removeChannel(channel);
}

export function subscribeToGameSessions(
  pairId: string,
  token: string | null,
  onChange: () => void,
): Promise<RealtimeChannel> {
  return subscribeChannel(`games:${pairId}`, token, (channel) =>
    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'game_sessions',
          filter: `pair_id=eq.${pairId}`,
        },
        () => onChange(),
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'game_sessions',
          filter: `pair_id=eq.${pairId}`,
        },
        () => onChange(),
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'game_sessions',
          filter: `pair_id=eq.${pairId}`,
        },
        () => onChange(),
      ),
  );
}

export function unsubscribeFromGameSessions(channel: RealtimeChannel): void {
  getSupabase().removeChannel(channel);
}