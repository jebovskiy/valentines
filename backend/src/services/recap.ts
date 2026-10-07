import { z } from 'zod';
import { supabase } from '../utils/supabase';
import { generateStructuredJson } from './gemini';
import { localDay, readStoredStreak } from './streak';
import type { Pair } from './database';

/**
 * «Итоги за период» — агрегаты по паре и тёплая сводка поверх них.
 *
 * Слой делится на две части:
 *  - чистые функции (buildRecapAggregates / buildRecapPrompt / fallbackRecapSummary),
 *    которые покрыты юнит-тестами без БД;
 *  - запросы к Supabase и вызов общего LLM-слоя приложения (generateStructuredJson),
 *    который сам выбирает провайдера через AI_PROVIDER.
 *
 * Важно: сводка никогда не придумывает цифры. Всё, что нельзя посчитать по
 * данным, уходит в модель как «нет данных», а при недоступном ИИ используется
 * детерминированный текст, собранный из тех же чисел.
 */

export type RecapPeriodKey = '7d' | '30d' | '90d' | 'all';

export const RECAP_PERIODS: Record<RecapPeriodKey, number | null> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  all: null,
};

export const DEFAULT_RECAP_PERIOD: RecapPeriodKey = '30d';

const DAY_MS = 24 * 60 * 60 * 1000;

const WEEKDAYS = [
  'воскресенье',
  'понедельник',
  'вторник',
  'среда',
  'четверг',
  'пятница',
  'суббота',
] as const;

const GREETING_LABELS: Record<string, string> = {
  morning: 'утро',
  night: 'ночь',
  luck: 'удачу',
  day: 'хороший день',
  evening: 'вечер',
  care: 'заботу',
};

const ASPECT_LABELS = {
  visuals: 'визуал',
  plot: 'сюжет',
  acting: 'актёрская игра',
  music: 'музыка',
  atmosphere: 'атмосфера',
  humor: 'юмор',
} as const;

type AspectKey = keyof typeof ASPECT_LABELS;

const ASPECT_KEYS = Object.keys(ASPECT_LABELS) as AspectKey[];

export interface RecapAggregates {
  periodKey: RecapPeriodKey;
  periodLabel: string;
  periodStart: string | null;
  valentinesCount: number;
  partnerAName: string;
  partnerACount: number;
  partnerBName: string;
  partnerBCount: number;
  greetingsByType: Record<string, number>;
  currentStreak: number;
  maxStreak: number;
  /** 0..23 в местном времени пользователя; null, если активности не было. */
  mostActiveHour: number | null;
  mostActiveWeekday: string | null;
  avgMovieCompatibility: number | null;
  /** Аспект с наибольшим средним расхождением оценок партнёров. */
  biggestMovieGap: string | null;
  moviesWatched: number;
  datesMatched: number;
  /** Кино, где оба партнёра выставили оценки — база для расхождений. */
  moviesScoredByBoth: number;
}

export interface RecapSummary {
  headline: string;
  highlight_number: string;
  insight: string;
  fun_fact: string;
  closing_line: string;
}

interface ActivityRow {
  sender_telegram_id: number;
  sent_at: string;
}

interface GreetingRow {
  type: string;
  sent_at: string;
}

interface WatchedMovieRow {
  id: string;
  watched_at: string | null;
  added_at: string;
}

interface ReviewRow {
  movie_id: string;
  author_telegram_id: number;
  visuals: number;
  plot: number;
  acting: number;
  music: number;
  atmosphere: number;
  humor: number;
}

interface InsightRow {
  movie_id: string;
  result: Record<string, unknown> | null;
}

interface DateSessionRow {
  match: Record<string, unknown> | null;
  created_at: string;
}

export interface RecapRawData {
  pair: Pick<
    Pair,
    'telegram_user_a' | 'telegram_user_b' | 'user_a_name' | 'user_b_name' | 'max_streak' | 'current_streak' | 'last_active_date'
  >;
  periodKey: RecapPeriodKey;
  periodStart: Date | null;
  valentines: ActivityRow[];
  greetings: GreetingRow[];
  watchedMovies: WatchedMovieRow[];
  reviews: ReviewRow[];
  insights: InsightRow[];
  dateSessions: DateSessionRow[];
  /** Смещение часового пояса в минутах, как у Date#getTimezoneOffset. */
  tzOffsetMinutes: number;
  /** Опорный «сейчас»; по умолчанию реальное время. */
  now?: Date;
}

function pluralDays(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} день`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} дня`;
  return `${count} дней`;
}

export function periodLabel(key: RecapPeriodKey): string {
  const days = RECAP_PERIODS[key];
  return days === null ? 'за всё время' : `за последние ${pluralDays(days)}`;
}

export function periodStartFor(key: RecapPeriodKey, now: Date): Date | null {
  const days = RECAP_PERIODS[key];
  return days === null ? null : new Date(now.getTime() - days * DAY_MS);
}

/**
 * Момент времени в местном часовом поясе пользователя. Сдвигаем инстант на
 * offset и читаем UTC-геттеры — так час считается верно и для +05:30.
 */
function localHourAndWeekday(iso: string, tzOffsetMinutes: number): { hour: number; weekday: number } {
  const shifted = new Date(new Date(iso).getTime() - tzOffsetMinutes * 60_000);
  return { hour: shifted.getUTCHours(), weekday: shifted.getUTCDay() };
}

function isInPeriod(iso: string | null, periodStart: Date | null): boolean {
  if (periodStart === null) return true;
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t >= periodStart.getTime();
}

/** Модуль оценок двух партнёров по одному фильму; null, если оценок не хватает. */
function aspectDiff(a: ReviewRow, b: ReviewRow, key: AspectKey): number | null {
  const left = a[key];
  const right = b[key];
  if (typeof left !== 'number' || typeof right !== 'number') return null;
  return Math.abs(left - right);
}

/**
 * Чистая агрегация: сырые строки -> числа для сводки. Никаких запросов и
 * предположений: что не посчиталось, остаётся null и честно уходит в текст.
 */
export function buildRecapAggregates(raw: RecapRawData): RecapAggregates {
  const { pair, periodKey, periodStart, tzOffsetMinutes } = raw;
  const now = raw.now ?? new Date();

  let partnerACount = 0;
  let partnerBCount = 0;
  const hourCounts = new Array<number>(24).fill(0);
  const weekdayCounts = new Array<number>(7).fill(0);

  for (const row of raw.valentines) {
    // Сводка всегда за период, поэтому и счётчики, и час активности читают
    // один и тот же отфильтрованный набор — иначе «за 30 дней» приехало бы
    // с цифрами за всё время.
    if (!isInPeriod(row.sent_at, periodStart)) continue;

    if (row.sender_telegram_id === pair.telegram_user_a) partnerACount += 1;
    else if (row.sender_telegram_id === pair.telegram_user_b) partnerBCount += 1;

    const { hour, weekday } = localHourAndWeekday(row.sent_at, tzOffsetMinutes);
    hourCounts[hour] += 1;
    weekdayCounts[weekday] += 1;
  }

  for (const row of raw.greetings) {
    if (!isInPeriod(row.sent_at, periodStart)) continue;
    const { hour, weekday } = localHourAndWeekday(row.sent_at, tzOffsetMinutes);
    hourCounts[hour] += 1;
    weekdayCounts[weekday] += 1;
  }

  const greetingsByType: Record<string, number> = {};
  for (const row of raw.greetings) {
    if (!isInPeriod(row.sent_at, periodStart)) continue;
    greetingsByType[row.type] = (greetingsByType[row.type] ?? 0) + 1;
  }

  let mostActiveHour: number | null = null;
  let bestHourCount = 0;
  for (let hour = 0; hour < 24; hour += 1) {
    if (hourCounts[hour] > bestHourCount) {
      bestHourCount = hourCounts[hour];
      mostActiveHour = hour;
    }
  }

  let mostActiveWeekday: string | null = null;
  let bestWeekdayCount = 0;
  for (let day = 0; day < 7; day += 1) {
    if (weekdayCounts[day] > bestWeekdayCount) {
      bestWeekdayCount = weekdayCounts[day];
      mostActiveWeekday = WEEKDAYS[day];
    }
  }

  const watched = raw.watchedMovies.filter((m) => isInPeriod(m.watched_at ?? m.added_at, periodStart));
  const watchedIds = new Set(watched.map((m) => m.id));

  const reviewsByMovie = new Map<string, ReviewRow[]>();
  for (const review of raw.reviews) {
    if (!watchedIds.has(review.movie_id)) continue;
    const list = reviewsByMovie.get(review.movie_id) ?? [];
    list.push(review);
    reviewsByMovie.set(review.movie_id, list);
  }

  // Средняя разница по аспектам считается только по фильмам, где оба поставили
  // оценки: одиночная оценка ничего не говорит о совместимости.
  const gapSums = new Map<AspectKey, number>();
  const gapCounts = new Map<AspectKey, number>();
  let moviesScoredByBoth = 0;

  for (const reviews of reviewsByMovie.values()) {
    const first = reviews.find((r) => r.author_telegram_id === pair.telegram_user_a);
    const second = reviews.find((r) => r.author_telegram_id === pair.telegram_user_b);
    if (!first || !second) continue;
    moviesScoredByBoth += 1;
    for (const key of ASPECT_KEYS) {
      const diff = aspectDiff(first, second, key);
      if (diff === null) continue;
      gapSums.set(key, (gapSums.get(key) ?? 0) + diff);
      gapCounts.set(key, (gapCounts.get(key) ?? 0) + 1);
    }
  }

  let biggestMovieGap: string | null = null;
  let biggestGapValue = -1;
  for (const key of ASPECT_KEYS) {
    const count = gapCounts.get(key) ?? 0;
    if (count === 0) continue;
    const avg = (gapSums.get(key) ?? 0) / count;
    if (avg > biggestGapValue) {
      biggestGapValue = avg;
      biggestMovieGap = ASPECT_LABELS[key];
    }
  }

  const compatibility: number[] = [];
  for (const insight of raw.insights) {
    if (!watchedIds.has(insight.movie_id)) continue;
    const value = insight.result?.compatibility_percent;
    const percent = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(percent)) compatibility.push(percent);
  }
  const avgMovieCompatibility = compatibility.length
    ? Math.round(compatibility.reduce((sum, value) => sum + value, 0) / compatibility.length)
    : null;

  let datesMatched = 0;
  for (const session of raw.dateSessions) {
    if (!isInPeriod(session.created_at, periodStart)) continue;
    const matched = session.match?.matched;
    if (matched === true || matched === 'true') datesMatched += 1;
  }

  // Стрик берём из тех же атомарно поддерживаемых колонок `pairs`, что и
  // /api/pairs/streak, а НЕ из загруженных валентинок: они уже отфильтрованы по
  // периоду, поэтому для 7d/30d/90d серия обрезалась бы длиной периода (120 дней
  // подряд показывались как «7 дней»). Записи в БД достаточно: она протухает
  // сама, когда `last_active_date` старше вчерашнего дня.
  const today = localDay(now, tzOffsetMinutes);
  const streak = readStoredStreak(pair, today);
  const currentStreak = streak.alive ? streak.current : 0;

  return {
    periodKey,
    periodLabel: periodLabel(periodKey),
    periodStart: periodStart ? periodStart.toISOString() : null,
    valentinesCount: partnerACount + partnerBCount,
    partnerAName: pair.user_a_name ?? 'Первый партнёр',
    partnerACount,
    partnerBName: pair.user_b_name ?? 'Второй партнёр',
    partnerBCount,
    greetingsByType,
    currentStreak,
    maxStreak: Math.max(streak.max, pair.max_streak ?? 0),
    mostActiveHour: bestHourCount > 0 ? mostActiveHour : null,
    mostActiveWeekday,
    avgMovieCompatibility,
    biggestMovieGap,
    moviesWatched: watched.length,
    datesMatched,
    moviesScoredByBoth,
  };
}

const NO_DATA = 'нет данных';

function formatGreetings(greetings: Record<string, number>): string {
  const entries = Object.entries(greetings).filter(([, count]) => count > 0);
  if (entries.length === 0) return NO_DATA;
  return entries
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => `${GREETING_LABELS[type] ?? type} — ${count}`)
    .join(', ');
}

/** Ровно тот текст, который был согласован: цифры подставлены, правила те же. */
export function buildRecapPrompt(agg: RecapAggregates): string {
  return `Ты составляешь тёплую, живую сводку об отношениях пары за ${agg.periodLabel} — в духе Spotify Wrapped, но про пару.
Вот агрегированные данные (только числа, никаких личных сообщений):
Валентинок отправлено: ${agg.valentinesCount} (${agg.partnerAName}: ${agg.partnerACount}, ${agg.partnerBName}: ${agg.partnerBCount})
Приветствий по типам: ${formatGreetings(agg.greetingsByType)}
Текущий стрик: ${agg.currentStreak} дней, рекорд: ${agg.maxStreak} дней
Самый частый час активности: ${agg.mostActiveHour === null ? NO_DATA : `${agg.mostActiveHour}:00`}
Самый частый день недели: ${agg.mostActiveWeekday ?? NO_DATA}
Средняя % совместимости по фильмам за период: ${agg.avgMovieCompatibility === null ? NO_DATA : agg.avgMovieCompatibility}
Аспект с наибольшим расхождением вкусов: ${agg.biggestMovieGap ?? NO_DATA}
Фильмов посмотрено вместе: ${agg.moviesWatched}
Свиданий заматчено: ${agg.datesMatched}
Верни JSON строго по схеме:
headline: короткий цепляющий заголовок карточки (до 40 символов, с эмодзи)
highlight_number: самая интересная цифра из данных + подпись к ней (1 короткое предложение)
insight: один абзац (2-3 предложения) — живое, тёплое наблюдение о паре на основе цифр, без клише, без воды, конкретно
fun_fact: одна неожиданная деталь, поданная с лёгким юмором
closing_line: короткое пожелание/прогноз на следующий период (1 предложение)
Правила:
Никогда не придумывай цифры, которых нет в данных.
Если данных мало — честно работай с тем, что есть, не компенсируй фантазией.
Тон: тёплый, живой, без канцелярита. Общие фразы вроде "ваши отношения уникальны" запрещены — конкретика важнее.
Не упоминай, что текст сгенерирован автоматически или любой технологией — пиши так, будто это наблюдение, а не отчёт инструмента.`;
}

export const RECAP_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string' },
    highlight_number: { type: 'string' },
    insight: { type: 'string' },
    fun_fact: { type: 'string' },
    closing_line: { type: 'string' },
  },
  required: ['headline', 'highlight_number', 'insight', 'fun_fact', 'closing_line'],
} as const;

const recapSummarySchema = z.object({
  headline: z.string().min(1),
  highlight_number: z.string().min(1),
  insight: z.string().min(1),
  fun_fact: z.string().min(1),
  closing_line: z.string().min(1),
});

const HEADLINE_MAX = 40;

function clean(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** Разбирает ответ модели; null, если это не наш JSON. */
export function parseRecapSummary(text: string | null): RecapSummary | null {
  if (!text) return null;
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return null;
  }
  const parsed = recapSummarySchema.safeParse(payload);
  if (!parsed.success) return null;

  const headline = clean(parsed.data.headline).slice(0, HEADLINE_MAX);
  if (!headline) return null;

  return {
    headline,
    highlight_number: clean(parsed.data.highlight_number),
    insight: parsed.data.insight.trim(),
    fun_fact: parsed.data.fun_fact.trim(),
    closing_line: parsed.data.closing_line.trim(),
  };
}

function pluralValentines(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'валентинка';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'валентинки';
  return 'валентинок';
}

function pluralDates(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'свидание';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'свидания';
  return 'свиданий';
}

function pluralMovies(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'фильм';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'фильма';
  return 'фильмов';
}

/**
 * Текст без ИИ: собирается из тех же чисел, что ушли в промпт. Нужен и как
 * фолбэк, и когда активности за период просто нет — выдумывать нечего.
 */
export function fallbackRecapSummary(agg: RecapAggregates): RecapSummary {
  if (agg.valentinesCount === 0 && Object.keys(agg.greetingsByType).length === 0) {
    return {
      headline: 'Пока тихо — но мы уже вместе',
      highlight_number: '0 валентинок за период — начало всегда самое сложное.',
      insight: `За ${agg.periodLabel} пара почти не оставляла следов: ни валентинок, ни приветствий. Это не значит, что ничего не происходит, — просто цифрам пока нечего показать.`,
      fun_fact: 'Самый честный отчёт — тот, где цифр мало.',
      closing_line: 'Начните с одного приветствия — остальное посчитаем в следующий раз.',
    };
  }

  const leaderIsA = agg.partnerACount >= agg.partnerBCount;
  const leader = leaderIsA ? agg.partnerAName : agg.partnerBName;
  const leaderCount = Math.max(agg.partnerACount, agg.partnerBCount);
  const share = agg.valentinesCount
    ? Math.round((leaderCount / agg.valentinesCount) * 100)
    : 0;

  const highlightParts: string[] = [];
  if (agg.valentinesCount > 0) {
    highlightParts.push(`${agg.valentinesCount} ${pluralValentines(agg.valentinesCount)} за период`);
  }
  if (agg.datesMatched > 0) highlightParts.push(`${agg.datesMatched} ${pluralDates(agg.datesMatched)}`);
  if (agg.moviesWatched > 0) highlightParts.push(`${agg.moviesWatched} ${pluralMovies(agg.moviesWatched)} вместе`);

  const insightParts: string[] = [];
  if (agg.valentinesCount > 0 && agg.partnerACount !== agg.partnerBCount) {
    insightParts.push(
      `${leader} отправил${leaderIsA ? 'а' : ''} ${leaderCount} из ${agg.valentinesCount} — это ${share}% всех валентинок`,
    );
  } else if (agg.valentinesCount > 0) {
    insightParts.push(`Валентинки распределились поровну: ${agg.partnerACount} и ${agg.partnerBCount}`);
  }
  if (agg.currentStreak > 0) {
    insightParts.push(
      `стрик держится на ${pluralDays(agg.currentStreak)}` +
        `${agg.maxStreak > agg.currentStreak ? `, рекорд был ${agg.maxStreak}` : ''}`
    );
  }
  if (agg.avgMovieCompatibility !== null) {
    insightParts.push(`совместимость по фильмам — ${agg.avgMovieCompatibility}%`);
  }
  if (insightParts.length === 0) insightParts.push('активность была, но без валентинок — зато приветствия есть');

  const funParts: string[] = [];
  if (agg.mostActiveHour !== null) funParts.push(`час пик — ${agg.mostActiveHour}:00`);
  if (agg.mostActiveWeekday) funParts.push(`любимый день — ${agg.mostActiveWeekday}`);
  if (agg.biggestMovieGap) funParts.push(`спор о ${agg.biggestMovieGap.toLowerCase()} — главный`);
  if (funParts.length === 0) funParts.push('приветствий в этом периоде не было — совсем');

  const headline = agg.valentinesCount > 0
    ? `${agg.valentinesCount} ${pluralValentines(agg.valentinesCount)} ${agg.periodKey === 'all' ? 'за всё время' : 'и любовь в цифрах'}`
    : 'Только приветствия — и они тоже считаются';

  return {
    headline: headline.slice(0, HEADLINE_MAX),
    highlight_number:
      highlightParts.length > 0
        ? `${highlightParts.join(', ')}.`
        : 'За период есть только приветствия — и это тоже считается.',
    insight: `${insightParts.join('; ')}.`,
    fun_fact: `${funParts.join(', ')} — остальное пусть додумает Telegram.`,
    closing_line: agg.currentStreak >= agg.maxStreak && agg.maxStreak > 0
      ? 'Рекорд ещё живой — что закрепим следующими неделями?'
      : 'В следующем периоде есть чему расти — посчитаем снова.',
  };
}

/** Один вызов общего LLM-слоя приложения; при любой неудаче — детерминированный текст. */
export async function generateRecapSummary(agg: RecapAggregates): Promise<RecapSummary> {
  const { text, error } = await generateStructuredJson(buildRecapPrompt(agg), RECAP_RESPONSE_SCHEMA, 20_000, 1_024);
  if (error) {
    console.warn(`[recap] LLM fallback for ${agg.periodKey}: ${error.kind}`);
    return fallbackRecapSummary(agg);
  }
  const parsed = parseRecapSummary(text);
  if (!parsed) {
    console.warn('[recap] model returned an unexpected shape, using numbers only');
    return fallbackRecapSummary(agg);
  }
  return parsed;
}

// PostgREST has no "every row" mode: a query either carries an explicit limit
// or the server's default. Reading a period in pages keeps a single payload
// bounded without silently clipping the answer.
const PAGE_SIZE = 500;
// Safety valve, not a target: past this the recap is a summary anyway, and we
// would rather say so out loud than quietly understate the numbers.
const MAX_ROWS_PER_SOURCE = 20_000;

interface PagedResponse<T> {
  data: T[] | null;
  error: { message: string } | null;
}

/**
 * Читает строки периода страницами.
 *
 * Раньше тут стоял один `.limit(N)`: PostgREST отдавал N самых свежих строк и
 * никогда не сообщал, что что-то отрезал, поэтому у пары с длинной историей
 * цифры в сводке молча занижались. Обрезку теперь видно — в предупреждении
 * лога.
 *
 * Страницы смещением (`.range`), а не keyset-курсор по `(ts, id)`, — нарочно:
 * ключ отсортированной пары пришлось бы протаскивать обратно через строку
 * запроса, а микросекунды, которые PostgREST отдаёт в `timestamptz`, шире, чем
 * умеет хранить JS Date, так что округление расширило бы границу страницы и
 * строки бы терялись. Смещение — просто целые числа, а сортировка ниже
 * тотальная, поэтому страницы не пересекаются и не пропускают строк.
 */
export async function fetchAllPages<T>(
  fetchPage: (offset: number, limit: number) => PromiseLike<PagedResponse<T>>,
  source: string,
): Promise<T[]> {
  const rows: T[] = [];
  for (;;) {
    const page = await fetchPage(rows.length, PAGE_SIZE);
    if (page.error) throw page.error;
    const chunk = page.data ?? [];
    rows.push(...chunk);
    if (chunk.length < PAGE_SIZE) return rows;
    if (rows.length >= MAX_ROWS_PER_SOURCE) {
      console.warn(
        `[recap] ${source} reached the ${MAX_ROWS_PER_SOURCE}-row ceiling for this period; the recap numbers are truncated`,
      );
      return rows;
    }
  }
}

export async function fetchRecapRawData(
  pairId: string,
  periodKey: RecapPeriodKey,
  periodStart: Date | null,
  pair: RecapRawData['pair'],
  tzOffsetMinutes: number
): Promise<RecapRawData> {
  const from = periodStart ? periodStart.toISOString() : null;

  const valentines = fetchAllPages<ActivityRow>((offset, limit) => {
    let query = supabase
      .from('valentines')
      .select('id, sender_telegram_id, sent_at')
      .eq('pair_id', pairId)
      .order('sent_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + limit - 1);
    if (from) query = query.gte('sent_at', from);
    return query;
  }, 'valentines');

  const greetings = fetchAllPages<GreetingRow>((offset, limit) => {
    let query = supabase
      .from('greetings')
      .select('id, type, sent_at')
      .eq('pair_id', pairId)
      .order('sent_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + limit - 1);
    if (from) query = query.gte('sent_at', from);
    return query;
  }, 'greetings');

  const dates = fetchAllPages<DateSessionRow>((offset, limit) => {
    let query = supabase
      .from('date_sessions')
      .select('id, match, created_at')
      .eq('pair_id', pairId)
      .eq('status', 'done')
      .not('match', 'is', null)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + limit - 1);
    if (from) query = query.gte('created_at', from);
    return query;
  }, 'date_sessions');

  // `watched_at` can still be null on a row that is already `watched`, and the
  // aggregation judges such a movie by `added_at` instead — so the period
  // filter has to keep those rows and let the pure side narrow them down.
  const movies = fetchAllPages<WatchedMovieRow>((offset, limit) => {
    let query = supabase
      .from('movies')
      .select('id, watched_at, added_at')
      .eq('pair_id', pairId)
      .eq('status', 'watched')
      .order('watched_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + limit - 1);
    if (from) query = query.or(`watched_at.gte.${from},watched_at.is.null`);
    return query;
  }, 'movies');

  const [valentineRows, greetingRows, movieRows, dateRows] = await Promise.all([
    valentines,
    greetings,
    movies,
    dates,
  ]);

  const watchedRows = movieRows;
  const movieIds = watchedRows.map((m) => m.id);

  let reviews: ReviewRow[] = [];
  let insights: InsightRow[] = [];

  if (movieIds.length > 0) {
    const [reviewsResult, insightsResult] = await Promise.all([
      supabase
        .from('movie_reviews')
        .select('movie_id, author_telegram_id, visuals, plot, acting, music, atmosphere, humor')
        .in('movie_id', movieIds),
      supabase
        .from('movie_insights')
        .select('movie_id, result')
        .in('movie_id', movieIds)
        .eq('status', 'done'),
    ]);
    if (reviewsResult.error) throw reviewsResult.error;
    if (insightsResult.error) throw insightsResult.error;
    reviews = (reviewsResult.data ?? []) as ReviewRow[];
    insights = (insightsResult.data ?? []) as InsightRow[];
  }

  return {
    pair,
    periodKey,
    periodStart,
    valentines: valentineRows,
    greetings: greetingRows,
    watchedMovies: watchedRows,
    reviews,
    insights,
    dateSessions: dateRows,
    tzOffsetMinutes,
  };
}