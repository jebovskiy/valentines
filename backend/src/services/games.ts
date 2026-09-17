import { supabase } from '../utils/supabase';

export type GameId = 'KNOW_ME' | 'CHOOSE_ONE';
export type Mood = 'нежное' | 'веселое' | 'погорячее' | 'поговорить' | 'спокойное';

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
const KNOW_ME_WARMUP = [
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

const KNOW_ME_PERSONAL = [
  { text: 'Что тебя больше всего заводит во мне?', options: ['😄 Улыбка', '👀 Взгляд', '🗣️ Голос', '💪 Сила'] },
  { text: 'Какой мой поступок ты никогда не забудешь?', options: ['💖 Поддержка в трудную минуту', '🎉 Неожиданный сюрприз', '🤲 Жертва ради меня', '😊 Простая забота'] },
  { text: 'Что я делаю, что тебя бесит, но ты терпишь?', options: ['⏰ Опоздания', '📱 Постоянно в телефоне', '🍴 Беспечность в еде', '🗣️ Слишком много говорить'] },
  { text: 'Какой мой талант ты хотел бы развить вместе?', options: ['🎨 Рисование', '🎵 Музыка', '💻 Программирование', '🏃 Спорт'] },
  { text: 'Если бы мы могли жить где угодно, где бы ты выбрал?', options: ['🏡 Загородный дом', '🌃 Шумный город', '🌊 Морское побережье', '🏔️ Горные вершины'] },
{ text: 'Что бы ты изменил в наших отношениях?', options: ['💬 Больше откровенности', '🕒 Больше времени вместе', '😌 Меньше споров', '🤗 Больше нежности'] },
  { text: 'Какую нашу общую мечту ты хочешь осуществить первой?', options: ['🌍 Путешествие вокруг света', '🏠 Собственный дом', '👨‍👩‍👧‍👦 Большая семья', '💰 Финансовая независимость'] },
  { text: 'Как ты видишь наше будущее через 5 лет?', options: ['👨‍👩‍👧‍👦 С детьми', '🌍 Постоянные путешествия', '🏢 Карьерный рост', '🏡 Уютный дом'] },
];

const KNOW_ME_FINAL_TEXT = { text: 'Какой наш следующий момент ты бы хотел создать вместе?', options: [] }; // special case: free text

const CHOOSE_ONE_PAIRS = [
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

const CHOOSE_ONE_SURPRISE = [
  { text: 'Где бы ты хотел провести вечер: дома, в парке, в кафе или в кино?', options: ['🏠 Дом', '🌳 Парк', '☕ Кафе', '🎬 Кино'] },
  { text: 'Какой подарок ты бы предпочел: книга, украшение, совместный курс или сертификат на массаж?', options: ['📖 Книга', '💎 Украшение', '🎓 Курс', '💆 Массаж'] },
  { text: 'Какой тип отпуска тебе ближе: пляж, горы, город или круиз?', options: ['🏖️ Пляж', '🏔️ Горы', '🏙️ Город', '⛵ Круиз'] },
];

/**
 * Generate rounds for a game based on mood.
 * For MVP, we simply pick a fixed number of rounds from each category.
 * Mood influences the selection slightly: for KNOW_ME, more personal rounds when mood is romantic or talkative.
 */
function generateKnowMeRounds(mood: Mood | null): any[] {
  const warmupCount = 6;
  const personalCount = 3;
  const rounds: any[] = [];

  // Shuffle helper
  const shuffle = (array: any[]) => {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  };

  // Warmup: always take 6 random from warmup bank
  const warmupShuffled = shuffle([...KNOW_ME_WARMUP]);
  rounds.push(...warmupShuffled.slice(0, warmupCount).map(r => ({ ...r, category: 'warmup', type: 'choice' })));

  // Personal: adjust count based on mood
  let personalToTake = personalCount;
  if (mood === 'нежное' || mood === 'поговорить' || mood === 'погорячее') {
    personalToTake = Math.min(personalCount + 2, KNOW_ME_PERSONAL.length); // take a couple more if romantic/talkative
  }
  const personalShuffled = shuffle([...KNOW_ME_PERSONAL]);
  rounds.push(...personalShuffled.slice(0, personalToTake).map(r => ({ ...r, category: 'personal', type: 'choice' })));

  // Final text round (always one)
  rounds.push({ ...KNOW_ME_FINAL_TEXT, category: 'final', type: 'text' });

  // Shuffle the whole deck? We'll keep order: warmup, personal, final.
  return rounds;
}

function generateChooseOneRounds(mood: Mood | null): any[] {
  const binaryCount = 12;
  const surpriseCount = 3;
  const rounds: any[] = [];

  const shuffle = (array: any[]) => {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  };

  // Binary choice rounds
  const pairsShuffled = shuffle([...CHOOSE_ONE_PAIRS]);
  rounds.push(...pairsShuffled.slice(0, binaryCount).map(r => ({ ...r, category: 'binary', type: 'choice' })));

  // Surprise rounds (4 options)
  const surpriseToTake = mood === 'веселое' ? surpriseCount + 1 : surpriseCount; // a bit more surprise if playful
  const surpriseShuffled = shuffle([...CHOOSE_ONE_SURPRISE]);
  rounds.push(...surpriseShuffled.slice(0, Math.min(surpriseToTake, CHOOSE_ONE_SURPRISE.length)).map(r => ({ ...r, category: 'surprise', type: 'choice' })));

  return rounds;
}

export async function createGameSession(
  pairId: string,
  initiatorId: number,
  gameId: GameId,
  mood: Mood | null
): Promise<GameSessionRow> {
  let rounds: any[];
  switch (gameId) {
    case 'KNOW_ME':
      rounds = generateKnowMeRounds(mood);
      break;
    case 'CHOOSE_ONE':
      rounds = generateChooseOneRounds(mood);
      break;
    default:
      throw new Error(`Unknown game ID: ${gameId}`);
  }

  const session = await createGameSessionRow(pairId, initiatorId, gameId, mood, rounds);
  return session;
}
