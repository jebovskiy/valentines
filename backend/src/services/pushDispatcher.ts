import { sendVisiblePush, sendDataPush, PushPayload } from './fcm';
import { getDeviceById, getValentineById, getPairById, getPushJob, updatePushJobStatus, markValentineDelivered, getPendingPushJobs } from './database';

export interface PushDispatchPayload {
  valentine_id: string;
  device_id: string;
  channel: 'visible' | 'data';
}

function senderName(pair: { telegram_user_a: number; user_a_name: string | null; telegram_user_b: number; user_b_name: string | null }, senderTelegramId: number): string {
  if (pair.telegram_user_a === senderTelegramId) return pair.user_a_name || 'Партнер';
  return pair.user_b_name || 'Партнер';
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