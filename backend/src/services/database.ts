import { supabase } from '../utils/supabase';
import { config, AnimationType } from '../config';

export interface Pair {
  id: string;
  telegram_user_a: number;
  telegram_user_b: number;
  user_a_name: string | null;
  user_b_name: string | null;
  created_at: string;
  max_streak: number;
  current_streak?: number;
  /** Pair-local day (YYYY-MM-DD) the run was last counted on; null = never. */
  last_active_date?: string | null;
}

export interface Device {
  id: string;
  pair_id: string;
  telegram_user_id: number;
  platform: 'ios' | 'android';
  push_token: string;
  paired_at: string;
  push_permission_granted: boolean;
  widget_added: boolean;
}

export interface Valentine {
  id: string;
  pair_id: string;
  sender_telegram_id: number;
  animation_type: AnimationType;
  message: string | null;
  photo_url: string | null;
  sent_at: string;
  delivered_at: string | null;
  seen_at: string | null;
}

export interface PushJob {
  id: string;
  valentine_id: string;
  device_id: string;
  channel: 'visible' | 'data';
  status: 'pending' | 'sent' | 'failed';
  attempts: number;
  last_attempt_at: string | null;
}

export interface PairingToken {
  token: string;
  telegram_user_id: number;
  expires_at: string;
}

export type GreetingType = 'morning' | 'night' | 'luck' | 'day' | 'evening' | 'care';

export interface Greeting {
  id: string;
  pair_id: string;
  sender_telegram_id: number;
  type: GreetingType;
  sent_at: string;
}

export async function createGreeting(
  pairId: string,
  senderTelegramId: number,
  type: GreetingType
): Promise<Greeting> {
  const { data, error } = await supabase
    .from('greetings')
    .insert({ pair_id: pairId, sender_telegram_id: senderTelegramId, type })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getLatestGreetingForType(pairId: string, type: GreetingType): Promise<Greeting | null> {
  const { data, error } = await supabase
    .from('greetings')
    .select('*')
    .eq('pair_id', pairId)
    .eq('type', type)
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getLatestGreetings(pairId: string): Promise<Greeting[]> {
  const { data, error } = await supabase
    .from('greetings')
    .select('*')
    .eq('pair_id', pairId)
    .order('sent_at', { ascending: false })
    .limit(10);
  if (error) throw error;
  return data || [];
}

export interface UserProfile {
  telegram_user_id: number;
  username: string | null;
  first_name: string | null;
  display_name: string | null;
  avatar_file_path: string | null;
  /** Telegram profile photo URL from initData (public CDN link). */
  photo_url: string | null;
  updated_at?: string;
}

export async function upsertUserProfile(
  profile: Pick<UserProfile, 'telegram_user_id'> &
    Partial<Pick<UserProfile, 'username' | 'first_name' | 'display_name' | 'avatar_file_path' | 'photo_url'>> &
    Partial<Pick<UserProfile, 'updated_at'>>,
  options: { refreshUpdatedAt?: boolean } = {}
): Promise<void> {
  const { error } = await supabase
    .from('user_profiles')
    .upsert(
      options.refreshUpdatedAt ? { ...profile, updated_at: new Date().toISOString() } : profile,
      { onConflict: 'telegram_user_id' }
    );
  if (error) throw error;
}

export async function getUserProfile(telegramUserId: number): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('telegram_user_id', telegramUserId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateUserDisplayName(telegramUserId: number, displayName: string): Promise<void> {
  const { error } = await supabase
    .from('user_profiles')
    .upsert(
      { telegram_user_id: telegramUserId, display_name: displayName, updated_at: new Date().toISOString() },
      { onConflict: 'telegram_user_id' }
    );
  if (error) throw error;
}

export async function updatePairUserName(pair: Pair, telegramUserId: number, name: string): Promise<Pair | null> {
  const isUserA = pair.telegram_user_a === telegramUserId;
  const column = isUserA ? 'user_a_name' : 'user_b_name';

  const { data, error } = await supabase
    .from('pairs')
    .update({ [column]: name })
    .eq('id', pair.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createPair(userA: number, nameA: string | null, userB: number, nameB: string | null): Promise<Pair> {
  const { data, error } = await supabase
    .from('pairs')
    .insert({
      telegram_user_a: userA,
      telegram_user_b: userB,
      user_a_name: nameA,
      user_b_name: nameB,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getPairByUser(telegramUserId: number): Promise<Pair | null> {
  const { data, error } = await supabase
    .from('pairs')
    .select('*')
    .or(`telegram_user_a.eq.${telegramUserId},telegram_user_b.eq.${telegramUserId}`)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createSelfPair(telegramUserId: number, firstName: string | null): Promise<Pair> {
  return createPair(telegramUserId, firstName, telegramUserId, firstName);
}

export async function getPairById(pairId: string): Promise<Pair | null> {
  const { data, error } = await supabase.from('pairs').select('*').eq('id', pairId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function registerDevice(
  pairId: string,
  telegramUserId: number,
  platform: 'ios' | 'android',
  pushToken: string
): Promise<Device> {
  const { data, error } = await supabase
    .from('devices')
    .upsert(
      {
        pair_id: pairId,
        telegram_user_id: telegramUserId,
        platform,
        push_token: pushToken,
        paired_at: new Date().toISOString(),
      },
      { onConflict: 'pair_id,telegram_user_id,platform' }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getDevicesByPair(pairId: string): Promise<Device[]> {
  const { data, error } = await supabase.from('devices').select('*').eq('pair_id', pairId);
  if (error) throw error;
  return data || [];
}

export async function getDeviceByUserAndPlatform(
  pairId: string,
  telegramUserId: number,
  platform: 'ios' | 'android'
): Promise<Device | null> {
  const { data, error } = await supabase
    .from('devices')
    .select('*')
    .eq('pair_id', pairId)
    .eq('telegram_user_id', telegramUserId)
    .eq('platform', platform)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getDeviceById(deviceId: string): Promise<Device | null> {
  const { data, error } = await supabase.from('devices').select('*').eq('id', deviceId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateDevicePushPermission(deviceId: string, granted: boolean): Promise<void> {
  const { error } = await supabase.from('devices').update({ push_permission_granted: granted }).eq('id', deviceId);
  if (error) throw error;
}

export async function updateDevicePushToken(deviceId: string, pushToken: string): Promise<void> {
  const { error } = await supabase.from('devices').update({ push_token: pushToken }).eq('id', deviceId);
  if (error) throw error;
}

export async function updateDeviceWidgetAdded(deviceId: string, added: boolean): Promise<void> {
  const { error } = await supabase.from('devices').update({ widget_added: added }).eq('id', deviceId);
  if (error) throw error;
}

export async function createValentine(
  pairId: string,
  senderTelegramId: number,
  animationType: AnimationType,
  message: string | null,
  photoUrl: string | null = null
): Promise<Valentine> {
  const { data, error } = await supabase
    .from('valentines')
    .insert({
      pair_id: pairId,
      sender_telegram_id: senderTelegramId,
      animation_type: animationType,
      message,
      photo_url: photoUrl,
      delivered_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getValentinesByPair(pairId: string, limit = 50): Promise<Valentine[]> {
  const { data, error } = await supabase
    .from('valentines')
    .select('*')
    .eq('pair_id', pairId)
    .order('sent_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function getValentineById(valentineId: string): Promise<Valentine | null> {
  const { data, error } = await supabase.from('valentines').select('*').eq('id', valentineId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function markValentineDelivered(valentineId: string): Promise<void> {
  const { error } = await supabase
    .from('valentines')
    .update({ delivered_at: new Date().toISOString() })
    .eq('id', valentineId)
    .is('delivered_at', null);
  if (error) throw error;
}

export async function markValentineSeen(valentineId: string): Promise<void> {
  const { error } = await supabase
    .from('valentines')
    .update({ seen_at: new Date().toISOString() })
    .eq('id', valentineId)
    .is('seen_at', null);
  if (error) throw error;
}

export async function createPushJobs(
  valentineId: string,
  deviceIds: string[],
  channels: ('visible' | 'data')[]
): Promise<PushJob[]> {
  const jobs = deviceIds.flatMap((deviceId) =>
    channels.map((channel) => ({
      valentine_id: valentineId,
      device_id: deviceId,
      channel,
      status: 'pending' as const,
      attempts: 0,
    }))
  );

  const { data, error } = await supabase.from('push_jobs').insert(jobs).select();
  if (error) throw error;
  return data || [];
}

export async function getPushJob(valentineId: string, deviceId: string, channel: 'visible' | 'data'): Promise<PushJob | null> {
  const { data, error } = await supabase
    .from('push_jobs')
    .select('*')
    .eq('valentine_id', valentineId)
    .eq('device_id', deviceId)
    .eq('channel', channel)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getPendingPushJobs(limit = 100): Promise<PushJob[]> {
  const { data, error } = await supabase
    .from('push_jobs')
    .select('*')
    .eq('status', 'pending')
    .or(`last_attempt_at.is.null,last_attempt_at.lt.${new Date(Date.now() - 2 * 60 * 1000).toISOString()}`)
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function updatePushJobStatus(
  jobId: string,
  status: 'sent' | 'failed',
  attempts: number
): Promise<void> {
  const { error } = await supabase
    .from('push_jobs')
    .update({ status, attempts, last_attempt_at: new Date().toISOString() })
    .eq('id', jobId);
  if (error) throw error;
}

export async function createPairingToken(telegramUserId: number): Promise<PairingToken> {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + config.PAIRING_TOKEN_TTL_MINUTES * 60 * 1000).toISOString();

  const { error } = await supabase
    .from('pairing_tokens')
    .insert({ token, telegram_user_id: telegramUserId, expires_at: expiresAt });

  if (error) throw error;
  return { token, telegram_user_id: telegramUserId, expires_at: expiresAt };
}

export async function consumePairingToken(token: string): Promise<{ telegram_user_id: number } | null> {
  // Atomic single-statement consume: the DELETE...RETURNING runs in one DB
  // round-trip, so two concurrent requests can never both "win" the token.
  const { data, error } = await supabase
    .from('pairing_tokens')
    .delete()
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .select('telegram_user_id')
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function getPairingTokenByValue(token: string): Promise<{ telegram_user_id: number; expires_at: string } | null> {
  const { data, error } = await supabase
    .from('pairing_tokens')
    .select('telegram_user_id, expires_at')
    .eq('token', token)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function getPartnerTelegramId(pairId: string, currentUserId: number): Promise<number | null> {
  const pair = await getPairById(pairId);
  if (!pair) return null;
  return pair.telegram_user_a === currentUserId ? pair.telegram_user_b : pair.telegram_user_a;
}

const INVITE_CODE_LENGTH = 8;

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    code += chars[crypto.getRandomValues(new Uint32Array(1))[0] % chars.length];
  }
  return code;
}

export async function createInviteCode(
  telegramUserId: number,
  creatorFirstName: string,
  validMinutes = 30
): Promise<{ code: string; expires_at: string }> {
  const code = generateInviteCode();
  const expiresAt = new Date(Date.now() + validMinutes * 60 * 1000).toISOString();

  const { error } = await supabase.from('pair_invites').insert({
    code,
    creator_telegram_id: telegramUserId,
    creator_first_name: creatorFirstName,
    expires_at: expiresAt,
  });
  if (error) throw error;

  return { code, expires_at: expiresAt };
}

export async function consumeInviteCode(
  code: string
): Promise<{ creator_telegram_id: number; creator_first_name: string | null } | null> {
  if (!/^[A-Z0-9]{6,12}$/.test(code)) return null;

  // Atomic single-statement consume: DELETE...RETURNING prevents two joiners
  // from winning the same invite code under concurrency.
  const { data, error } = await supabase
    .from('pair_invites')
    .delete()
    .eq('code', code.toUpperCase())
    .gt('expires_at', new Date().toISOString())
    .select('creator_telegram_id, creator_first_name')
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

// --- Streak gamification -----------------------------------------------------

/** Keeps the best run the pair ever had; the counter itself lives in services/streak. */
export async function updatePairMaxStreak(pairId: string, streak: number): Promise<void> {
  const { error } = await supabase
    .from('pairs')
    .update({ max_streak: streak })
    .eq('id', pairId)
    .lt('max_streak', streak);
  if (error) throw error;
}

/** Writes the derived run length into the cache column. */
export async function setPairCurrentStreak(pairId: string, streak: number): Promise<void> {
  const { error } = await supabase
    .from('pairs')
    .update({ current_streak: Math.max(0, Math.floor(streak)) })
    .eq('id', pairId);
  if (error) throw error;
}

// --- Notes & Reminders --------------------------------------------------------

export interface Note {
  id: string;
  pair_id: string;
  author_id: number;
  content: string;
  category: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface Reminder {
  id: string;
  pair_id: string;
  author_id: number;
  title: string;
  message: string | null;
  remind_at: string;
  is_recurring: boolean;
  recurrence: string | null;
  is_sent: boolean;
  created_at: string;
}

export interface CoupleEvent {
  id: string;
  pair_id: string;
  name: string;
  event_date: string;
  event_type: string;
  remind_days_before: number;
  created_at: string;
}

export async function getNotes(pairId: string): Promise<Note[]> {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('pair_id', pairId)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createNote(
  pairId: string,
  authorId: number,
  content: string,
  category: string
): Promise<Note> {
  const { data, error } = await supabase
    .from('notes')
    .insert({ pair_id: pairId, author_id: authorId, content, category })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateNote(
  noteId: string,
  pairId: string,
  updates: { content?: string; category?: string; is_pinned?: boolean }
): Promise<void> {
  const { error } = await supabase
    .from('notes')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', noteId)
    .eq('pair_id', pairId);
  if (error) throw error;
}

export async function deleteNote(noteId: string, pairId: string): Promise<void> {
  const { error } = await supabase.from('notes').delete().eq('id', noteId).eq('pair_id', pairId);
  if (error) throw error;
}

export async function getReminders(pairId: string): Promise<Reminder[]> {
  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .eq('pair_id', pairId)
    .order('remind_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createReminder(input: {
  pair_id: string;
  author_id: number;
  title: string;
  message?: string | null;
  remind_at: string;
  is_recurring?: boolean;
  recurrence?: string | null;
}): Promise<Reminder> {
  const { data, error } = await supabase
    .from('reminders')
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteReminder(reminderId: string, pairId: string): Promise<void> {
  const { error } = await supabase
    .from('reminders')
    .delete()
    .eq('id', reminderId)
    .eq('pair_id', pairId);
  if (error) throw error;
}

export async function getReminderById(reminderId: string): Promise<Reminder | null> {
  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .eq('id', reminderId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function markReminderSent(reminderId: string): Promise<void> {
  const { error } = await supabase.from('reminders').update({ is_sent: true, claimed_at: null }).eq('id', reminderId);
  if (error) throw error;
}

/** Release a reminder's claim without marking it sent so a later sweep retries it. */
export async function releaseReminderClaim(reminderId: string): Promise<void> {
  const { error } = await supabase.from('reminders').update({ claimed_at: null }).eq('id', reminderId).eq('is_sent', false);
  if (error) throw error;
}

export async function rescheduleRecurringReminder(reminderId: string, nextAt: string): Promise<void> {
  const { error } = await supabase
    .from('reminders')
    .update({ remind_at: nextAt, is_sent: false, claimed_at: null })
    .eq('id', reminderId);
  if (error) throw error;
}

export async function getCoupleEvents(pairId: string): Promise<CoupleEvent[]> {
  const { data, error } = await supabase
    .from('couple_events')
    .select('*')
    .eq('pair_id', pairId)
    .order('event_date', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createCoupleEvent(input: {
  pair_id: string;
  name: string;
  event_date: string;
  event_type?: string;
  remind_days_before?: number;
}): Promise<CoupleEvent> {
  const { data, error } = await supabase
    .from('couple_events')
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCoupleEvent(eventId: string, pairId: string): Promise<void> {
  const { error } = await supabase
    .from('couple_events')
    .delete()
    .eq('id', eventId)
    .eq('pair_id', pairId);
  if (error) throw error;
}

/** Reminders whose time has come and haven't been delivered yet. */
export async function getDueReminders(limit = 50): Promise<Reminder[]> {
  // Atomic claim: rows are locked (FOR UPDATE SKIP LOCKED) and stamped
  // claimed_at in the same transaction, so scaled-out scheduler instances
  // never dispatch the same reminder twice. Stale claims are re-claimed after
  // 10 minutes (crashed worker / failed dispatch).
  const { data, error } = await supabase.rpc('claim_due_reminders', { p_limit: limit });

  if (error) throw error;
  return (data || []) as unknown as Reminder[];
}

export async function getCoupleEventById(eventId: string): Promise<CoupleEvent | null> {
  const { data, error } = await supabase
    .from('couple_events')
    .select('*')
    .eq('id', eventId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Events that haven't been announced to the pair yet. */
export async function getUnnotifiedEvents(limit = 50): Promise<CoupleEvent[]> {
  // Atomic claim: same SKIP LOCKED semantics as reminders.
  const { data, error } = await supabase.rpc('claim_unnotified_events', { p_limit: limit });

  if (error) throw error;
  return (data || []) as unknown as CoupleEvent[];
}

export async function markCoupleEventNotified(eventId: string): Promise<void> {
  const { error } = await supabase
    .from('couple_events')
    .update({ notified_at: new Date().toISOString(), claimed_at: null })
    .eq('id', eventId);
  if (error) throw error;
}

/** Release an event's claim without marking it notified so a later sweep retries it. */
export async function releaseEventClaim(eventId: string): Promise<void> {
  const { error } = await supabase
    .from('couple_events')
    .update({ claimed_at: null })
    .eq('id', eventId)
    .is('notified_at', null);
  if (error) throw error;
}

/** All devices across all pairs that are allowed to receive notifications. */
export async function getAllDevices(): Promise<Device[]> {
  const { data, error } = await supabase
    .from('devices')
    .select('*')
    .eq('push_permission_granted', true);
  if (error) throw error;
  return data || [];
}

// --- Movies -------------------------------------------------------------------

export type MovieStatus = 'want_to_watch' | 'watched';

export interface Movie {
  id: string;
  pair_id: string;
  kp_id: number | null;
  title: string;
  year: number | null;
  poster_url: string | null;
  genre: string | null;
  description: string | null;
  runtime: string | null;
  rating: string | null;
  status: MovieStatus;
  added_by: number;
  added_at: string;
  watched_at: string | null;
  aspect_scores: Record<string, number> | null;
}

export interface MovieReview {
  id: string;
  movie_id: string;
  author_telegram_id: number;
  visuals: number;
  plot: number;
  acting: number;
  music: number;
  atmosphere: number;
  humor: number;
  review_text: string | null;
  created_at: string;
}

export interface MovieInsight {
  movie_id: string;
  result: Record<string, unknown>;
  status: 'generating' | 'done';
  created_at: string;
}

export interface MovieWatch {
  movie_id: string;
  author_telegram_id: number;
  watched_at: string;
}

export interface MovieListItem extends Movie {
  reviews: MovieReview[];
  watches: number[];
  added_by_name?: string;
}

export async function getMovies(pairId: string): Promise<Movie[]> {
  const { data, error } = await supabase
    .from('movies')
    .select('*')
    .eq('pair_id', pairId)
    .order('added_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getMovieById(movieId: string): Promise<Movie | null> {
  const { data, error } = await supabase
    .from('movies')
    .select('*')
    .eq('id', movieId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getMovieByKp(pairId: string, kpId: number): Promise<Movie | null> {
  const { data, error } = await supabase
    .from('movies')
    .select('*')
    .eq('pair_id', pairId)
    .eq('kp_id', kpId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Postgres error code for a unique violation (see migration 029). */
export const UNIQUE_VIOLATION = '23505';

export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  const code = (error as { code?: string } | null)?.code;
  if (code !== UNIQUE_VIOLATION) return false;
  if (!constraint) return true;
  const message = (error as { message?: string }).message ?? '';
  return message.includes(constraint);
}

export interface DuplicateMovieError extends Error {
  code: typeof UNIQUE_VIOLATION;
}

function isDuplicateMovieError(error: unknown): error is DuplicateMovieError {
  return isUniqueViolation(error, 'movies_pair_kp_uniq');
}

export async function createMovie(input: {
  pair_id: string;
  added_by: number;
  kp_id?: number | null;
  title: string;
  year?: number | null;
  poster_url?: string | null;
  genre?: string | null;
  description?: string | null;
  runtime?: string | null;
  rating?: string | null;
}): Promise<Movie> {
  const { data, error } = await supabase
    .from('movies')
    .insert({
      pair_id: input.pair_id,
      added_by: input.added_by,
      kp_id: input.kp_id ?? null,
      title: input.title,
      year: input.year ?? null,
      poster_url: input.poster_url ?? null,
      genre: input.genre ?? null,
      description: input.description ?? null,
      runtime: input.runtime ?? null,
      rating: input.rating ?? null,
    })
    .select()
    .single();

  // Lost the race against a concurrent add of the same kp_id: the unique index
  // from migration 029 did its job, and the caller should behave exactly like it
  // does after its own pre-check found the row.
  if (error && isDuplicateMovieError(error)) throw error;
  if (error) throw error;
  return data;
}

export async function deleteMovie(movieId: string, pairId: string): Promise<void> {
  const { error } = await supabase.from('movies').delete().eq('id', movieId).eq('pair_id', pairId);
  if (error) throw error;
}

export async function markMovieStatus(movieId: string, status: MovieStatus, watchedAt: string | null): Promise<void> {
  const { error } = await supabase
    .from('movies')
    .update({ status, watched_at: watchedAt })
    .eq('id', movieId);
  if (error) throw error;
}

export async function getMovieReviews(movieId: string): Promise<MovieReview[]> {
  const { data, error } = await supabase.from('movie_reviews').select('*').eq('movie_id', movieId);
  if (error) throw error;
  return data || [];
}

export async function getMovieReviewsBatch(movieIds: string[]): Promise<MovieReview[]> {
  if (movieIds.length === 0) return [];
  const { data, error } = await supabase.from('movie_reviews').select('*').in('movie_id', movieIds);
  if (error) throw error;
  return data || [];
}

export async function upsertMovieReview(input: {
  movie_id: string;
  author_telegram_id: number;
  visuals: number;
  plot: number;
  acting: number;
  music: number;
  atmosphere: number;
  humor: number;
  review_text: string | null;
}): Promise<MovieReview> {
  const { data, error } = await supabase
    .from('movie_reviews')
    .upsert(input, { onConflict: 'movie_id,author_telegram_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getMovieWatches(movieId: string): Promise<MovieWatch[]> {
  const { data, error } = await supabase.from('movie_watches').select('*').eq('movie_id', movieId);
  if (error) throw error;
  return data || [];
}

export async function getMovieWatchesBatch(movieIds: string[]): Promise<MovieWatch[]> {
  if (movieIds.length === 0) return [];
  const { data, error } = await supabase.from('movie_watches').select('*').in('movie_id', movieIds);
  if (error) throw error;
  return data || [];
}

export async function upsertMovieWatch(movieId: string, authorTelegramId: number): Promise<void> {
  const { error } = await supabase
    .from('movie_watches')
    .upsert({ movie_id: movieId, author_telegram_id: authorTelegramId }, { onConflict: 'movie_id,author_telegram_id' });
  if (error) throw error;
}

/** Returns a completed insight only (skips rows still being generated). */
export async function getMovieInsight(movieId: string): Promise<MovieInsight | null> {
  const { data, error } = await supabase
    .from('movie_insights')
    .select('*')
    .eq('movie_id', movieId)
    .eq('status', 'done')
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Atomically claims the right to generate an insight for a movie.
 *
 * Migration 028 moved this into SQL so a claim older than `staleAfter` can be
 * taken over: the previous `ON CONFLICT DO NOTHING` insert-only claim could never
 * be won twice, so one crashed worker froze that movie's insight forever.
 * Returns true only if this caller owns the claim.
 */
export async function claimMovieInsight(movieId: string, staleAfterMinutes = 5): Promise<boolean> {
  const { data, error } = await supabase.rpc('claim_movie_insight', {
    p_movie_id: movieId,
    p_stale_after: `${staleAfterMinutes} minutes`,
  });

  if (!error) return data === true;

  // Migration 028 not applied yet -- fall back to the old insert-only claim so
  // insights keep working (just without the stale takeover).
  if (error.code === '42883' || error.code === 'PGRST202' || error.code === '404') {
    const { count, error: fallbackError } = await supabase
      .from('movie_insights')
      .upsert(
        { movie_id: movieId, result: {}, status: 'generating' },
        { onConflict: 'movie_id', ignoreDuplicates: true, count: 'exact' },
      );
    if (fallbackError) throw fallbackError;
    return (count ?? 0) > 0;
  }

  throw error;
}

/** Marks the claim row as done with the final result. Scoped to 'generating'. */
export async function finishMovieInsight(movieId: string, result: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.rpc('finish_movie_insight', {
    p_movie_id: movieId,
    p_result: result,
  });
  if (!error) return;
  if (error.code === '42883' || error.code === 'PGRST202' || error.code === '404') {
    const { error: fallbackError } = await supabase
      .from('movie_insights')
      .update({ result, status: 'done', created_at: new Date().toISOString() })
      .eq('movie_id', movieId)
      .eq('status', 'generating');
    if (fallbackError) throw fallbackError;
    return;
  }
  throw error;
}

/** Releases the claim so a later retry can re-claim. Never touches a done row. */
export async function abandonMovieInsight(movieId: string): Promise<void> {
  const { error } = await supabase.rpc('release_movie_insight', { p_movie_id: movieId });
  if (!error) return;
  if (error.code === '42883' || error.code === 'PGRST202' || error.code === '404') {
    const { error: fallbackError } = await supabase
      .from('movie_insights')
      .delete()
      .eq('movie_id', movieId)
      .eq('status', 'generating');
    if (fallbackError) throw fallbackError;
    return;
  }
  throw error;
}

/** Pairs that have any movies but haven't received a reminder today. */
export async function getPairsForMovieReminder(today: string): Promise<string[]> {
  const [moviesRes, logRes] = await Promise.all([
    supabase.from('movies').select('pair_id'),
    supabase.from('movie_reminder_log').select('pair_id').eq('last_sent_on', today),
  ]);
  if (moviesRes.error) throw moviesRes.error;
  if (logRes.error) throw logRes.error;
  const logged = new Set((logRes.data || []).map((r) => r.pair_id));
  return [...new Set((moviesRes.data || []).map((m) => m.pair_id))].filter((id) => !logged.has(id));
}

/**
 * Atomically claims today's movie reminder for the pair. Only the caller whose
 * upsert actually performed the update/insert gets the row back, so exactly one
 * scheduler instance dispatches per pair per day.
 */
export async function claimMovieReminder(pairId: string, today: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('log_movie_reminder_once', {
    p_pair_id: pairId,
    p_sent_date: today,
  });
  if (error) throw error;
  return Array.isArray(data) && data.length > 0;
}

export async function saveMovieAspectScores(movieId: string, scores: Record<string, number>): Promise<void> {
  const { error } = await supabase
    .from('movies')
    .update({ aspect_scores: scores })
    .eq('id', movieId);
  if (error) throw error;
}

export interface TasteProfile {
  user_telegram_id: number;
  aspect_weights: Record<string, number>;
  created_at: string;
  updated_at: string;
}

export async function getTasteProfile(userTelegramId: number): Promise<TasteProfile | null> {
  const { data, error } = await supabase
    .from('taste_profiles')
    .select('*')
    .eq('user_telegram_id', userTelegramId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertTasteProfile(userTelegramId: number, aspectWeights: Record<string, number>): Promise<void> {
  const { error } = await supabase
    .from('taste_profiles')
    .upsert(
      { user_telegram_id: userTelegramId, aspect_weights: aspectWeights, updated_at: new Date().toISOString() },
      { onConflict: 'user_telegram_id' }
    );
  if (error) throw error;
}