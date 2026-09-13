import { supabase } from '../utils/supabase';

export type DateChoice = 'like' | 'dislike';

export interface DateVote {
  session_id: string;
  user_id: number;
  place_index: number;
  choice: DateChoice;
  created_at: string;
}

export interface DateSessionRow {
  id: string;
  pair_id: string;
  initiator_id: number;
  params: Record<string, unknown>;
  places: unknown[];
  status: 'active' | 'done';
  match: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  votes?: DateVote[];
}

const SESSION_SELECT = 'id, pair_id, initiator_id, params, places, status, match, created_at, updated_at';

export async function getActiveDateSession(pairId: string): Promise<DateSessionRow | null> {
  const { data, error } = await supabase
    .from('date_sessions')
    .select(SESSION_SELECT)
    .eq('pair_id', pairId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return { ...data, votes: await getDateSessionVotes(data.id) } as DateSessionRow;
}

export async function deleteActiveDateSessions(pairId: string): Promise<void> {
  const { error } = await supabase
    .from('date_sessions')
    .delete()
    .eq('pair_id', pairId)
    .eq('status', 'active');
  if (error) throw error;
}

export async function createDateSessionRow(
  pairId: string,
  initiatorId: number,
  params: Record<string, unknown>,
  places: unknown[],
): Promise<DateSessionRow> {
  const { data, error } = await supabase
    .from('date_sessions')
    .insert({ pair_id: pairId, initiator_id: initiatorId, params, places })
    .select(SESSION_SELECT)
    .single();

  if (error) throw error;
  return data as DateSessionRow;
}

export async function getDateSessionById(sessionId: string): Promise<DateSessionRow | null> {
  const { data, error } = await supabase
    .from('date_sessions')
    .select(SESSION_SELECT)
    .eq('id', sessionId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return { ...data, votes: await getDateSessionVotes(data.id) } as DateSessionRow;
}

export async function getDateSessionVotes(sessionId: string): Promise<DateVote[]> {
  const { data, error } = await supabase
    .from('date_votes')
    .select('session_id, user_id, place_index, choice, created_at')
    .eq('session_id', sessionId);

  if (error) throw error;
  return (data ?? []) as DateVote[];
}

export async function upsertDateVote(
  sessionId: string,
  userId: number,
  placeIndex: number,
  choice: DateChoice,
): Promise<void> {
  const { error } = await supabase.from('date_votes').upsert(
    [{ session_id: sessionId, user_id: userId, place_index: placeIndex, choice }],
    { onConflict: 'session_id,user_id,place_index' },
  );
  if (error) throw error;
}

export async function touchDateSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from('date_sessions')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', sessionId);
  if (error) throw error;
}

export async function finishDateSession(sessionId: string, match: Record<string, unknown> | null): Promise<void> {
  const { error } = await supabase
    .from('date_sessions')
    .update({ status: 'done', match, updated_at: new Date().toISOString() })
    .eq('id', sessionId);
  if (error) throw error;
}