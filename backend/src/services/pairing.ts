import { createPairingToken, consumePairingToken, getPairByUser, createPair, registerDevice, getPartnerTelegramId, createInviteCode, consumeInviteCode } from './database';
import { validateTelegramInitData, TelegramInitData } from '../utils/telegram';

export interface PairingInitResult {
  pairingUrl: string;
  token: string;
  expiresAt: string;
}

export async function initiatePairing(initData: string): Promise<PairingInitResult> {
  const telegramData = validateTelegramInitData(initData);
  if (!telegramData) throw new Error('Invalid Telegram initData');

  const userId = telegramData.user.id;
  const existingPair = await getPairByUser(userId);

  let pairId: string;
  if (existingPair) {
    pairId = existingPair.id;
  } else {
    // For MVP, we'll create a pair when the second user joins
    // This is a simplified approach - in reality you'd need a matching flow
    throw new Error('No existing pair found. Pair creation requires both users.');
  }

  const tokenData = await createPairingToken(userId);
  const pairingUrl = `https://valentines-sigma-neon.vercel.app/c/${tokenData.token}`;

  return {
    pairingUrl,
    token: tokenData.token,
    expiresAt: tokenData.expires_at,
  };
}

export interface CompletePairingResult {
  pairId: string;
  partnerTelegramId: number;
  partnerName: string | null;
  myName: string | null;
  deviceId: string;
}

export async function completePairing(
  token: string,
  platform: 'ios' | 'android',
  pushToken: string
): Promise<CompletePairingResult> {
  const tokenData = await consumePairingToken(token);
  if (!tokenData) throw new Error('Invalid or expired pairing token');

  const userId = tokenData.telegram_user_id;
  const pair = await getPairByUser(userId);
  if (!pair) throw new Error('Pair not found for user');

  const partnerId = await getPartnerTelegramId(pair.id, userId);
  if (!partnerId) throw new Error('Partner not found');

  const device = await registerDevice(pair.id, userId, platform, pushToken);

  const myName = pair.telegram_user_a === userId ? pair.user_a_name : pair.user_b_name;
  const partnerName = pair.telegram_user_a === userId ? pair.user_b_name : pair.user_a_name;

  return {
    pairId: pair.id,
    partnerTelegramId: partnerId,
    partnerName,
    myName,
    deviceId: device.id,
  };
}

export async function createPairForUsers(userA: number, nameA: string | null, userB: number, nameB: string | null): Promise<string> {
  const existingA = await getPairByUser(userA);
  const existingB = await getPairByUser(userB);

  if (existingA || existingB) {
    throw new Error('One or both users already in a pair');
  }

  const pair = await createPair(userA, nameA, userB, nameB);
  return pair.id;
}

export async function createInvite(
  telegramUserId: number,
  creatorFirstName: string
): Promise<{ code: string; expires_at: string }> {
  const existing = await getPairByUser(telegramUserId);
  if (existing) throw new Error('Already in a pair');

  return createInviteCode(telegramUserId, creatorFirstName);
}

export async function joinByInvite(
  code: string,
  joinerTelegramId: number,
  joinerFirstName: string
): Promise<string> {
  const existing = await getPairByUser(joinerTelegramId);
  if (existing) throw new Error('Already in a pair');

  const invite = await consumeInviteCode(code);
  if (!invite) throw new Error('Invalid or expired invite code');
  if (invite.creator_telegram_id === joinerTelegramId) throw new Error('Cannot join your own invite');

  const creatorHasPair = await getPairByUser(invite.creator_telegram_id);
  if (creatorHasPair) throw new Error('Invite creator already joined another pair');

  const pair = await createPair(invite.creator_telegram_id, invite.creator_first_name, joinerTelegramId, joinerFirstName);
  return pair.id;
}