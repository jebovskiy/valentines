import { useCallback, useEffect, useState } from 'react';
import type { AddToHomeScreenResult, HomeScreenStatus, TelegramWebApp } from '../utils/telegram';
import { resolveWebApp } from './telegramFullscreen';

/**
 * Предложение добавить ярлык на рабочий стол (Bot API 8.0).
 *
 * Всё, что можно решить без React, вынесено в чистые функции: их покрывают
 * юнит-тесты с подменённым `window.Telegram.WebApp`. Хук — тонкая обвязка над
 * ними, а источник данных (Telegram/localStorage) внедряется, поэтому приватный
 * режим браузера и старые клиенты не приводят к падениям.
 *
 * Ярлык на рабочем стол — фича мобильных клиентов 8.0+, поэтому на Desktop/Web и
 * в браузере баннер не показывается вовсе.
 */

/** Неделя «не сейчас», после которой предложение можно повторить. */
export const HOME_SCREEN_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

const HOME_SCREEN_RECORD_KEY = 'vn_home_screen_prompt';

const MOBILE_PLATFORMS = ['android', 'ios'];

export interface HomeScreenRecord {
  /** `added` — ярлык уже установлен, больше не предлагаем. */
  state: 'added' | 'dismissed';
  ts: number;
}

export interface HomeScreenStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStorage(): HomeScreenStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Ответ Telegram, либо `unknown`, если клиент вернул что-то неожиданное. */
export type HomeScreenAddOutcome = AddToHomeScreenResult | 'unknown';

export function readHomeScreenRecord(storage: HomeScreenStorage | null = browserStorage()): HomeScreenRecord | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(HOME_SCREEN_RECORD_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const { state, ts } = parsed as { state?: unknown; ts?: unknown };
    if (state !== 'added' && state !== 'dismissed') return null;
    if (typeof ts !== 'number' || !Number.isFinite(ts)) return null;
    return { state, ts };
  } catch {
    return null;
  }
}

export function writeHomeScreenRecord(record: HomeScreenRecord, storage: HomeScreenStorage | null = browserStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(HOME_SCREEN_RECORD_KEY, JSON.stringify(record));
  } catch {
    /* приватный режим — просто не сохраняем */
  }
}

/** Ярлык умеют только мобильные клиенты Bot API 8.0+. */
export function isHomeScreenSupported(app: TelegramWebApp | undefined = resolveWebApp()): boolean {
  if (!app) return false;
  if (!MOBILE_PLATFORMS.includes(app.platform)) return false;
  return typeof app.addToHomeScreen === 'function' || typeof app.checkHomeScreenStatus === 'function';
}

export interface HomeScreenPromptState {
  /** null, пока статус неизвестен (или клиент не поддерживает фичу). */
  status: HomeScreenStatus | null;
  visible: boolean;
  busy: boolean;
}

export const INITIAL_HOME_SCREEN_PROMPT: HomeScreenPromptState = {
  status: null,
  visible: false,
  busy: false,
};

export function shouldShowHomeScreenPrompt(params: {
  status: HomeScreenStatus;
  record: HomeScreenRecord | null;
  now: number;
}): boolean {
  const { status, record, now } = params;
  if (status === 'unsupported') return false;
  if (status === 'added') return false;
  if (record?.state === 'added') return false;
  if (record?.state === 'dismissed' && now - record.ts < HOME_SCREEN_COOLDOWN_MS) return false;
  return true;
}

export function stateAfterStatus(
  status: HomeScreenStatus,
  record: HomeScreenRecord | null,
  now: number
): HomeScreenPromptState {
  return { status, visible: shouldShowHomeScreenPrompt({ status, record, now }), busy: false };
}

/** Что запомнить по итогам нажатия «Добавить»: успех — навсегда, отказ — на неделю. */
export function recordAfterAddOutcome(outcome: HomeScreenAddOutcome, now: number): HomeScreenRecord | null {
  if (outcome === 'added' || outcome === 'already') return { state: 'added', ts: now };
  if (outcome === 'missed') return { state: 'dismissed', ts: now };
  return null;
}

export function stateAfterAddOutcome(
  current: HomeScreenPromptState,
  outcome: HomeScreenAddOutcome
): HomeScreenPromptState {
  if (outcome === 'added' || outcome === 'already') return { status: 'added', visible: false, busy: false };
  if (outcome === 'unsupported') return { status: 'unsupported', visible: false, busy: false };
  // Отказ или неизвестный ответ: прячем до конца недели, чтобы не доставать.
  if (outcome === 'missed') return { status: current.status ?? 'missed', visible: false, busy: false };
  // Неопределённый ответ (исключение/старый клиент) — баннер оставляем, чтобы
  // пользователь мог попробовать ещё раз.
  return { ...current, busy: false };
}

export function recordAfterDismiss(now: number): HomeScreenRecord {
  return { state: 'dismissed', ts: now };
}

/** Обёртка над `checkHomeScreenStatus`: никогда не бросает. */
export function checkHomeScreenStatus(
  app: TelegramWebApp,
  callback: (status: HomeScreenStatus) => void
): void {
  if (typeof app.checkHomeScreenStatus !== 'function') {
    callback('unsupported');
    return;
  }
  try {
    app.checkHomeScreenStatus((status) => callback(status ?? 'unknown'));
  } catch {
    callback('unsupported');
  }
}

export interface HomeScreenPrompt extends HomeScreenPromptState {
  /** Нажали «Добавить»: вызывает Bot API и гасит баннер по итогу. */
  add: () => Promise<void>;
  /** Нажали «Не сейчас»: баннер вернётся через неделю. */
  dismiss: () => void;
}

/** Состояние баннера для <AddToHomeBanner />. */
export function useHomeScreenPrompt(): HomeScreenPrompt {
  const [state, setState] = useState<HomeScreenPromptState>(INITIAL_HOME_SCREEN_PROMPT);

  useEffect(() => {
    const app = resolveWebApp();
    if (!isHomeScreenSupported(app)) return;

    let cancelled = false;
    checkHomeScreenStatus(app!, (status) => {
      if (cancelled) return;
      setState(stateAfterStatus(status, readHomeScreenRecord(), Date.now()));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const add = useCallback(async () => {
    const app = resolveWebApp();
    if (typeof app?.addToHomeScreen !== 'function') return;

    setState((current) => ({ ...current, busy: true }));
    const now = Date.now();

    let outcome: HomeScreenAddOutcome = 'unknown';
    try {
      outcome = (await app.addToHomeScreen()) ?? 'unknown';
    } catch {
      outcome = 'unknown';
    }

    const record = recordAfterAddOutcome(outcome, now);
    if (record) writeHomeScreenRecord(record);
    setState((current) => stateAfterAddOutcome(current, outcome));
  }, []);

  const dismiss = useCallback(() => {
    writeHomeScreenRecord(recordAfterDismiss(Date.now()));
    setState((current) => ({ ...current, visible: false, busy: false }));
  }, []);

  return { ...state, add, dismiss };
}