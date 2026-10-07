import { createHash } from 'node:crypto';
import type { RecapAggregates, RecapSummary } from './recap';

// The prompt is built entirely from the aggregates, so identical aggregates
// always produce an equivalent summary. Two people reopening the same screen
// (or the same screen reloading after a navigation) used to pay for a brand
// new LLM call every time.
const RECAP_SUMMARY_TTL_MS = 30 * 60_000;
const RECAP_SUMMARY_MAX_ENTRIES = 100;

interface CacheEntry {
  summary: RecapSummary;
  expiresAt: number;
}

const entries = new Map<string, CacheEntry>();

/**
 * Content-addressed: the key carries no pair id on purpose, only what the
 * model was actually asked. The names are part of the aggregates, so two
 * different couples cannot collide unless every number and both names match —
 * in which case the summary would be correct for both anyway.
 */
export function recapSummaryCacheKey(aggregates: RecapAggregates): string {
  return createHash('sha256').update(JSON.stringify(aggregates)).digest('hex');
}

export function getCachedRecapSummary(key: string, now: number = Date.now()): RecapSummary | null {
  const entry = entries.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= now) {
    entries.delete(key);
    return null;
  }
  return entry.summary;
}

export function setCachedRecapSummary(key: string, summary: RecapSummary, now: number = Date.now()): void {
  entries.set(key, { summary, expiresAt: now + RECAP_SUMMARY_TTL_MS });
  // Map preserves insertion order, so the first key is the oldest one.
  while (entries.size > RECAP_SUMMARY_MAX_ENTRIES) {
    const oldest = entries.keys().next();
    if (oldest.done) break;
    entries.delete(oldest.value);
  }
}

export function clearRecapSummaryCache(): void {
  entries.clear();
}
