/**
 * Bot slash-command definitions. This module has NO I/O and no imports so
 * tests can assert on the exact reply wording without a runtime config.
 */

export interface BotCommandReply {
  text: string;
  /** Relative mini-app paths; the sender prefixes them with the public URL. */
  buttons?: { text: string; path: string }[][];
}

const OPEN = (text: string, path: string) => ({ text, path });

const COMMANDS: Record<string, BotCommandReply> = {
  start: {
    text:
      'Привет! 💌\n\nЭто бот пары: анимированные валентинки, заметки и напоминания, общие фильмы, игры, подбор свиданий и меню на неделю со списком покупок.\n\nВсё живёт в мини-приложении — нажмите кнопку ниже.\n\nПолный список команд: /help',
    buttons: [[OPEN('Открыть приложение', '/')]],
  },
  help: {
    text:
      'Доступные команды:\n\n' +
      '• /start — приветствие и запуск\n' +
      '• /valentine — отправить валентинку 💌\n' +
      '• /pairing — подключить партнёра 🔗\n' +
      '• /profile — мой профиль 👤\n' +
      '• /streak — серия дней пары 🔥\n' +
      '• /games — игры для двоих 🎮\n' +
      '• /about — о боте\n' +
      '• /feedback — идеи и баги\n' +
      '• /help — эта справка',
    buttons: [[OPEN('Открыть приложение', '/')]],
  },
  about: {
    text:
      'Valentine Bot — мини-приложение для пар в Telegram.\n\nЧто умеем:\n' +
      '💌 Анимированные валентинки\n' +
      '🔗 Общая пара по коду\n' +
      '📝 Заметки и напоминания\n' +
      '🎬 Общие фильмы и анализ вкусов\n' +
      '🗺 Подбор мест для свиданий\n' +
      '🎮 Игры для двоих\n' +
      '🛒 Меню на неделю + список покупок',
    buttons: [[OPEN('Открыть приложение', '/')]],
  },
  valentine: {
    text: 'Готовы удивить партнёра? Отправьте анимированную валентинку прямо сейчас! 💌',
    buttons: [[OPEN('Отправить валентинку', '/send')]],
  },
  pairing: {
    text: 'Подключите второго, чтобы валентинки, заметки, фильмы и меню были общими. 🔗',
    buttons: [[OPEN('Настроить пару', '/pairing')]],
  },
  profile: {
    text: 'Профиль и статистика пары — в приложении. 👤',
    buttons: [[OPEN('Открыть профиль', '/profile')]],
  },
  streak: {
    text: 'Серия дней пары и прогресс — смотрите в приложении. 🔥',
    buttons: [[OPEN('Открыть серию', '/streak')]],
  },
  games: {
    text: 'Игры для двоих: узнайте друг друга лучше и повеселитесь! 🎮',
    buttons: [[OPEN('Играть', '/games')]],
  },
  feedback: {
    text: 'Идеи, баги и пожелания: напишите нам в приложении или в этот чат — мы читаем. 🙏',
    buttons: [[OPEN('Открыть приложение', '/')]],
  },
};

const HELP_LINE = 'Не знаю такую команду. Список доступных: /help';

/** Normalise a raw command like `/start@pairvalentine_bot` or `start` to the bare name. */
export function stripCommand(raw: string): string {
  const command = raw.split('@')[0].trim();
  return command.startsWith('/') ? command.slice(1).toLowerCase() : command.toLowerCase();
}

/** Pure command → reply resolution (no I/O) so tests can assert the wording. */
export function resolveBotReply(raw: string): BotCommandReply {
  return COMMANDS[stripCommand(raw)] ?? { text: HELP_LINE };
}