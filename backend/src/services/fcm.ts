import { initializeApp, getApps, cert, messaging, Messaging } from 'firebase-admin';
import { config } from '../config';

let messagingInstance: Messaging | null = null;

function getMessaging(): Messaging {
  if (!messagingInstance) {
    if (getApps().length === 0) {
      const serviceAccount = JSON.parse(config.FCM_SERVICE_ACCOUNT_JSON);
      initializeApp({ credential: cert(serviceAccount) });
    }
    messagingInstance = messaging();
  }
  return messagingInstance;
}

export interface PushPayload {
  valentine_id: string;
  from_name: string;
  animation_type: string;
  sent_at: string;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendVisiblePush(token: string, payload: PushPayload): Promise<SendResult> {
  try {
    const message = {
      token,
      notification: {
        title: `Валентинка от ${payload.from_name}`,
        body: payload.message || 'Новая валентинка!',
      },
      data: {
        valentine_id: payload.valentine_id,
        from_name: payload.from_name,
        animation_type: payload.animation_type,
        sent_at: payload.sent_at,
        type: 'visible',
      },
      android: {
        priority: 'high' as const,
        notification: {
          channelId: 'valentines_channel',
          icon: 'ic_notification',
          color: '#E91E63',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
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
        valentine_id: payload.valentine_id,
        from_name: payload.from_name,
        animation_type: payload.animation_type,
        sent_at: payload.sent_at,
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
  const [visible, data] = await Promise.all([
    sendVisiblePush(token, payload),
    sendDataPush(token, payload),
  ]);
  return { visible, data };
}