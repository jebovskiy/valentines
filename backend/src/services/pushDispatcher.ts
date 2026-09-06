import { sendVisiblePush, sendDataPush, PushPayload } from './fcm';
import { getDeviceById, getValentineById, updatePushJobStatus, markValentineDelivered, getPendingPushJobs } from './database';

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
      const result = await sendVisiblePushToDevice(device.push_token, pushPayload);
      await updatePushJobStatus(device_id, result.success ? 'sent' : 'failed', 1);
      if (result.success) await markValentineDelivered(valentine_id);
    } else {
      const result = await sendDataPushToDevice(device.push_token, pushPayload);
      await updatePushJobStatus(device_id, result.success ? 'sent' : 'failed', 1);
    }
  } catch (error) {
    console.error(`Push dispatch error:`, error);
    await updatePushJobStatus(device_id, 'failed', 1);
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