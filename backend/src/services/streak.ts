import { supabase } from '../utils/supabase';
import { updatePairMaxStreak, setPairCurrentStreak } from './database';

/**
 * Стрик пары — производная величина от `valentines.sent_at`, а не ручной счётчик.
 *
 * Раньше значение лежало только в колонке `pairs.current_streak` и
 * инкрементировалось «если сегодня ещё не было активности». Проверка выполнялась
 * ПОСЛЕ вставки новой валентинки, поэтому всегда находила только что созданную
 * строку, `current_streak` не рос никогда, а `GET /api/pairs/streak` отдавал
 * замороженное число. Затем (479b58f) он стал пересчитываться по всей истории
 * в Node — это чинило значение, но означало до трёх выборок по 5000 строк и до
 * трёх UPDATE `pairs` на каждый POST валентинки, плюс гонку между двумя
 * параллельными отправками.
 *
 * Теперь единственный источник истины — база:
 *   * `pairs.last_active_date` — последний засчитанный день пары;
 *   * `pairs.current_streak`   — длина текущей серии (пишется атомарно);
 *   * `pairs.max_streak`       — рекорд, не уменьшается.
 * Запись идёт одним UPDATE через RPC `register_valentine_activity`
 * (миграция 027), чтение — O(1) без похода в `valentines`.
 *
 * Границы суток считаются в часовом поясе вызывающего (`tzOffsetMinutes` в
 * знаке `Date#getTimezoneOffset()` — минуты к ЗАПАДУ от UTC, тот же параметр и
 * тот же знак, что у `/api/recap`). У пары один общий счётчик, поэтому
 * смешивать пояса двух партнёров нельзя: передаётся пояс того, кто сейчас пишет.
 * Значение 0 сохраняет прежнее поведение UTC.
 */

/** Хватает с запасом (несколько лет активности) — используется только legacy-пересчётом. */
const ACTIVITY_LIMIT = 5000;

/** Postgres error codes for "the migration has not been applied yet". */
const MISSING_RPC_CODES = new Set(['42883', 'PGRST202', '404']);

export function isoUtcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function shiftUtcDay(day: string, delta: number): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

/**
 * День пары в её локальном времени.
 *
 * Знак — как у `Date#getTimezoneOffset()` и, соответственно, у уже
 * существующего параметра `tz_offset_minutes` в /api/recap: минуты к ЗАПАДУ от
 * UTC (UTC+3 => -180). Вычитаем, а не прибавляем. Default 0 = UTC.
 */
export function localDay(date: Date, tzOffsetMinutes = 0): string {
  return isoUtcDay(new Date(date.getTime() - tzOffsetMinutes * 60_000));
}

/**
 * Текущая серия и рекорд по списку дней активности (`YYYY-MM-DD`).
 * Серия засчитывается, если пара активна сегодня или вчера: пока сегодняшнего
 * дня не наступило, вчерашний день ещё держит стрик «в силе».
 *
 * Оставлен как эталонная реализация: на нём написаны тесты границ, а сама
 * функция используется только как fallback, если RPC ещё не применены.
 */
export function streakFromActiveDays(days: string[], today: string): { current: number; max: number } {
  const active = Array.from(new Set(days)).sort();
  if (active.length === 0) return { current: 0, max: 0 };

  let max = 1;
  let run = 1;
  for (let i = 1; i < active.length; i += 1) {
    run = shiftUtcDay(active[i - 1], 1) === active[i] ? run + 1 : 1;
    if (run > max) max = run;
  }

  let current = 0;
  const last = active[active.length - 1];
  if (last === today || last === shiftUtcDay(today, -1)) {
    const activeSet = new Set(active);
    let cursor = last;
    while (activeSet.has(cursor)) {
      current += 1;
      cursor = shiftUtcDay(cursor, -1);
    }
  }

  return { current, max };
}

export interface PairStreak {
  current: number;
  max: number;
  /** День засчитан впервые (серия выросла или перезапустилась). */
  advanced: boolean;
  /** Рекорд обновлён — сигнал для праздничного пуша. */
  newRecord: boolean;
}

interface StreakRpcRow {
  current_streak: number;
  max_streak: number;
  advanced: boolean;
  new_record: boolean;
}

interface RpcResult<T> {
  data: T;
  error: { code?: string; message: string } | null;
}

async function callStreakRpc(
  fn: 'register_valentine_activity' | 'recompute_pair_streak',
  pairId: string,
  tzOffsetMinutes: number
): Promise<PairStreak | null> {
  const result = (await supabase.rpc(fn, {
    p_pair_id: pairId,
    p_tz_offset_minutes: tzOffsetMinutes,
  })) as RpcResult<StreakRpcRow | StreakRpcRow[] | null>;

  if (result.error) {
    // Миграция 027 не применена — не роняем отправку, а уходим в legacy-путь.
    if (MISSING_RPC_CODES.has(result.error.code ?? '')) throw new MissingStreakRpcError(fn);
    throw result.error;
  }

  const payload = result.data;
  const row = (Array.isArray(payload) ? payload[0] : payload) ?? null;
  if (!row) return null;
  return {
    current: row.current_streak ?? 0,
    max: row.max_streak ?? 0,
    advanced: !!row.advanced,
    newRecord: !!row.new_record,
  };
}

export class MissingStreakRpcError extends Error {
  constructor(fn: string) {
    super(`streak RPC ${fn} is unavailable`);
    this.name = 'MissingStreakRpcError';
  }
}

/**
 * Засчитывает активность пары за сегодняшний (локальный) день.
 * Вызывается один раз на POST валентинки, ПОСЛЕ вставки строки.
 * Идемпотентно внутри дня: повторный вызов вернёт те же числа и `advanced=false`.
 */
export async function registerPairActivity(pairId: string, tzOffsetMinutes = 0): Promise<PairStreak> {
  return (await callStreakRpc('register_valentine_activity', pairId, tzOffsetMinutes)) ?? {
    current: 0,
    max: 0,
    advanced: false,
    newRecord: false,
  };
}

/**
 * Полный пересчёт по истории в базе (gaps-and-islands) — PATCH /api/pairs/streak.
 * Дорогой путь намеренно не используется на чтении.
 */
export async function recomputePairStreakInDb(pairId: string, tzOffsetMinutes = 0): Promise<PairStreak> {
  return (await callStreakRpc('recompute_pair_streak', pairId, tzOffsetMinutes)) ?? {
    current: 0,
    max: 0,
    advanced: false,
    newRecord: false,
  };
}

/**
 * Стрик, который видно пользователю прямо сейчас, из уже сохранённых колонок.
 * Ключевая идея: сохранённый `current_streak` актуален только для того дня,
 * в который он был записан, поэтому проверяем `last_active_date` против
 * сегодняшнего локального дня. Пропущенный день обнуляет серию без записи в БД.
 */
export function readStoredStreak(
  stored: { current_streak?: number | null; max_streak?: number | null; last_active_date?: string | null },
  today: string
): { current: number; max: number; alive: boolean } {
  const max = Math.max(0, stored.max_streak ?? 0);
  const last = stored.last_active_date ?? null;
  if (!last) return { current: 0, max, alive: false };
  const alive = last === today || last === shiftUtcDay(today, -1);
  if (!alive) return { current: 0, max, alive };
  return { current: Math.max(0, stored.current_streak ?? 0), max, alive: true };
}

/**
 * Пересчитывает стрик по всем валентинкам пары и синхронизирует колонки.
 * Идемпотентно: можно вызывать после каждой отправки и при каждом чтении,
 * замороженное или испорченное значение чинится само.
 *
 * @deprecated Только как fallback на время, пока не применена миграция 027.
 */
export async function recomputePairStreak(
  pairId: string,
  stored: { current?: number | null; max?: number | null } = {}
): Promise<PairStreak> {
  const storedMax = stored.max ?? 0;
  const { data, error } = await supabase
    .from('valentines')
    .select('sent_at')
    .eq('pair_id', pairId)
    .order('sent_at', { ascending: false })
    .limit(ACTIVITY_LIMIT);
  if (error) throw error;

  const rows = (data ?? []) as { sent_at: string }[];
  const computed = streakFromActiveDays(
    rows.map((row) => isoUtcDay(new Date(row.sent_at))),
    isoUtcDay(new Date())
  );

  // Рекорд не уменьшаем: иначе старая история (или обрезка выборки) откатила бы
  // разблокированные анимации.
  const max = Math.max(computed.max, storedMax);
  const newRecord = max > storedMax;

  // Пишем только при изменении: пересчёт висит на каждом чтении стрика.
  if (computed.current !== (stored.current ?? null)) {
    await setPairCurrentStreak(pairId, computed.current);
  }
  if (newRecord) await updatePairMaxStreak(pairId, max);

  return { current: computed.current, max, advanced: true, newRecord };
}

/**
 * Полный пересчёт по истории с прозрачным откатом на legacy-путь, если RPC ещё
 * недоступен. Используется `PATCH /api/pairs/streak` и миграцией 027.
 */
export async function rebuildPairStreak(
  pairId: string,
  tzOffsetMinutes = 0,
  stored: { current?: number | null; max?: number | null } = {}
): Promise<PairStreak> {
  try {
    return await recomputePairStreakInDb(pairId, tzOffsetMinutes);
  } catch (error) {
    if (!(error instanceof MissingStreakRpcError)) throw error;
    return recomputePairStreak(pairId, stored);
  }
}

/**
 * Атомарная регистрация активности с прозрачным откатом на legacy-пересчёт,
 * если RPC ещё недоступен. Вызывать ПОСЛЕ вставки валентинки.
 */
export async function recordValentineActivity(
  pairId: string,
  tzOffsetMinutes = 0,
  stored: { current?: number | null; max?: number | null } = {}
): Promise<PairStreak> {
  try {
    return await registerPairActivity(pairId, tzOffsetMinutes);
  } catch (error) {
    if (!(error instanceof MissingStreakRpcError)) throw error;
    return recomputePairStreak(pairId, stored);
  }
}