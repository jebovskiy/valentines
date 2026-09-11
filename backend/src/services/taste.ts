import type { AspectScoreKey } from './gemini';

export type AspectKey = AspectScoreKey;

export interface AspectWeights {
  visual: number;
  plot: number;
  acting: number;
  music: number;
  atmosphere: number;
  humor: number;
  [key: string]: number;
}

export const DEFAULT_ASPECT_WEIGHTS: AspectWeights = {
  visual: 3,
  plot: 3,
  acting: 3,
  music: 3,
  atmosphere: 3,
  humor: 3,
};

export function computeCompatibility(weights: Record<string, number>, scores: Record<string, number>): number {
  let weightedSum = 0;
  let weightTotal = 0;

  const keys: AspectKey[] = ['visual', 'plot', 'acting', 'music', 'atmosphere', 'humor'];
  for (const aspect of keys) {
    const weight = weights[aspect] ?? 3;
    const score = scores[aspect];
    weightedSum += weight * score;
    weightTotal += weight * 5;
  }
  if (weightTotal === 0) return 0;
  return Math.max(0, Math.min(100, Math.round((weightedSum / weightTotal) * 100)));
}

export function normalizeWeights(raw: unknown): AspectWeights {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_ASPECT_WEIGHTS };
  const obj = raw as Record<string, unknown>;
  const keys: AspectKey[] = ['visual', 'plot', 'acting', 'music', 'atmosphere', 'humor'];
  const result: Partial<AspectWeights> = {};
  for (const key of keys) {
    const v = obj[key];
    result[key] = typeof v === 'number' && Number.isFinite(v) ? Math.max(1, Math.min(5, Math.round(v))) : 3;
  }
  return result as AspectWeights;
}
