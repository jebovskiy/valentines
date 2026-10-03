import type { RecapPeriod } from '../types';

/**
 * Query для «Итогов». Живёт отдельно от клиента, потому что здесь легко
 * перепутать знак смещения: бэкенд ждёт минуты как у Date#getTimezoneOffset
 * (UTC+3 => -180), то есть ровно то, что отдаёт Date.
 */
export function recapQuery(period: RecapPeriod, tzOffsetMinutes: number): string {
  return `period=${encodeURIComponent(period)}&tz_offset_minutes=${Math.trunc(tzOffsetMinutes)}`;
}