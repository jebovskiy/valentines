import { sendVisiblePush, sendDataPush, sendBothPushes, sendGreetingDataPush, PushPayload } from './fcm';
import { getDeviceById, getValentineById, getPairById, getPushJob, updatePushJobStatus, markValentineDelivered, getPendingPushJobs, getDevicesByPair, Valentine, Pair } from './database';

export interface PushDispatchPayload {
  valentine_id: string;
  device_id: string;
  channel: 'visible' | 'data';
}

function senderName(pair: Pair, senderTelegramId: number): string {
  if (pair.telegram_user_a === senderTelegramId) return pair.user_a_name || 'Партнер';
  return pair.user_b_name || 'Партнер';
}

/**
 * Sends a lightweight data interaction signal ("доброе утро") to the partner's
 * companion devices. The miniapp renders the animated scene; the Android app
 * shows an awareness notification.
 */
export async function dispatchGreetingPushes(pairId: string, senderTelegramId: number, greetingType: 'morning' | 'night'): Promise<void> {
  let fromName = 'Партнер';
  try {
    const pair = await getPairById(pairId);
    if (pair) fromName = senderName(pair, senderTelegramId);
  } catch (error) {
    console.error('Greeting push: failed to load pair', error);
  }

  let devices;
  try {
    devices = await getDevicesByPair(pairId);
  } catch (error) {
    console.error('Greeting push: failed to load devices', error);
    return;
  }

  for (const device of devices) {
    if (device.telegram_user_id === senderTelegramId) continue;
    if (!device.push_token || device.push_token === 'pending') continue;
    try {
      const result = await sendGreetingDataPush(device.push_token, { type: greetingType, from_name: fromName });
      console.log(`Greeting push sent to device ${device.id}: ${result.success}`);
    } catch (error) {
      console.error(`Greeting push error for device ${device.id}:`, error);
    }
  }
}

export async function dispatchPush(payload: PushDispatchPayload): Promise<void> {
  const { valentine_id, device_id, channel } = payload;

  const [device, valentine] = await Promise.all([
    getDeviceById(device_id),
    getValentineById(valentine_id),
  ]);

  if (!device || !valentine) {
    console.error(`Push dispatch: device or valentine not found`, { device_id, valentine_id });
    return;
  }

  const job = await getPushJob(valentine_id, device_id, channel);
  if (!job) {
    console.error(`Push dispatch: push job not found`, { device_id, valentine_id, channel });
    return;
  }

  const pairData = await getPairById(valentine.pair_id);

  if (!device.push_permission_granted) {
    console.log(`Push dispatch: permission not granted for device ${device_id}`);
    await updatePushJobStatus(job.id, 'failed', job.attempts + 1);
    return;
  }

  const pushPayload: PushPayload = {
    valentine_id: valentine.id,
    from_name: pairData ? senderName(pairData, valentine.sender_telegram_id) : 'Партнер',
    animation_type: valentine.animation_type,
    sent_at: valentine.sent_at,
    message: valentine.message || undefined,
    photo_url: valentine.photo_url || undefined,
  };

  try {
    if (channel === 'visible') {
      const result = await sendVisiblePushToDevice(device.push_token, pushPayload);
      await updatePushJobStatus(job.id, result.success ? 'sent' : 'failed', job.attempts + 1);
      if (result.success) await markValentineDelivered(valentine_id);
    } else {
      const result = await sendDataPushToDevice(device.push_token, pushPayload);
      await updatePushJobStatus(job.id, result.success ? 'sent' : 'failed', job.attempts + 1);
    }
  } catch (error) {
    console.error(`Push dispatch error:`, error);
    await updatePushJobStatus(job.id, 'failed', job.attempts + 1);
  }
}

async function sendVisiblePushToDevice(token: string, payload: PushPayload) {
  return sendVisiblePush(token, payload);
}

async function sendDataPushToDevice(token: string, payload: PushPayload) {
  return sendDataPush(token, payload);
}

export async function retryPendingPushJobs(): Promise<void> {
  const jobs = await getPendingPushJobs();

  for (const job of jobs) {
    await dispatchPush({
      valentine_id: job.valentine_id,
      device_id: job.device_id,
      channel: job.channel,
    });
  }
}

/**
 * Sends both visible + data pushes for a freshly created valentine directly
 * to every paired device, bypassing the DB trigger/push_jobs pipeline.
 * Fired inline from the valentine creation route so the companion widget
 * updates right away with the new valentine.
 */
export async function dispatchDirectValentinePushes(valentine: Valentine): Promise<void> {
  let fromName = 'Партнер';
  try {
    const pairData = await getPairById(valentine.pair_id);
    if (pairData) fromName = senderName(pairData, valentine.sender_telegram_id);
  } catch (error) {
    console.error('Direct push: failed to load pair', error);
  }

  let devices;
  try {
    devices = await getDevicesByPair(valentine.pair_id);
  } catch (error) {
    console.error('Direct push: failed to load devices', error);
    return;
  }

  const payload: PushPayload = {
    valentine_id: valentine.id,
    from_name: fromName,
    animation_type: valentine.animation_type,
    sent_at: valentine.sent_at,
    message: valentine.message || undefined,
    photo_url: valentine.photo_url || undefined,
  };

  for (const device of devices) {
    // The widget must update even when the user hasn't granted notification
    // permission: the data push (widget update) is processed regardless, only
    // the visible notification is suppressed by the OS. Skip only devices
    // without a real token.
    if (!device.push_token || device.push_token === 'pending') continue;
    try {
      const { visible, data } = await sendBothPushes(device.push_token, payload);
      if (visible.success || data.success) {
        await markValentineDelivered(valentine.id).catch(() => undefined);
        console.log(`Direct push sent to device ${device.id} (visible:${visible.success}, data:${data.success})`);
      } else {
        console.error(`Direct push failed for device ${device.id}`, { visible: visible.error, data: data.error });
      }
    } catch (error) {
      console.error(`Direct push error for device ${device.id}:`, error);
    }
  }
}