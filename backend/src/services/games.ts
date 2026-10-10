import { supabase } from '../utils/supabase';
import { generateAiGameRounds } from './gemini';

export type GameId = 'KNOW_ME' | 'CHOOSE_ONE' | 'ASSOCIATIONS' | 'COMPLIMENTS' | 'SPEED_FACTS' | 'TRUTH_DARE';
export type Mood = 'нежное' | 'веселое' | 'погорячее' | 'погорячее 18+' | 'поговорить' | 'спокойное';

export const HOT_MOOD = 'погорячее 18+';
type PlainMood = Exclude<Mood, typeof HOT_MOOD>;

export type HotLevel = 'flirt' | 'warm' | 'bold' | 'wild';
export const HOT_LEVEL_ORDER: HotLevel[] = ['flirt', 'warm', 'bold', 'wild'];
export const DEFAULT_HOT_LEVEL: HotLevel = 'warm';

export function isHotLevel(value: unknown): value is HotLevel {
  return HOT_LEVEL_ORDER.includes(value as HotLevel);
}

export function minHotLevel(a: HotLevel, b: HotLevel): HotLevel {
  const idxA = HOT_LEVEL_ORDER.indexOf(a);
  const idxB = HOT_LEVEL_ORDER.indexOf(b);
  return idxA <= idxB ? a : b;
}

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
  rounds: GameRound[];
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
  return { ...data, answers: await getGameAnswers(data.id as string) } as GameSessionRow;
}

export async function getGameSessionById(sessionId: string): Promise<GameSessionRow | null> {
  const { data, error } = await supabase
    .from('game_sessions')
    .select(SESSION_SELECT)
    .eq('id', sessionId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return { ...data, answers: await getGameAnswers(data.id as string) } as GameSessionRow;
}

export async function getRecentGameSessions(pairId: string, limit = 3): Promise<{ id: string }[]> {
  const { data, error } = await supabase
    .from('game_sessions')
    .select('id')
    .eq('pair_id', pairId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map(row => ({ id: row.id as string }));
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
  rounds: GameRound[],
  heatLevelUsed?: HotLevel
): Promise<GameSessionRow> {
  const { data, error } = await supabase
    .from('game_sessions')
    .insert({ pair_id: pairId, initiator_id: initiatorId, game_id: gameId, mood, rounds, heat_level_used: heatLevelUsed })
    .select(SESSION_SELECT + ', heat_level_used, expires_at')
    .single();

  if (error) throw error;
  if (!data) throw new Error('Failed to create game session row');
  return data as unknown as GameSessionRow;
}

export async function upsertGameAnswer(
  sessionId: string,
  userId: number,
  roundIndex: number,
  answer: string
): Promise<void> {
  // Check if session is 18+ mood to decide encryption
  const { data: session, error: sessionErr } = await supabase
    .from('game_sessions')
    .select('mood')
    .eq('id', sessionId)
    .maybeSingle();

  if (sessionErr) throw sessionErr;
  const isHot18 = session?.mood === HOT_MOOD;

  const payload: Record<string, unknown> = {
    session_id: sessionId,
    user_id: userId,
    round_index: roundIndex,
  };

  if (isHot18) {
    // Encrypt with pgcrypto using a key derived from session_id + user_id
    // The key is not stored; only the encrypted blob is saved.
    // For decryption, the backend would need the same key derivation.
    // Here we use a simple approach: encrypt with session_id as key (not production-grade, but meets TTL requirement).
    // In production, use a proper key management system.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { data: encData, error: encError } = await supabase.rpc('encrypt_answer', {
      p_answer: answer,
      p_session_id: sessionId,
      p_user_id: userId,
    });
    if (encError) throw encError;
    payload.encrypted_answer = encData;
    payload.answer = null;
  } else {
    payload.answer = answer;
    payload.encrypted_answer = null;
  }

  const { error } = await supabase.from('game_answers').upsert(
    [payload],
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
  truth?: string;
  dare?: string;
  /** Alternative variant for the partner, so both never get the same prompt. */
  truthB?: string;
  dareB?: string;
}

/** RawRound plus the client-facing metadata added by decorateRounds. */
export interface GameRound extends RawRound {
  type: 'text' | 'choice' | 'truth_dare';
  category?: string;
  /** Second variant for the partner in TRUTH_DARE (AI: truth2/dare2, fallback: same as truth/dare). */
  truthB?: string;
  dareB?: string;
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

const ASSOCIATIONS_WORDS: Record<PlainMood, string[]> = {
  нежное: ['Обнимашки', 'Закат', 'Утро', 'Плед', 'Кот', 'Поцелуй', 'Свечи', 'Счастье'],
  веселое: ['Пикник', 'Танцы', 'Смех', 'Караоке', 'Друзья', 'Игры', 'Мороженое', 'Лето'],
  погорячее: ['Шёпот', 'Сердце', 'Танец в темноте', 'Шёлк', 'Огонь', 'Магнит', 'Жара', 'Полночь'],
  поговорить: ['Разговор', 'Глаза', 'Правда', 'Звёзды', 'Молчание', 'Дружба', 'Душа', 'Время'],
  спокойное: ['Чай', 'Дождь', 'Книга', 'Одеяло', 'Луна', 'Лес', 'Музыка', 'Сон'],
};

const COMPLIMENTS_BANK: Record<PlainMood, string[]> = {
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
    'Расскажи, что во меня тебя заводит?',
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

const SPEED_FACTS_BANK: Record<PlainMood, string[]> = {
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

const TRUTH_DARE_BANK: Record<PlainMood, { truth: string; truthB: string; dare: string; dareB: string }[]> = {
  нежное: [
    { truth: 'Что из того, как я забочусь о тебе, ты ценишь больше всего?', truthB: 'Когда ты чувствуешь мою любовь сильнее всего?', dare: 'Обнимите друг друга и помолчите 20 секунд.', dareB: 'Погладьте партнёра по волосам одну минуту.' },
    { truth: 'Какой наш совместный вечер ты вспоминаешь теплее всего?', truthB: 'Что из наших маленьких ритуалов тебе ближе всего?', dare: 'Прошепчите партнёру на ухо слова благодарности за этот день.', dareB: 'Сделайте партнёру три нежных поцелуя в любые места.' },
    { truth: 'Что я говорю или делаю, от чего тебе становится спокойнее?', truthB: 'Какая моя фраза согревает тебя до сих пор?', dare: 'Сделайте партнёру комплимент и поцелуйте в щёку.', dareB: 'Назовите партнёра самым ласковым словом, какое придумаете.' },
    { truth: 'По каким моим поступкам ты понимаешь, что я тебя люблю, без слов?', truthB: 'Что я делаю, что делает тебя счастливее всего?', dare: 'Расскажите партнёру о самом тёплом воспоминании из детства.', dareB: 'Обнимите партнёра так, как обнимали бы после долгой разлуки.' },
    { truth: 'Какой мой маленький поступок для тебя самый дорогой?', truthB: 'За какую мою мелочь ты благодарен каждый день?', dare: 'Возьмите партнёра за руку и проведите вместе минуту тишины.', dareB: 'Нарисуйте сердечко на ладони партнёра.' },
    { truth: 'Какое чувство в наших отношениях ты хотел бы укреплять чаще?', truthB: 'Какой момент с тобой мне хотелось бы пережить снова?', dare: 'Скажите партнёру три причины, почему вам хорошо вместе.', dareB: 'Посмотрите партнёру в глаза и улыбнитесь 30 секунд.' },
  ],
  веселое: [
    { truth: 'Какая моя привычка смешит тебя сильнее всего?', truthB: 'Что я делаю, от чего ты смеёшься каждый раз?', dare: 'Покажите партнёру ваш лучший смешной танец 30 секунд.', dareB: 'Изобразите кота, который просит еду.' },
    { truth: 'Какая наша фраза стала внутренним мемом пары?', truthB: 'Какое наше видео или фото ты пересматриваешь и смеёшься?', dare: 'Изобразите партнёра без слов — пусть угадает, что вы показываете.', dareB: 'Расскажите анекдот, от которого смеётесь только вы.' },
    { truth: 'Если бы у нас был караоке-батл, какую песню ты бы выбрал?', truthB: 'Какая наша песня заставит тебя танцевать где угодно?', dare: 'Спойте строчку песни, которая у вас обоих связана с весёлым днём.', dareB: 'Спойте колыбельную в стиле рок.' },
    { truth: 'Какой наш случай ты пересказывал друзьям как самый смешной?', truthB: 'Что мы делали вместе, от чего вы падали со смеху?', dare: 'Расскажите историю так, чтобы партнёр точно засмеялся.', dareB: 'Расскажите серьёзным голосом самую глупую вещь.' },
    { truth: 'Что мы делаем вместе, от чего оба хохочете до слёз?', truthB: 'Какая моя фраза всегда вызывает у тебя смех?', dare: 'Сделайте партнёру смешное фото на телефон.', dareB: 'Сфотографируйте партнёра с забавным фильтром.' },
    { truth: 'Какой был наш самый нелепый спор?', truthB: 'О чём мы спорили, а потом не могли вспомнить зачем?', dare: 'Придумайте партнёру смешное прозвище на этот вечер.', dareB: 'Переименуйте партнёра в контактах на шуточное имя.' },
  ],
  погорячее: [
    { truth: 'Что во мне сильнее всего тебя притягивает?', truthB: 'Какая моя черта характера заводит тебя больше всего?', dare: 'Проведите пальцем по руке партнёра от запястья до плеча.', dareB: 'Проведите губами по уху партнёра, не касаясь.' },
    { truth: 'В какой момент ты чувствуешь ко мне самое сильное притяжение?', truthB: 'Когда я кажусь тебе самым желанным?', dare: 'Поцелуйте партнёра в шею.', dareB: 'Поцелуйте партнёра в уголок губ.' },
    { truth: 'Какой мой взгляд ты вспоминаешь надолго?', truthB: 'Какой мой образ ты не можешь выбросить из головы?', dare: 'Прошепчите партнёру на ухо то, что скажете только ему.', dareB: 'Прошепчите партнёру на ухо ваш самый смелый комплимент.' },
    { truth: 'О чём тебе сейчас хочется меня попросить?', truthB: 'Что я могу сделать, чтобы ты растаял прямо сейчас?', dare: 'Обнимите партнёра со спины и задержитесь так на 15 секунд.', dareB: 'Притяните партнёра к себе и задержите на 20 секунд.' },
    { truth: 'Какая деталь моей внешности тебя заводит?', truthB: 'На что во мне ты смотришь чаще всего?', dare: 'Смотрите на партнёра 10 секунд, не отворачиваясь.', dareB: 'Медленно проведите рукой по лицу партнёра.' },
    { truth: 'Что в нашей близости ты хотел бы попробовать впервые?', truthB: 'О чём из наших фантазий ты мечтаешь чаще всего?', dare: 'Поцелуйте партнёра так, как целовали бы украдкой.', dareB: 'Поцелуйте партнёра долгим поцелуем, как в кино.' },
  ],
  поговорить: [
    { truth: 'О чём тебе трудно мне рассказывать и почему?', truthB: 'Что ты боишься мне признаться?', dare: 'Поделитесь с партнёром мечтой, о которой никому не говорили.', dareB: 'Расскажите партнёру о самом большом страхе.' },
    { truth: 'Что для тебя важнее — быть правым или быть услышанным?', truthB: 'Когда ты чувствуешь себя максимально понятым?', dare: 'Задайте партнёру вопрос, ответ на который давно хотели узнать.', dareB: 'Попросите партнёра рассказать о самом ярком воспоминании детства.' },
    { truth: 'Какое моё качество ты замечаешь только во время ссор?', truthB: 'Что я делаю в конфликте, от чего ты таешь?', dare: 'Расскажите о человеке, который повлиял на вас сильнее всего.', dareB: 'Назовите три вещи, за которые вы благодарны партнёру.' },
    { truth: 'Что ты чувствуешь, когда я молчу?', truthB: 'О чём ты думаешь, когда я молчу рядом?', dare: 'Поделитесь тем, за что вы благодарны партнёру за последний год.', dareB: 'Скажите партнёру, что вам в нём нравится больше всего.' },
    { truth: 'Как ты менялся за годы наших отношений?', truthB: 'Кем ты стал рядом со мной?', dare: 'Спросите партнёра: «Что я мог бы делать лучше для нас?»', dareB: 'Спросите партнёра: «Что я могу дать тебе, чего не даю?»' },
    { truth: 'Какую правду о себе ты ещё никому не рассказывал?', truthB: 'Что ты скрываешь даже от себя?', dare: 'Поделитесь с партнёром одним секретом о своих чувствах.', dareB: 'Признайтесь партнёру в чём-то, что откладывали.' },
  ],
  спокойное: [
    { truth: 'Какой наш самый тихий и уютный момент ты помнишь?', truthB: 'Какой вечер с тобой был самым спокойным?', dare: 'Сделайте партнёру тёплый напиток или укройте пледом.', dareB: 'Устройте партнёру уютное место рядом с собой.' },
    { truth: 'Как для тебя выглядит идеальный вечер вдвоём?', truthB: 'Что делает вечер с тобой идеальным?', dare: 'Посидите рядом, держась за руки, целую минуту.', dareB: 'Положите голову на плечо партнёра на пять минут.' },
    { truth: 'Какая моя привычка тебя успокаивает?', truthB: 'Что я делаю, от чего тебе становится тепло?', dare: 'Напишите партнёру короткую записку с тёплыми словами.', dareB: 'Нарисуйте партнёру маленькое сердечко на запястье.' },
    { truth: 'Что ты почувствовал, когда мы впервые остались наедине?', truthB: 'О чём ты подумал в нашу первую ночь рядом?', dare: 'Прочитайте партнёру вслух любимые строки из книги или стих.', dareB: 'Пропойте партнёру строчку любимой песни.' },
    { truth: 'Какая музыка делает наши вечера особенными?', truthB: 'Какая песня напоминает тебе обо мне?', dare: 'Включите песню, связанную со спокойствием, и обнимитесь.', dareB: 'Найдите у партнёра самое уютное место для объятий.' },
    { truth: 'О чём ты думаешь, когда мы просто лежим и молчим?', truthB: 'Что происходит у тебя внутри, когда мы молчим вместе?', dare: 'Помассируйте партнёру плечи пару минут.', dareB: 'Сделайте партнёру лёгкий массаж головы минуту.' },
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

type LeveledBank<T> = Record<HotLevel, T[]>;

// Формулировки без привязки к роду. Любой вопрос и действие можно пропустить.

const HOT_BOUNDARY_OPENER = 'Что мне важно знать о твоих границах, чтобы тебе было спокойно?';

const ASSOCIATIONS_HOT: LeveledBank<string> = {
  flirt: ['Шёпот', 'Взгляд', 'Искра', 'Мурашки', 'Касание', 'Духи', 'Румянец', 'Томность'],
  warm: ['Шёлк', 'Губы', 'Жара', 'Полночь', 'Дыхание', 'Ключица', 'Дрожь', 'Магнит'],
  bold: ['Кожа', 'Пульс', 'Горячий душ', 'Тёмная комната', 'Нетерпение', 'Запретное', 'Поцелуи до утра', 'Объятия без слов'],
  wild: ['Повязка на глазах', 'Шёлковый шарф', 'Игра без правил', 'Передать контроль', 'Страсть', 'Ненасытность', 'Запретный плод', 'Стоп-слово'],
};

const COMPLIMENTS_HOT: LeveledBank<string> = {
  flirt: [
    'Что в моём взгляде или улыбке цепляет тебя сильнее всего?',
    'Где тебе больше всего нравится, когда я касаюсь тебя?',
    'Какие слова тебе приятнее всего слышать от меня шёпотом?',
    'О чём ты вспоминаешь, когда думаешь о нашем самом долгом поцелуе?',
    'Какое моё сообщение заставило тебя улыбаться весь день?',
    'Какой момент нашего свидания тебе хочется повторить сегодня?',
  ],
  warm: [
    'Расскажи, что во мне сводит тебя с ума?',
    'Какое моё прикосновение ты никогда не забудешь?',
    'Где тебе хочется поцелуев дольше всего?',
    'Что в моём прикосновении заводит тебя быстрее всего?',
    'Что в наших ночах тебе нравится больше всего?',
    'Какой мой образ тебе нравится больше всего: в одежде, без неё или где-то посередине?',
    'Какая обстановка для близости кажется тебе самой притягательной: ночь, душ, утро или что-то другое?',
    'Какой момент нашей близости ты чаще всего прокручиваешь в голове?',
  ],
  bold: [
    'О чём из нашей близости ты мечтаешь чаще всего?',
    'Чего тебе хочется между нами, о чём мы ещё не говорили?',
    'Что мне стоит делать медленнее, а что смелее?',
    'Какая фантазия возвращается к тебе снова и снова?',
    'Какой мой образ в твоих фантазиях самый яркий?',
    'Что возбуждает тебя ещё до того, как мы остаёмся вдвоём?',
    'Какие слова во время близости действуют на тебя сильнее всего?',
    'Что тебе нужно, чтобы расслабиться и отпустить контроль?',
  ],
  wild: [
    'Какую самую смелую фантазию с нашим участием тебе трудно рассказать вслух?',
    'Какая ролевая игра могла бы тебя по-настоящему зажечь?',
    'Кто должен вести этой ночью: ты, я или по очереди?',
    'Что из увиденного или прочитанного тебе хотелось бы попробовать со мной?',
    'Придумай сценарий нашего вечера из трёх шагов, а я добавлю четвёртый.',
    'Что для тебя сейчас было бы самым смелым и при этом безопасным шагом?',
  ],
};

const SPEED_FACTS_HOT: LeveledBank<string> = {
  flirt: [
    'Мы флиртуем друг с другом даже при посторонних',
    'Мы можем часами обниматься и не замечать времени',
    'Мы знаем, какой взгляд значит «пойдём отсюда»',
    'Мы любим целоваться без повода',
    'Мы переписывались так, что приходилось отводить глаза от экрана',
    'Мы краснеем от одного прикосновения',
    'Нам нравится дразнить друг друга намёками',
    'Мы целуемся дольше, чем собирались',
  ],
  warm: [
    'Мы знаем, какие прикосновения действуют на нас сильнее всего',
    'Мы шепчем друг другу то, что не скажем при друзьях',
    'Мы однажды не дошли до спальни',
    'Нам хватает одного прикосновения, чтобы всё остальное перестало быть важным',
    'Мы умеем завести друг друга одним сообщением',
    'Наши поцелуи часто заходят дальше задуманного',
    'Мы засыпаем в объятиях чаще, чем по отдельности',
    'Нам трудно держать руки при себе, когда мы вдвоём',
  ],
  bold: [
    'Мы уже обсуждали вслух, чего хотим в близости',
    'Мы можем долго не вылезать из постели по выходным',
    'Мы пробовали что-то новое только потому, что партнёру было любопытно',
    'Мы можем сказать «медленнее» или «смелее» и не обидеться',
    'Мы отправляли друг другу намёки, от которых невозможно было сосредоточиться',
    'Мы любим, когда близость начинается внезапно',
    'Мы не стесняемся говорить, что нам нравится',
    'Мы знаем, что заводит нас ещё до того, как мы остаёмся вдвоём',
  ],
  wild: [
    'Мы фантазировали вслух о том, чего ещё не пробовали',
    'Мы устраивали ролевые игры или хотели бы попробовать',
    'Мы обсуждали границы заранее, и это нас только сблизило',
    'Мы устраивали вечер по сценарию с заранее придуманными ролями',
    'Мы можем целый вечер говорить только о желаниях',
    'Нам хватает полумрака и музыки, чтобы всё случилось само',
    'Мы можем передать контроль друг другу и доверять',
    'Мы можем быть смелее, чем кто-либо о нас думает',
  ],
};

const TRUTH_DARE_HOT: LeveledBank<{ truth: string; dare: string }> = {
  flirt: [
    { truth: 'Что в моей улыбке или взгляде цепляет тебя сильнее всего?', dare: 'Поцелуйте партнёра в запястье и задержите взгляд на 5 секунд.' },
    { truth: 'Какое моё сообщение заставило тебя улыбаться весь день?', dare: 'Отправьте партнёру сообщение с намёком, а потом прочитайте его вслух.' },
    { truth: 'Какой момент нашего свидания тебе хочется повторить?', dare: 'Потанцуйте медленный танец без музыки.' },
    { truth: 'Где моё прикосновение нравится тебе больше всего?', dare: 'Нарисуйте пальцем на спине партнёра слово, пусть угадает.' },
    { truth: 'Какие слова тебе приятнее всего слышать от меня шёпотом?', dare: 'Прошепчите партнёру на ухо три комплимента.' },
    { truth: 'О чём ты вспоминаешь, когда думаешь о нашем самом долгом поцелуе?', dare: 'Поцелуйте партнёра так, как целовали бы в первый раз.' },
  ],
  warm: [
    { truth: 'Где тебе хочется поцелуев дольше всего?', dare: 'Выберите место для поцелуя: шея, плечо или ладонь, и не торопитесь.' },
    { truth: 'Что в моём прикосновении заводит тебя быстрее всего?', dare: 'Сделайте партнёру медленный массаж шеи и плеч в течение минуты.' },
    { truth: 'Какая обстановка для близости кажется тебе самой притягательной?', dare: 'Выключите свет, включите музыку и станцуйте вдвоём.' },
    { truth: 'Чего тебе хочется между нами сегодня вечером?', dare: 'Шёпотом скажите партнёру, чего вам хочется сегодня. Партнёр может ответить «да», «позже» или «не сегодня».' },
    { truth: 'Какой мой образ тебе нравится больше всего?', dare: 'Медленно снимите с партнёра один предмет: часы, украшение или носок.' },
    { truth: 'Какой момент нашей близости ты чаще всего прокручиваешь в голове?', dare: 'Поцелуйте партнёра так, будто вы одни в целом мире.' },
  ],
  bold: [
    { truth: 'Чего тебе хочется между нами, о чём мы ещё не говорили?', dare: 'Шёпотом назовите одно желание. Партнёр может согласиться, отложить или сказать «не сейчас».' },
    { truth: 'Что мне стоит делать медленнее, а что смелее?', dare: 'Завяжите партнёру глаза и поцелуйте в три разных места.' },
    { truth: 'Какая фантазия возвращается к тебе снова и снова?', dare: 'Проведите ладонями по спине партнёра и скажите, что вам в нём нравится.' },
    { truth: 'Что возбуждает тебя ещё до того, как мы остаёмся вдвоём?', dare: 'Станцуйте для партнёра медленный танец, постепенно приближаясь.' },
    { truth: 'Какие слова во время близости действуют на тебя сильнее всего?', dare: 'Прошепчите партнёру фразу, которую хотели бы услышать в ответ.' },
    { truth: 'Что тебе нужно, чтобы расслабиться и отпустить контроль?', dare: 'Поменяйтесь ролями на пять минут: ведёт тот, кто обычно уступает.' },
  ],
  wild: [
    { truth: 'Какую самую смелую фантазию с нашим участием тебе трудно рассказать вслух?', dare: 'Расскажите фантазию шёпотом. Партнёр может остановить вас словом «хватит» в любой момент.' },
    { truth: 'Какая ролевая игра могла бы тебя по-настоящему зажечь?', dare: 'Разыграйте знакомство, как будто видите друг друга впервые.' },
    { truth: 'Кто должен вести этой ночью: ты, я или по очереди?', dare: 'Бросьте монетку: победитель ведёт следующие десять минут.' },
    { truth: 'Что из увиденного или прочитанного тебе хотелось бы попробовать со мной?', dare: 'Придумайте сценарий нашего вечера из трёх шагов, партнёр добавит четвёртый.' },
    { truth: 'Что тебе нужно заранее, чтобы чувствовать себя спокойно и свободно?', dare: 'Договоритесь о стоп-слове и придумайте его вместе.' },
    { truth: 'Что в нашей близости тебе хотелось бы попробовать впервые?', dare: 'Запишите желания на бумажках, перемешайте и вытяните одно. Вместе решите, готовы ли.' },
  ],
};

/**
 * Нарастающий жар.
 * Берёт уровни от 'flirt' до maxLevel включительно.
 * Делит total поровну; остаток отдаёт самым высоким уровням (с конца).
 * Внутри уровня shuffle(...).slice(0, count), между уровнями сохраняет порядок от мягкого к смелому.
 */
function rampUp<T>(bank: LeveledBank<T>, maxLevel: HotLevel, total: number): T[] {
  const maxIdx = HOT_LEVEL_ORDER.indexOf(maxLevel);
  const levels = HOT_LEVEL_ORDER.slice(0, maxIdx + 1);
  const base = Math.floor(total / levels.length);
  const rem = total % levels.length;
  const result: T[] = [];
  for (let i = 0; i < levels.length; i++) {
    const level = levels[i];
    const count = base + (i >= levels.length - rem ? 1 : 0);
    const items = shuffle(bank[level]).slice(0, count);
    result.push(...items);
  }
  return result;
}

/**
 * Fallback static bank of raw rounds for a game. Used when AI generation
 * fails or is disabled. Decorate afterwards with decorateRounds().
 */
export function buildStaticRounds(gameId: GameId, mood: Mood | null, heat: HotLevel = DEFAULT_HOT_LEVEL): RawRound[] {
  const m = mood ?? 'нежное';

  switch (gameId) {
    case 'KNOW_ME': {
      const rounds: RawRound[] = [];
      rounds.push(...shuffle(KNOW_ME_WARMUP).slice(0, 6));
      const personalToTake = m === 'нежное' || m === 'поговорить' || m === 'погорячее' || m === HOT_MOOD
        ? Math.min(5, KNOW_ME_PERSONAL.length)
        : 3;
      rounds.push(...shuffle(KNOW_ME_PERSONAL).slice(0, personalToTake));
      rounds.push(KNOW_ME_FINAL_TEXT);
      return rounds;
    }
    case 'CHOOSE_ONE': {
      const rounds: RawRound[] = [];
      rounds.push(...shuffle(CHOOSE_ONE_PAIRS).slice(0, 12));
      const surpriseToTake = m === 'веселое' ? 4 : 3;
      rounds.push(...shuffle(CHOOSE_ONE_SURPRISE).slice(0, Math.min(surpriseToTake, CHOOSE_ONE_SURPRISE.length)));
      return rounds;
    }
    case 'ASSOCIATIONS': {
      if (m === HOT_MOOD) {
        return rampUp(ASSOCIATIONS_HOT, heat, 8).map((text) => ({ text, options: [] }));
      }
      const words = ASSOCIATIONS_WORDS[m];
      return shuffle(words).map((text) => ({ text, options: [] }));
    }
    case 'COMPLIMENTS': {
      if (m === HOT_MOOD) {
        const withBoundaries = HOT_LEVEL_ORDER.indexOf(heat) >= HOT_LEVEL_ORDER.indexOf('bold');
        const prompts = rampUp(COMPLIMENTS_HOT, heat, withBoundaries ? 5 : 6);
        if (withBoundaries) prompts.unshift(HOT_BOUNDARY_OPENER);
        return prompts.map((text) => ({ text, options: [] }));
      }
      const prompts = COMPLIMENTS_BANK[m];
      return shuffle(prompts).map((text) => ({ text, options: [] }));
    }
    case 'SPEED_FACTS': {
      if (m === HOT_MOOD) {
        return rampUp(SPEED_FACTS_HOT, heat, 8).map((text) => ({ text, options: ['✅ Да', '❌ Нет'] }));
      }
      const facts = SPEED_FACTS_BANK[m];
      return shuffle(facts).map((text) => ({ text, options: ['✅ Да', '❌ Нет'] }));
    }
    case 'TRUTH_DARE': {
      if (m === HOT_MOOD) {
        return rampUp(TRUTH_DARE_HOT, heat, 6).map((p) => ({ text: '', options: [], truth: p.truth, dare: p.dare, truthB: p.truth, dareB: p.dare }));
      }
      const prompts = TRUTH_DARE_BANK[m];
      return shuffle(prompts).map((p) => ({ text: '', options: [], truth: p.truth, dare: p.dare, truthB: p.truthB, dareB: p.dareB }));
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
function decorateRounds(gameId: GameId, raw: RawRound[]): GameRound[] {
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
      case 'TRUTH_DARE':
        return {
          ...r,
          type: 'truth_dare',
          category: 'truth_dare',
          options: ['🎯 Правда', '🔥 Действие'],
          truth: r.truth ?? '',
          dare: r.dare ?? '',
          truthB: r.truthB ?? r.truth ?? '',
          dareB: r.dareB ?? r.dare ?? '',
        };
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
  names?: PairNames,
  heat?: HotLevel
): Promise<GameSessionRow> {
  let raw: RawRound[] | null = null;

  // Resolve heat level from pair settings (server-side source of truth)
  let effectiveHeat: HotLevel = heat ?? DEFAULT_HOT_LEVEL;
  if (mood === HOT_MOOD) {
    // Check 18+ permission
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { data: allows18, error: err18 } = await supabase.rpc('pair_allows_hot_18', { p_pair_id: pairId });
    if (err18) throw err18;
    if (!allows18) {
      throw new Error('18+ category not enabled or not confirmed by both partners');
    }
    // Get effective heat level (min of both partners), returned as text
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { data: dbHeat, error: errHeat } = await supabase.rpc('get_effective_heat_level', { p_pair_id: pairId });
    if (errHeat) throw errHeat;
    effectiveHeat = isHotLevel(dbHeat) ? dbHeat : DEFAULT_HOT_LEVEL;
  } else if (heat) {
    effectiveHeat = heat;
  }

  // Для 'погорячее 18+' не вызываем ИИ: его промпт не знает про уровни жара,
  // и может выдать контент выше выбранного уровня.
  if (names && mood !== HOT_MOOD) {
    const ai = await generateAiGameRounds({ gameId, mood, names });
    raw = ai ? ai.map((r) => ({ text: r.text, options: r.options, truth: r.truth, dare: r.dare, truthB: r.truth2, dareB: r.dare2 })) : null;
  }
  if (!raw) {
    raw = buildStaticRounds(gameId, mood, effectiveHeat);
  }

  const rounds = decorateRounds(gameId, raw);
  const session = await createGameSessionRow(pairId, initiatorId, gameId, mood, rounds, effectiveHeat);
  return session;
}
