import { sendVisiblePush, sendDataPush, sendBothPushes, sendGreetingDataPush, sendReminderPush, sendCustomDataPush, PushPayload } from './fcm';
import { getDeviceById, getValentineById, getPairById, getPushJob, updatePushJobStatus, markValentineDelivered, getPendingPushJobs, getDevicesByPair, getAllDevices, Valentine, Pair } from './database';

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

/**
 * Sends a reminder notification to all paired devices for the reminder's pair.
 * Called both inline (from the reminder route when reminder is created with a
 * past due time) and from the webhook dispatch (triggered by pg_cron).
 */
export async function dispatchReminderPushes(reminder: {
  id: string;
  pair_id: string;
  title: string;
  message: string | null;
}): Promise<void> {
  let devices;
  try {
    devices = await getDevicesByPair(reminder.pair_id);
  } catch (error) {
    console.error('Reminder push: failed to load devices', error);
    return;
  }

  for (const device of devices) {
    if (!device.push_token || device.push_token === 'pending') continue;
    if (!device.push_permission_granted) {
      console.log(`Reminder push: permission not granted for device ${device.id}`);
      continue;
    }
    try {
      const result = await sendReminderPush(device.push_token, {
        title: reminder.title,
        message: reminder.message,
      });
      console.log(`Reminder push sent to device ${device.id}: ${result.success}`);
    } catch (error) {
      console.error(`Reminder push error for device ${device.id}:`, error);
    }
  }
}

/** Sends a "couple event is coming up" push to all devices of the pair. */
export async function dispatchEventPushes(pairId: string, event: { name: string; event_date: string; remind_days_before: number }): Promise<void> {
  let devices;
  try {
    devices = await getDevicesByPair(pairId);
  } catch (error) {
    console.error('Event push: failed to load devices', error);
    return;
  }

  for (const device of devices) {
    if (!device.push_token || device.push_token === 'pending' || !device.push_permission_granted) continue;
    try {
      const result = await sendCustomDataPush(device.push_token, {
        event: 'event',
        name: event.name,
        event_date: event.event_date,
        remind_days_before: String(event.remind_days_before),
      });
      console.log(`Event push sent to device ${device.id}: ${result.success}`);
    } catch (error) {
      console.error(`Event push error for device ${device.id}:`, error);
    }
  }
}

/** Sends a "new note from partner" push to the recipient's devices. */
export async function dispatchNotePushes(
  pairId: string,
  excludeTelegramId: number,
  note: { content: string; category: string },
  authorName?: string | null,
): Promise<void> {
  let devices;
  try {
    devices = await getDevicesByPair(pairId);
  } catch (error) {
    console.error('Note push: failed to load devices', error);
    return;
  }

  for (const device of devices) {
    if (device.telegram_user_id === excludeTelegramId) continue;
    if (!device.push_token || device.push_token === 'pending' || !device.push_permission_granted) continue;
    try {
      const preview = note.content.length > 140 ? `${note.content.slice(0, 140)}…` : note.content;
      const result = await sendCustomDataPush(device.push_token, {
        event: 'note',
        category: note.category,
        content: preview,
        ...(authorName ? { from_name: authorName } : {}),
      });
      console.log(`Note push sent to device ${device.id}: ${result.success}`);
    } catch (error) {
      console.error(`Note push error for device ${device.id}:`, error);
    }
  }
}

/** Sends a "new streak milestone reached" push to all devices of the pair. */
export async function dispatchStreakPushes(pairId: string, count: number): Promise<void> {
  let devices;
  try {
    devices = await getDevicesByPair(pairId);
  } catch (error) {
    console.error('Streak push: failed to load devices', error);
    return;
  }

  for (const device of devices) {
    if (!device.push_token || device.push_token === 'pending' || !device.push_permission_granted) continue;
    try {
      const result = await sendCustomDataPush(device.push_token, {
        event: 'streak',
        count: String(count),
      });
      console.log(`Streak push sent to device ${device.id}: ${result.success}`);
    } catch (error) {
      console.error(`Streak push error for device ${device.id}:`, error);
    }
  }
}

/** Broadcasts a "new version available" push to every companion device. */
export async function broadcastUpdatePush(versionName: string): Promise<void> {
  let devices;
  try {
    devices = await getAllDevices();
  } catch (error) {
    console.error('Update broadcast: failed to load devices', error);
    return;
  }

  for (const device of devices) {
    if (!device.push_token || device.push_token === 'pending') continue;
    try {
      const result = await sendCustomDataPush(device.push_token, {
        event: 'update',
        version: versionName,
      });
      console.log(`Update push sent to device ${device.id}: ${result.success}`);
    } catch (error) {
      console.error(`Update push error for device ${device.id}:`, error);
    }
  }
}