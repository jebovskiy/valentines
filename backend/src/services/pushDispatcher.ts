import { supabase } from '../utils/supabase';
import { sendBothPushes, PushPayload } from './fcm';
import { getDeviceById, getValentineById, updatePushJobStatus, markValentineDelivered } from './database';

export interface PushDispatchPayload {
  valentine_id: string;
  device_id: string;
  channel: 'visible' | 'data';
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

  if (!device.push_permission_granted) {
    console.log(`Push dispatch: permission not granted for device ${device_id}`);
    await updatePushJobStatus(device_id, 'failed', 1);
    return;
  }

  const pushPayload: PushPayload = {
    valentine_id: valentine.id,
    from_name: '', // Will be filled by sender name lookup if needed
    animation_type: valentine.animation_type,
    sent_at: valentine.sent_at,
  };

  // Get sender name (simplified - in reality you'd fetch from Telegram or store in valentines)
  // For now using a placeholder
  pushPayload.from_name = 'Партнер';

  try {
    if (channel === 'visible') {
      const result = await sendVisiblePush(device.push_token, pushPayload);
      await updatePushJobStatus(device_id, result.success ? 'sent' : 'failed', 1);
      if (result.success) await markValentineDelivered(valentine_id);
    } else {
      const result = await sendDataPush(device.push_token, pushPayload);
      await updatePushJobStatus(device_id, result.success ? 'sent' : 'failed', 1);
    }
  } catch (error) {
    console.error(`Push dispatch error:`, error);
    await updatePushJobStatus(device_id, 'failed', 1);
  }
}

async function sendVisiblePush(token: string, payload: PushPayload) {
  const { sendVisiblePush: send } = await import('./fcm');
  return send(token, payload);
}

async function sendDataPush(token: string, payload: PushPayload) {
  const { sendDataPush: send } = await import('./fcm');
  return send(token, payload);
}

export async function retryPendingPushJobs(): Promise<void> {
  const { getPendingPushJobs } = await import('./database');
  const jobs = await getPendingPushJobs();

  for (const job of jobs) {
    await dispatchPush({
      valentine_id: job.valentine_id,
      device_id: job.device_id,
      channel: job.channel,
    });
  }
}