import { supabase } from '../utils/supabase';
import { generateAiGameRounds, type AiGameRound } from './gemini';

export type GameId = 'KNOW_ME' | 'CHOOSE_ONE' | 'ASSOCIATIONS' | 'COMPLIMENTS' | 'SPEED_FACTS';
export type Mood = 'нежное' | 'веселое' | 'погорячее' | 'поговорить' | 'спокойное';

export interface PairNames {
  me: string;
  partner: string;
}

export interface GameAnswer {
  session_id: string;
  user_id: number;
  round_index: number;
  answer: string;
  created_at: string;
}

export interface GameSessionRow {
  id: string;
  pair_id: string;
  initiator_id: number;
  game_id: GameId;
  mood: Mood | null;
  rounds: any[]; // We'll keep as any for now; could be typed more precisely
  status: 'active' | 'done';
  created_at: string;
  updated_at: string;
  answers?: GameAnswer[];
}

const SESSION_SELECT = 'id, pair_id, initiator_id, game_id, mood, rounds, status, created_at, updated_at';

export async function getActiveGameSession(pairId: string): Promise<GameSessionRow | null> {
  const { data, error } = await supabase
    .from('game_sessions')
    .select(SESSION_SELECT)
    .eq('pair_id', pairId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return { ...data, answers: await getGameAnswers(data.id) } as GameSessionRow;
}

export async function getLatestGameSession(pairId: string): Promise<GameSessionRow | null> {
  const { data, error } = await supabase
    .from('game_sessions')
    .select(SESSION_SELECT)
    .eq('pair_id', pairId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return { ...data, answers: await getGameAnswers(data.id) } as GameSessionRow;
}

export async function getGameSessionById(sessionId: string): Promise<GameSessionRow | null> {
  const { data, error } = await supabase
    .from('game_sessions')
    .select(SESSION_SELECT)
    .eq('id', sessionId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return { ...data, answers: await getGameAnswers(data.id) } as GameSessionRow;
}

export async function getRecentGameSessions(pairId: string, limit = 3): Promise<{ id: string }[]> {
  const { data, error } = await supabase
    .from('game_sessions')
    .select('id')
    .eq('pair_id', pairId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map(row => ({ id: row.id }));
}

export async function deleteActiveGameSessions(pairId: string): Promise<void> {
  const { error } = await supabase
    .from('game_sessions')
    .delete()
    .eq('pair_id', pairId)
    .eq('status', 'active');
  if (error) throw error;
}

export async function createGameSessionRow(
  pairId: string,
  initiatorId: number,
  gameId: GameId,
  mood: Mood | null,
  rounds: any[]
): Promise<GameSessionRow> {
  const { data, error } = await supabase
    .from('game_sessions')
    .insert({ pair_id: pairId, initiator_id: initiatorId, game_id: gameId, mood, rounds })
    .select(SESSION_SELECT)
    .single();

  if (error) throw error;
  return data as GameSessionRow;
}

export async function upsertGameAnswer(
  sessionId: string,
  userId: number,
  roundIndex: number,
  answer: string
): Promise<void> {
  const { error } = await supabase.from('game_answers').upsert(
    [{ session_id: sessionId, user_id: userId, round_index: roundIndex, answer }],
    { onConflict: 'session_id,user_id,round_index' },
  );
  if (error) throw error;
}

export async function touchGameSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from('game_sessions')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', sessionId);
  if (error) throw error;
}

export async function finishGameSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from('game_sessions')
    .update({ status: 'done', updated_at: new Date().toISOString() })
    .eq('id', sessionId);
  if (error) throw error;
}

export async function getGameAnswers(sessionId: string): Promise<GameAnswer[]> {
  const { data, error } = await supabase
    .from('game_answers')
    .select('session_id, user_id, round_index, answer, created_at')
    .eq('session_id', sessionId);

  if (error) throw error;
  return (data ?? []) as GameAnswer[];
}

// Card banks

interface RawRound {
  text: string;
  options: string[];
}

const KNOW_ME_WARMUP: RawRound[] = [
  { text: 'Какой фильм ты бы посмотрел на нашем свидании?', options: ['🎬 Боевик', '😊 Комедия', '💔 Драма', '👻 Ужасы'] },
  { text: 'Какую музыку ты любишь слушать вместе?', options: ['🎶 Поп', '🎸 Рок', '🎹 Классика', '🥁 Электроника'] },
  { text: 'Какой твой идеальный выходной?', options: ['🏠 Домашний уют', '🚶 Прогулка на природе', '🏙️ Городские развлечения', '📚 Чтение книг'] },
  { text: 'Как ты предпочитаешь решать конфликты?', options: ['💬 Открытый диалог', '😶 Молчание и время', '🤝 Компромисс', '😡 Эмоции сначала'] },
  { text: 'Какой подарок ты оценил бы больше?', options: ['💝 Впечатления', '📖 Книга', '🌸 Цветы', '💎 Украшение'] },
  { text: 'Как ты относишься к сюрпризам?', options: ['🎁 Люблю', '🤔 Нужно предупреждать', '😐 Безразличен', '🙅 Не люблю'] },
  { text: 'Какой твой язык любви?', options: ['🤗 Объятия', '👌 Поддержка', '🎁 Подарки', '⏱️ Время вместе'] },
  { text: 'Как ты предпочитаешь начинать день?', options: ['☕ Кофе', '🏃 Зарядка', '📱 Соцсети', '😴 Подольше поспать'] },
  { text: 'Какое качество в партнере ты ценишь больше?', options: ['😊 Честность', '🤝 Надежность', '🔥 Страсть', '🧠 Интеллект'] },
  { text: 'Как ты относишься к планированию будущего?', options: ['📅 Люблю планировать', '🌪️ Живу моментом', '🤔 Иногда планирую', '🚫 Не планирую'] },
];

const KNOW_ME_PERSONAL: RawRound[] = [
  { text: 'Что тебя больше всего заводит во мне?', options: ['😄 Улыбка', '👀 Взгляд', '🗣️ Голос', '💪 Сила'] },
  { text: 'Какой мой поступок ты никогда не забудешь?', options: ['💖 Поддержка в трудную минуту', '🎉 Неожиданный сюрприз', '🤲 Жертва ради меня', '😊 Простая забота'] },
  { text: 'Что я делаю, что тебя бесит, но ты терпишь?', options: ['⏰ Опоздания', '📱 Постоянно в телефоне', '🍴 Беспечность в еде', '🗣️ Слишком много говорить'] },
  { text: 'Какой мой талант ты хотел бы развить вместе?', options: ['🎨 Рисование', '🎵 Музыка', '💻 Программирование', '🏃 Спорт'] },
  { text: 'Если бы мы могли жить где угодно, где бы ты выбрал?', options: ['🏡 Загородный дом', '🌃 Шумный город', '🌊 Морское побережье', '🏔️ Горные вершины'] },
  { text: 'Что бы ты изменил в наших отношениях?', options: ['💬 Больше откровенности', '🕒 Больше времени вместе', '😌 Меньше споров', '🤗 Больше нежности'] },
  { text: 'Какую нашу общую мечту ты хочешь осуществить первой?', options: ['🌍 Путешествие вокруг света', '🏠 Собственный дом', '👨‍👩‍👧‍👦 Большая семья', '💰 Финансовая независимость'] },
  { text: 'Как ты видишь наше будущее через 5 лет?', options: ['👨‍👩‍👧‍👦 С детьми', '🌍 Постоянные путешествия', '🏢 Карьерный рост', '🏡 Уютный дом'] },
];

const KNOW_ME_FINAL_TEXT: RawRound = { text: 'Какой наш следующий момент ты бы хотел создать вместе?', options: [] };

const CHOOSE_ONE_PAIRS: RawRound[] = [
  { text: 'Кофе или чай утром?', options: ['☕ Кофе', '🫖 Чай'] },
  { text: 'Фильм дома или в кинотеатре?', options: ['🏠 Дом', '🎬 Кинотеатр'] },
  { text: 'Планировать отпуск или импровизировать?', options: ['📅 Планировать', '🎲 Импровизировать'] },
  { text: 'Остаться дома или выйти в город?', options: ['🏠 Дом', '🏙️ Город'] },
  { text: 'Активный отдых или расслабление?', options: ['🏃 Активный', '🧘 Расслабление'] },
  { text: 'Сладкое или соленое?', options: ['🍰 Сладкое', '🥒 Соленое'] },
  { text: 'Сериал или документалка?', options: ['📺 Сериал', '📄 Документалка'] },
  { text: 'Идти привычным маршрутом или новым?', options: ['🛤️ Новый путь', '🛣️ Привычный путь'] },
  { text: 'Планировать бюджет или тратить свободно?', options: ['💰 Бюджет', '💳 Свободно'] },
  { text: 'Готовить вместе или заказывать еду?', options: ['👨‍🍳 Готовить', '📞 Заказ'] },
  { text: 'Шумная вечеринка или тихий вечер?', options: ['🎉 Вечеринка', '🕯️ Тихий вечер'] },
  { text: 'Подарок ручной работы или купленный?', options: ['🎨 Ручной работы', '🛒 Купленный'] },
];

const CHOOSE_ONE_SURPRISE: RawRound[] = [
  { text: 'Где бы ты хотел провести вечер: дома, в парке, в кафе или в кино?', options: ['🏠 Дом', '🌳 Парк', '☕ Кафе', '🎬 Кино'] },
  { text: 'Какой подарок ты бы предпочел: книга, украшение, совместный курс или сертификат на массаж?', options: ['📖 Книга', '💎 Украшение', '🎓 Курс', '💆 Массаж'] },
  { text: 'Какой тип отпуска тебе ближе: пляж, горы, город или круиз?', options: ['🏖️ Пляж', '🏔️ Горы', '🏙️ Город', '⛵ Круиз'] },
];

const ASSOCIATIONS_WORDS: Record<Mood, string[]> = {
  нежное: ['Обнимашки', 'Закат', 'Утро', 'Плед', 'Кот', 'Поцелуй', 'Свечи', 'Счастье'],
  веселое: ['Пикник', 'Танцы', 'Смех', 'Караоке', 'Друзья', 'Игры', 'Мороженое', 'Лето'],
  погорячее: ['Шёпот', 'Сердце', 'Танец в темноте', 'Шёлк', 'Огонь', 'Магнит', 'Жара', 'Полночь'],
  поговорить: ['Разговор', 'Глаза', 'Правда', 'Звёзды', 'Молчание', 'Дружба', 'Душа', 'Время'],
  спокойное: ['Чай', 'Дождь', 'Книга', 'Одеяло', 'Луна', 'Лес', 'Музыка', 'Сон'],
};

const COMPLIMENTS_BANK: Record<Mood, string[]> = {
  нежное: [
    'Скажи, за что ты меня любишь?',
    'Расскажи, что во мне тебе нравится больше всего?',
    'Какой мой поступок ты запомнил навсегда?',
    'Какая моя черта для тебя самая дорогая?',
    'Что делает наши моменты вместе особенными?',
    'Каким ты меня видишь со стороны?',
  ],
  веселое: [
    'Расскажи, какая моя привычка тебя смешит?',
    'Что я делаю, чтобы ты улыбался?',
    'Какой наш самый смешной момент ты вспоминаешь?',
    'За что ты меня ценишь даже в плохие дни?',
    'Какой мой талант тебя удивляет?',
    'Что бы ты назвал самым лучшим во мне?',
  ],
  погорячее: [
    'Расскажи, что во мне тебя заводит?',
    'Какой мой взгляд ты запомнил?',
    'Когда я кажусь тебе самым притягательным?',
    'Что я делаю, что ты не можешь забыть?',
    'Что бы ты прошептал мне на ухо?',
    'Какая часть меня для тебя самая притягательная?',
  ],
  поговорить: [
    'Что ты ценишь в наших разговорах?',
    'Каким ты видишь меня искренним?',
    'Что меня по-настоящему красит?',
    'За что ты мне благодарен?',
    'Какую мою мысль ты любишь больше всего?',
    'В чём я для тебя самый близкий человек?',
  ],
  спокойное: [
    'Что тебе нравится в наших тихих вечерах?',
    'Чем я успокаиваю тебя?',
    'Что ты любишь во мне, когда мы просто рядом?',
    'Какая моя привычка тебя умиляет?',
    'Что для тебя значит мой голос?',
    'За что ты меня обнимаешь?',
  ],
};

const SPEED_FACTS_BANK: Record<Mood, string[]> = {
  нежное: [
    'Мы пропускаем мелкие ссоры мимо ушей',
    'Мы планируем общее будущее',
    'Мы каждый день говорим друг другу приятное',
    'Мы умеем мириться за один вечер',
    'Наша любовь становится крепче с каждым месяцем',
    'Мы делимся всем, что чувствуем',
    'Мы вместе встречаем рассвет',
    'Мы знаем, что мы — навсегда',
  ],
  веселое: [
    'Мы выбрали бы одинаковый фильм на вечер',
    'Мы одинаково шутим',
    'Мы бы выиграли в «Крокодила»',
    'Мы бы вместе спели в караоке',
    'Мы готовим лучше любого ресторана',
    'Мы ни разу не скучали вместе',
    'Мы знаем, кто из нас громче смеётся',
    'Мы умеем веселиться даже в дождь',
  ],
  погорячее: [
    'Мы не можем усидеть рядом друг с другом',
    'Наш вечер заканчивается страстью',
    'Мы целуемся с закрытыми глазами',
    'Первый взгляд утром — самый тёплый',
    'Мы знаем, как соблазнить друг друга',
    'Наша химия сильнее обид',
    'Мы любим держаться за руки под столом',
    'Мы не боимся мечтать о ночи вдвоём',
  ],
  поговорить: [
    'Мы говорим на одном языке',
    'Мы умеем слушать друг друга',
    'Мы обсуждаем всё, что важно',
    'Мы не боимся тишины вместе',
    'Мы знаем, о чём думаем друг о друге',
    'Мы делимся секретами без страха',
    'Мы всегда приходим к общему мнению',
    'Наши разговоры — лучшее время суток',
  ],
  спокойное: [
    'Мы любим одинаковый кофе',
    'Мы читаем одни и те же книги',
    'Мы смотрим сериалы, не торопясь',
    'Мы любим тихие вечера',
    'Мы засыпаем в одно время',
    'Мы слушаем одну и ту же музыку',
    'Мы гуляем неспешно',
    'Мы отдыхаем лучше всего вместе',
  ],
};

function shuffle<T>(array: T[]): T[] {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Fallback static bank of raw rounds for a game. Used when AI generation
 * fails or is disabled. Decorate afterwards with decorateRounds().
 */
function buildStaticRounds(gameId: GameId, mood: Mood | null): RawRound[] {
  switch (gameId) {
    case 'KNOW_ME': {
      const rounds: RawRound[] = [];
      rounds.push(...shuffle(KNOW_ME_WARMUP).slice(0, 6));
      const personalToTake = mood === 'нежное' || mood === 'поговорить' || mood === 'погорячее'
        ? Math.min(5, KNOW_ME_PERSONAL.length)
        : 3;
      rounds.push(...shuffle(KNOW_ME_PERSONAL).slice(0, personalToTake));
      rounds.push(KNOW_ME_FINAL_TEXT);
      return rounds;
    }
    case 'CHOOSE_ONE': {
      const rounds: RawRound[] = [];
      rounds.push(...shuffle(CHOOSE_ONE_PAIRS).slice(0, 12));
      const surpriseToTake = mood === 'веселое' ? 4 : 3;
      rounds.push(...shuffle(CHOOSE_ONE_SURPRISE).slice(0, Math.min(surpriseToTake, CHOOSE_ONE_SURPRISE.length)));
      return rounds;
    }
    case 'ASSOCIATIONS': {
      const words = ASSOCIATIONS_WORDS[mood ?? 'нежное'];
      return shuffle(words).map((text) => ({ text, options: [] }));
    }
    case 'COMPLIMENTS': {
      const prompts = COMPLIMENTS_BANK[mood ?? 'нежное'];
      return shuffle(prompts).map((text) => ({ text, options: [] }));
    }
    case 'SPEED_FACTS': {
      const facts = SPEED_FACTS_BANK[mood ?? 'нежное'];
      return shuffle(facts).map((text) => ({ text, options: ['✅ Да', '❌ Нет'] }));
    }
    default:
      return [];
  }
}

/**
 * Attach client-facing metadata (type/category) to raw rounds produced by
 * either the AI generator or the static banks, so the miniapp can render
 * labels and the final card correctly.
 */
function decorateRounds(gameId: GameId, raw: RawRound[]): any[] {
  return raw.map((r, i) => {
    switch (gameId) {
      case 'KNOW_ME': {
        const isLast = i === raw.length - 1;
        return {
          ...r,
          type: isLast ? 'text' : 'choice',
          category: isLast ? 'final' : i < 6 ? 'warmup' : 'personal',
          options: isLast ? [] : r.options,
        };
      }
      case 'CHOOSE_ONE':
        return { ...r, type: 'choice', category: r.options.length >= 3 ? 'surprise' : 'binary' };
      case 'ASSOCIATIONS':
        return { ...r, type: 'text', category: 'association', options: [] };
      case 'COMPLIMENTS':
        return { ...r, type: 'text', category: 'compliment', options: [] };
      case 'SPEED_FACTS':
        return { ...r, type: 'choice', category: 'fact', options: ['✅ Да', '❌ Нет'] };
      default:
        return { ...r, type: 'choice' };
    }
  });
}

export async function createGameSession(
  pairId: string,
  initiatorId: number,
  gameId: GameId,
  mood: Mood | null,
  names?: PairNames
): Promise<GameSessionRow> {
  let raw: RawRound[] | null = null;
  if (names) {
    raw = await generateAiGameRounds({ gameId, mood, names });
  }
  if (!raw) {
    raw = buildStaticRounds(gameId, mood);
  }

  const rounds = decorateRounds(gameId, raw);
  const session = await createGameSessionRow(pairId, initiatorId, gameId, mood, rounds);
  return session;
}
