import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getMessaging, Messaging } from 'firebase-admin/messaging';
import { config } from '../config';

let messagingInstance: Messaging | null = null;

function getMessagingInstance(): Messaging {
  if (!messagingInstance) {
    if (getApps().length === 0) {
      const serviceAccount = JSON.parse(config.FCM_SERVICE_ACCOUNT_JSON);
      initializeApp({ credential: cert(serviceAccount) });
    }
    messagingInstance = getMessaging();
  }
  return messagingInstance;
}

export interface PushPayload {
  valentine_id: string;
  from_name: string;
  animation_type: string;
  sent_at: string;
  message?: string;
  photo_url?: string;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Data-only valentine push. The Android app renders the notification locally
 * (see ValentinesMessagingService), so it pops up both in the foreground and
 * in the background without being suppressed by the OS.
 */
export async function sendVisiblePush(token: string, payload: PushPayload): Promise<SendResult> {
  try {
    const message = {
      token,
      data: {
        event: 'valentine',
        valentine_id: payload.valentine_id,
        from_name: payload.from_name,
        animation_type: payload.animation_type,
        sent_at: payload.sent_at,
        ...(payload.message !== undefined ? { message: payload.message } : {}),
        ...(payload.photo_url ? { photo_url: payload.photo_url } : {}),
      },
      android: {
        priority: 'high' as const,
      },
      apns: {
        payload: {
          aps: {
            'content-available': 1,
          },
        },
      },
    };

    const messageId = await getMessaging().send(message);
    return { success: true, messageId };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function sendDataPush(token: string, payload: PushPayload): Promise<SendResult> {
  try {
    const message = {
      token,
      data: {
        event: 'valentine',
        valentine_id: payload.valentine_id,
        from_name: payload.from_name,
        animation_type: payload.animation_type,
        sent_at: payload.sent_at,
        ...(payload.message !== undefined ? { message: payload.message } : {}),
        ...(payload.photo_url ? { photo_url: payload.photo_url } : {}),
      },
      android: {
        priority: 'high' as const,
      },
      apns: {
        payload: {
          aps: {
            'content-available': 1,
          },
        },
      },
    };

    const messageId = await getMessaging().send(message);
    return { success: true, messageId };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function sendGreetingDataPush(token: string, greeting: { type: string; from_name: string }): Promise<SendResult> {
  try {
    const message = {
      token,
      data: {
        event: 'greeting',
        greeting_type: greeting.type,
        from_name: greeting.from_name,
        type: 'data',
      },
      android: {
        priority: 'high' as const,
      },
      apns: {
        payload: {
          aps: {
            'content-available': 1,
          },
        },
      },
    };

    const messageId = await getMessaging().send(message);
    return { success: true, messageId };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function sendBothPushes(token: string, payload: PushPayload): Promise<{ visible: SendResult; data: SendResult }> {
  // Single data-only push — the Android app renders the popup locally, so one
  // message is enough (a visible+data pair would double-render on Android).
  const result = await sendDataPush(token, payload);
  return { visible: result, data: result };
}

export async function sendReminderPush(
  token: string,
  reminder: { title: string; message?: string | null }
): Promise<SendResult> {
  try {
    const message = {
      token,
      data: {
        event: 'reminder',
        title: reminder.title,
        message: reminder.message || '',
      },
      android: {
        priority: 'high' as const,
      },
      apns: {
        payload: {
          aps: {
            'content-available': 1,
          },
        },
      },
    };

    const messageId = await getMessaging().send(message);
    return { success: true, messageId };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}