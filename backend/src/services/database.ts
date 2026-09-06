import { supabase } from '../utils/supabase';
import { config, AnimationType } from '../config';

export interface Pair {
  id: string;
  telegram_user_a: number;
  telegram_user_b: number;
  user_a_name: string | null;
  user_b_name: string | null;
  created_at: string;
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
  message: string | null
): Promise<Valentine> {
  const { data, error } = await supabase
    .from('valentines')
    .insert({
      pair_id: pairId,
      sender_telegram_id: senderTelegramId,
      animation_type: animationType,
      message,
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
  const { data, error } = await supabase
    .from('pairing_tokens')
    .select('telegram_user_id')
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  await supabase.from('pairing_tokens').delete().eq('token', token);
  return { telegram_user_id: data.telegram_user_id };
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
  const { data, error } = await supabase
    .from('pair_invites')
    .select('creator_telegram_id, creator_first_name')
    .eq('code', code.toUpperCase())
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  await supabase.from('pair_invites').delete().eq('code', code.toUpperCase());
  return { creator_telegram_id: data.creator_telegram_id, creator_first_name: data.creator_first_name };
}