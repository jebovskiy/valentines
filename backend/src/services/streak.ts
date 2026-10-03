import { supabase } from '../utils/supabase';
import { updatePairMaxStreak, setPairCurrentStreak } from './database';

/**
 * Стрик пары — производная величина от `valentines.sent_at`, а не ручной счётчик.
 *
 * Раньше значение лежало только в колонке `pairs.current_streak` и
 * инкрементировалось «если сегодня ещё не было активности». Проверка выполнялась
 * ПОСЛЕ вставки новой валентинки, поэтому всегда находила только что созданную
 * строку, `current_streak` не рос никогда, а `GET /api/pairs/streak` отдавал
 * замороженное число. Теперь единственный источник истины — дни активности.
 *
 * Границы суток считаются в UTC: у пары один общий счётчик, и смешивать
 * часовые пояса двух партнёров означало бы разные «дни» для одного и того же
 * стрика.
 */

// Хватает с запасом (несколько лет активности); при обрезке худшие дни теряются,
// но `max_streak` всё равно не уменьшается — см. recomputePairStreak.
const ACTIVITY_LIMIT = 5000;

export function isoUtcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function shiftUtcDay(day: string, delta: number): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

/**
 * Текущая серия и рекорд по списку дней активности (`YYYY-MM-DD`, UTC).
 * Серия засчитывается, если пара активна сегодня или вчера: пока сегодняшнего
 * дня не наступило, вчерашний день ещё держит стрик «в силе».
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
    let cursor = last;
    while (active.includes(cursor)) {
      current += 1;
      cursor = shiftUtcDay(cursor, -1);
    }
  }

  return { current, max };
}

export interface PairStreak {
  current: number;
  max: number;
  /** Рекорд обновлён — сигнал для праздничного пуша. */
  newRecord: boolean;
}

/**
 * Пересчитывает стрик по всем валентинкам пары и синхронизирует колонки.
 * Идемпотентно: можно вызывать после каждой отправки и при каждом чтении,
 * замороженное или испорченное значение чинится само.
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

  return { current: computed.current, max, newRecord };
}