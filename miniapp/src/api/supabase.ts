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

export function subscribeToValentines(
  pairId: string,
  onInsert: (valentine: Valentine) => void,
  onUpdate: (valentine: Valentine) => void,
  onDelete: (valentine: Valentine) => void
): RealtimeChannel {
  const channel = getSupabase()
    .channel(`valentines:${pairId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'valentines',
        filter: `pair_id=eq.${pairId}`,
      },
      (payload) => onInsert(payload.new as Valentine)
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'valentines',
        filter: `pair_id=eq.${pairId}`,
      },
      (payload) => onUpdate(payload.new as Valentine)
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'valentines',
        filter: `pair_id=eq.${pairId}`,
      },
      (payload) => onDelete(payload.old as Valentine)
    )
    .subscribe();

  return channel;
}

export function unsubscribeFromValentines(channel: RealtimeChannel): void {
  getSupabase().removeChannel(channel);
}

export function subscribeToDateSessions(
  pairId: string,
  onChange: () => void,
): RealtimeChannel {
  const channel = getSupabase()
    .channel(`dates:${pairId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'date_sessions',
        filter: `pair_id=eq.${pairId}`,
      },
      () => onChange()
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'date_sessions',
        filter: `pair_id=eq.${pairId}`,
      },
      () => onChange()
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'date_sessions',
        filter: `pair_id=eq.${pairId}`,
      },
      () => onChange()
    )
    .subscribe();

  return channel;
}

export function unsubscribeFromDateSessions(channel: RealtimeChannel): void {
  getSupabase().removeChannel(channel);
}