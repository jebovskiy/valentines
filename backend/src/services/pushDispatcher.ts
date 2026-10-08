import type { PushPayload } from './fcm';
import { sendVisiblePush, sendDataPush, sendBothPushes, sendGreetingDataPush, sendReminderPush, sendCustomDataPush } from './fcm';
import { getDeviceById, getValentineById, getPairById, getPushJob, updatePushJobStatus, markValentineDelivered, getPendingPushJobs, getDevicesByPair, getAllDevices } from './database';
import type { Valentine, Pair, GreetingType } from './database';

export interface PushDispatchPayload {
  valentine_id: string;
  device_id: string;
  channel: 'visible' | 'data';
}

/**
 * Sends never overlap beyond this: a fan-out used to await one device at a
 * time, so a broadcast opened a connection per device in series and one slow
 * answer held up everything queued behind it.
 */
const FANOUT_CONCURRENCY = 4;

async function fanOut<T>(items: readonly T[], task: (item: T) => Promise<void>): Promise<void> {
  const pending = [...items];
  const workers = Array.from({ length: Math.min(FANOUT_CONCURRENCY, pending.length) }, async () => {
    for (let item = pending.shift(); item !== undefined; item = pending.shift()) {
      await task(item);
    }
  });
  // Workers are not expected to reject (every caller handles its own errors),
  // but one shouldn't take the rest of the batch down with it if one does.
  const results = await Promise.allSettled(workers);
  for (const result of results) {
    if (result.status === 'rejected') console.error('Push fan-out worker failed:', result.reason);
  }
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
export async function dispatchGreetingPushes(pairId: string, senderTelegramId: number, greetingType: GreetingType): Promise<void> {
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

  await fanOut(devices, async (device) => {
    if (device.telegram_user_id === senderTelegramId) return;
    if (!device.push_token || device.push_token === 'pending') return;
    try {
      const result = await sendGreetingDataPush(device.push_token, { type: greetingType, from_name: fromName });
      console.log(`Greeting push sent to device ${device.id}: ${result.success}`);
    } catch (error) {
      console.error(`Greeting push error for device ${device.id}:`, error);
    }
  });
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

  // A single malformed job used to abort the whole retry pass; each one now
  // fails on its own.
  await fanOut(jobs, async (job) => {
    try {
      await dispatchPush({
        valentine_id: job.valentine_id,
        device_id: job.device_id,
        channel: job.channel,
      });
    } catch (error) {
      console.error(`Push retry failed for job ${job.valentine_id}/${job.device_id}/${job.channel}:`, error);
    }
  });
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

  await fanOut(devices, async (device) => {
    // The widget must update even when the user hasn't granted notification
    // permission: the data push (widget update) is processed regardless, only
    // the visible notification is suppressed by the OS. Skip only devices
    // without a real token.
    if (!device.push_token || device.push_token === 'pending') return;
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
  });
}

/**
 * Sends a reminder notification to all paired devices for the reminder's pair.
 * Returns true when at least one push was acknowledged, so callers can decide
 * whether the reminder was actually delivered (vs. left to retry).
 */
export async function dispatchReminderPushes(reminder: {
  id: string;
  pair_id: string;
  title: string;
  message: string | null;
}): Promise<boolean> {
  let devices;
  try {
    devices = await getDevicesByPair(reminder.pair_id);
  } catch (error) {
    console.error('Reminder push: failed to load devices', error);
    return false;
  }

  let delivered = false;
  await fanOut(devices, async (device) => {
    if (!device.push_token || device.push_token === 'pending') return;
    if (!device.push_permission_granted) {
      console.log(`Reminder push: permission not granted for device ${device.id}`);
      return;
    }
    try {
      const result = await sendReminderPush(device.push_token, {
        title: reminder.title,
        message: reminder.message,
      });
      console.log(`Reminder push sent to device ${device.id}: ${result.success}`);
      if (result.success) delivered = true;
    } catch (error) {
      console.error(`Reminder push error for device ${device.id}:`, error);
    }
  });
  return delivered;
}

/** Sends a "couple event is coming up" push to all devices of the pair. Returns true if any push was delivered. */
export async function dispatchEventPushes(pairId: string, event: { name: string; event_date: string; remind_days_before: number }): Promise<boolean> {
  let devices;
  try {
    devices = await getDevicesByPair(pairId);
  } catch (error) {
    console.error('Event push: failed to load devices', error);
    return false;
  }

  let delivered = false;
  await fanOut(devices, async (device) => {
    if (!device.push_token || device.push_token === 'pending' || !device.push_permission_granted) return;
    try {
      const result = await sendCustomDataPush(device.push_token, {
        event: 'event',
        name: event.name,
        event_date: event.event_date,
        remind_days_before: String(event.remind_days_before),
      });
      console.log(`Event push sent to device ${device.id}: ${result.success}`);
      if (result.success) delivered = true;
    } catch (error) {
      console.error(`Event push error for device ${device.id}:`, error);
    }
  });
  return delivered;
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

  await fanOut(devices, async (device) => {
    if (device.telegram_user_id === excludeTelegramId) return;
    if (!device.push_token || device.push_token === 'pending' || !device.push_permission_granted) return;
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
  });
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

  await fanOut(devices, async (device) => {
    if (!device.push_token || device.push_token === 'pending' || !device.push_permission_granted) return;
    try {
      const result = await sendCustomDataPush(device.push_token, {
        event: 'streak',
        count: String(count),
      });
      console.log(`Streak push sent to device ${device.id}: ${result.success}`);
    } catch (error) {
      console.error(`Streak push error for device ${device.id}:`, error);
    }
  });
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

  await fanOut(devices, async (device) => {
    if (!device.push_token || device.push_token === 'pending') return;
    try {
      const result = await sendCustomDataPush(device.push_token, {
        event: 'update',
        version: versionName,
      });
      console.log(`Update push sent to device ${device.id}: ${result.success}`);
    } catch (error) {
      console.error(`Update push error for device ${device.id}:`, error);
    }
  });
}

/** Sends a movie event push (added / watched / review / insight) to devices. */
export async function dispatchMoviePushes(
  pairId: string,
  excludeTelegramId: number | null,
  data: { event: string; title: string; message: string; movie_title?: string },
): Promise<void> {
  let devices;
  try {
    devices = await getDevicesByPair(pairId);
  } catch (error) {
    console.error('Movie push: failed to load devices', error);
    return;
  }

  await fanOut(devices, async (device) => {
    if (excludeTelegramId !== null && device.telegram_user_id === excludeTelegramId) return;
    if (!device.push_token || device.push_token === 'pending' || !device.push_permission_granted) return;
    try {
      const result = await sendCustomDataPush(device.push_token, {
        event: 'movie',
        kind: data.event,
        title: data.title,
        message: data.message,
        ...(data.movie_title ? { movie_title: data.movie_title } : {}),
      });
      console.log(`Movie push sent to device ${device.id}: ${result.success}`);
    } catch (error) {
      console.error(`Movie push error for device ${device.id}:`, error);
    }
  });
}
