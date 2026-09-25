import { config } from '../config';
import { resolveBotReply, type BotCommandReply } from './botCommands';

const TG_API = `https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}`;
export const BOT_USERNAME = 'pairvalentine_bot';

interface TgResponse {
  ok: boolean;
  description?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: {
    chat?: { id: number; type?: string };
    text?: string;
    from?: { id: number; first_name?: string; username?: string };
  };
}

async function tgCall<T>(method: string, body: Record<string, unknown>): Promise<TgResponse & T> {
  try {
    const response = await fetch(`${TG_API}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => ({}))) as TgResponse;
    if (!response.ok) {
      return { ok: false, description: data.description ?? `HTTP ${response.status}` } as TgResponse & T;
    }
    return { ok: true } as TgResponse & T;
  } catch (error) {
    console.error(`TBot ${method} failed:`, error);
    return { ok: false, description: 'network error' } as TgResponse & T;
  }
}

async function sendReply(chatId: number, reply: BotCommandReply): Promise<{ ok: boolean }> {
  // Telegram rejects web_app URLs longer than 64 characters, so the mini app
  // does its own routing instead of deep fragments.
  const body: Record<string, unknown> = { chat_id: chatId, text: reply.text };
  if (reply.buttons && reply.buttons.length > 0) {
    body.reply_markup = {
      inline_keyboard: reply.buttons.map((row) =>
        row.map((b) => ({ text: b.text, web_app: { url: `${config.MINI_APP_URL}${b.path}` } })),
      ),
    };
  }
  return tgCall('sendMessage', body);
}

export async function registerBot(publicUrl: string): Promise<void> {
  const webhookUrl = `${publicUrl.replace(/\/$/, '')}/telegram`;
  const setWebhook = await tgCall(`setWebhook`, {
    url: webhookUrl,
    secret_token: config.WEBHOOK_SHARED_SECRET,
    allowed_updates: ['message'],
  });
  if (!setWebhook.ok) {
    console.warn(`TBot setWebhook failed (${setWebhook.description}); commands won't arrive`);
    return;
  }
  const myCommands = await tgCall(`setMyCommands`, {
    commands: [
      { command: 'start', description: 'Приветствие' },
      { command: 'help', description: 'Все команды бота' },
      { command: 'valentine', description: 'Отправить валентинку' },
      { command: 'pairing', description: 'Подключить партнёра' },
      { command: 'profile', description: 'Мой профиль' },
      { command: 'streak', description: 'Серия дней пары' },
      { command: 'games', description: 'Игры для двоих' },
      { command: 'about', description: 'О боте' },
      { command: 'feedback', description: 'Идеи и баги' },
    ],
  });
  console.log(`TBot webhook → ${webhookUrl} (${setWebhook.ok ? 'ok' : setWebhook.description})`);
  if (!myCommands.ok) console.warn(`TBot setMyCommands failed (${myCommands.description})`);
}

export async function handleBotText(message: TelegramUpdate['message']): Promise<{ ok: boolean }> {
  if (!message?.text || !message.chat?.id) return { ok: false };
  // Only private chats — groups are out of scope.
  if (message.chat.type && message.chat.type !== 'private') return { ok: true };

  const raw = message.text.trim();
  if (!raw.startsWith('/')) return { ok: true };

  const reply = resolveBotReply(raw);
  return sendReply(message.chat.id, reply);
}