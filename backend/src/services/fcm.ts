import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import type { Message, Messaging } from 'firebase-admin/messaging';
import { config } from '../config';

let messagingInstance: Messaging | null = null;

/**
 * The app is only ever initialized here, so this has to be the single entry
 * point for sends. Calling `getMessaging()` directly instead resolves the
 * *default* app, which never exists, and every send fails with
 * "The default Firebase app does not exist" — a failure the callers swallow
 * into `{ success: false }`, i.e. push notifications silently do nothing.
 */
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

// A per-attempt ceiling, so one hung connection cannot stall a dispatch loop
// for as long as the TCP stack feels like it.
const SEND_TIMEOUT_MS = 8_000;
// Overall budget for one message including retries: callers run fire-and-forget
// but the process still has to get back to the request queue.
const SEND_DEADLINE_MS = 15_000;
const MAX_ATTEMPTS = 3;
const RETRY_BASE_MS = 200;

/**
 * Codes FCM asks us to try again later. Anything else (bad token, invalid
 * format, payload too large) fails immediately — retrying it just burns the
 * deadline.
 */
const RETRYABLE_CODES = new Set([
  'messaging/internal-error',
  'messaging/server-unavailable',
  'messaging/unavailable',
  'messaging/quota-exceeded',
  'messaging/message-rate-exceeded',
  'messaging/device-message-rate-exceeded',
  'internal',
  'unavailable',
  '429',
]);

function errorCodes(error: unknown): string[] {
  if (!error || typeof error !== 'object') return [];
  const candidate = error as { code?: unknown; errorInfo?: { code?: unknown } };
  const codes: string[] = [];
  for (const value of [candidate.code, candidate.errorInfo?.code]) {
    if (typeof value === 'string' || typeof value === 'number') codes.push(String(value));
  }
  return codes;
}

function isRetryable(error: unknown): boolean {
  const codes = errorCodes(error);
  if (codes.some((code) => RETRYABLE_CODES.has(code) || RETRYABLE_CODES.has(code.toLowerCase()))) {
    return true;
  }
  // Our own deadline is worth another attempt while the budget lasts.
  return error instanceof Error && /timed out/i.test(error.message);
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`FCM send timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * One message, bounded: a per-attempt timeout inside an overall deadline, with
 * backoff for the codes FCM marks as transient. Previously a 429 from a burst
 * of sends was recorded as a permanent failure and never retried, and a hung
 * socket held the whole dispatch loop.
 */
async function sendWithRetry(message: Message): Promise<string> {
  const deadline = Date.now() + SEND_DEADLINE_MS;
  let lastError: unknown = new Error('FCM send failed');

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const budget = deadline - Date.now();
    if (budget <= 0) break;
    try {
      return await withTimeout(getMessagingInstance().send(message), Math.min(SEND_TIMEOUT_MS, budget));
    } catch (error) {
      lastError = error;
      if (attempt >= MAX_ATTEMPTS || !isRetryable(error)) break;
      const backoff = Math.min(RETRY_BASE_MS * 2 ** (attempt - 1), deadline - Date.now());
      if (backoff > 0) await sleep(backoff);
    }
  }

  throw lastError;
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

    const messageId = await sendWithRetry(message);
    return { success: true, messageId };
  } catch (error) {
    return { success: false, error: errorMessage(error) };
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

    const messageId = await sendWithRetry(message);
    return { success: true, messageId };
  } catch (error) {
    return { success: false, error: errorMessage(error) };
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

    const messageId = await sendWithRetry(message);
    return { success: true, messageId };
  } catch (error) {
    return { success: false, error: errorMessage(error) };
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

    const messageId = await sendWithRetry(message);
    return { success: true, messageId };
  } catch (error) {
    return { success: false, error: errorMessage(error) };
  }
}

/**
 * Generic data-only push for a custom companion event (update, streak, note,
 * event). The Android app switches on `event` and renders a local notification.
 */
export async function sendCustomDataPush(token: string, data: Record<string, string>): Promise<SendResult> {
  try {
    const message = {
      token,
      data,
      android: {
        priority: 'high' as const,
      },
      apns: {
        payload: {
          aps: { 'content-available': 1 },
        },
      },
    };
    const messageId = await sendWithRetry(message);
    return { success: true, messageId };
  } catch (error) {
    return { success: false, error: errorMessage(error) };
  }
}