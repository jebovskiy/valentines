import { config } from '../config';
import { createPairingToken, consumePairingToken, getPairByUser, createPair, registerDevice, getPartnerTelegramId } from './database';
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
  const pairingUrl = `${config.APP_URL}/pair?token=${tokenData.token}`;

  return {
    pairingUrl,
    token: tokenData.token,
    expiresAt: tokenData.expires_at,
  };
}

export interface CompletePairingResult {
  pairId: string;
  partnerTelegramId: number;
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

  return {
    pairId: pair.id,
    partnerTelegramId: partnerId,
    deviceId: device.id,
  };
}

export async function createPairForUsers(userA: number, userB: number): Promise<string> {
  const existingA = await getPairByUser(userA);
  const existingB = await getPairByUser(userB);

  if (existingA || existingB) {
    throw new Error('One or both users already in a pair');
  }

  const pair = await createPair(userA, userB);
  return pair.id;
}