import { config } from '../config';

const TG_API = `https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}`;
const BOT_USERNAME = 'pairvalentine_bot';

interface SendMessageResult {
  ok: boolean;
  description?: string;
}

export async function sendNewValentineNotification(
  chatId: number,
  valentineId: string,
  senderName: string | null,
): Promise<void> {
  const miniAppUrl = `${config.MINI_APP_URL}/v/${valentineId}`;
  const tMeStartApp = `https://t.me/${BOT_USERNAME}?startapp=v_${valentineId}`;

  const text = `💌 У вас новая валентинка${senderName ? ` от ${senderName}` : ''}! Откройте, чтобы узнать, что там.`;

  try {
    // Prefer a web_app inline button (opens mini app directly in Telegram).
    // Requires the bot to have its Mini App configured in BotFather.
    const webAppResult = await sendMessage({
      chat_id: chatId,
      text,
      reply_markup: {
        inline_keyboard: [[
          { text: 'Открыть валентинку', web_app: { url: miniAppUrl } },
        ]],
      },
    });
    if (!webAppResult.ok) {
      console.warn(`TG web_app button rejected (${webAppResult.description}), falling back to t.me link`);
      await sendMessage({
        chat_id: chatId,
        text,
        reply_markup: {
          inline_keyboard: [[
            { text: 'Открыть валентинку', url: tMeStartApp },
          ]],
        },
      });
    }
  } catch (error) {
    console.error(`sendNewValentineNotification failed:`, error);
  }
}

export async function sendReminderNotification(
  chatId: number,
  reminder: { title: string; message: string | null },
): Promise<void> {
  const miniAppUrl = `${config.MINI_APP_URL}/notes`;
  const text = `⏰ ${reminder.title}${reminder.message ? `\n\n${reminder.message}` : ''}`;
  await sendMessageWithButton(chatId, text, miniAppUrl, 'Открыть заметки');
}

export async function sendEventReminderNotification(
  chatId: number,
  event: { name: string; event_date: string; remind_days_before: number },
): Promise<void> {
  const miniAppUrl = `${config.MINI_APP_URL}/notes`;
  const dateLabel = new Date(`${event.event_date}T00:00:00`).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
  });
  const when =
    event.remind_days_before === 0
      ? 'Сегодня'
      : event.remind_days_before === 1
        ? 'Завтра'
        : `Через ${event.remind_days_before} дня`;
  const text = `📅 ${when}: ${event.name} — ${dateLabel}`;
  await sendMessageWithButton(chatId, text, miniAppUrl, 'Открыть события');
}

export async function sendNewNoteNotification(
  chatId: number,
  note: { content: string; category: string; author_name: string | null },
): Promise<void> {
  const miniAppUrl = `${config.MINI_APP_URL}/notes`;
  const author = note.author_name || 'Партнер';
  const preview = note.content.length > 200 ? `${note.content.slice(0, 200)}…` : note.content;
  const text = `📝 ${author} добавил(а) заметку:\n\n«${preview}»`;
  await sendMessageWithButton(chatId, text, miniAppUrl, 'Открыть заметки');
}

async function sendMessageWithButton(chatId: number, text: string, webUrl: string, buttonText: string): Promise<void> {
  try {
    const result = await sendMessage({
      chat_id: chatId,
      text,
      reply_markup: {
        inline_keyboard: [[{ text: buttonText, web_app: { url: webUrl } }]],
      },
    });
    if (!result.ok) {
      console.warn(`TG web_app button rejected (${result.description}), falling back to t.me link`);
      await sendMessage({
        chat_id: chatId,
        text,
        reply_markup: {
          inline_keyboard: [[{ text: buttonText, url: webUrl }]],
        },
      });
    }
  } catch (error) {
    console.error(`sendMessageWithButton failed:`, error);
  }
}

async function sendMessage(body: Record<string, unknown>): Promise<SendMessageResult> {
  const response = await fetch(`${TG_API}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = (await response.json().catch(() => ({}))) as SendMessageResult;
  if (!response.ok) {
    return { ok: false, description: data.description ?? `HTTP ${response.status}` };
  }
  return { ok: true };
}