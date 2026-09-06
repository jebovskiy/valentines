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