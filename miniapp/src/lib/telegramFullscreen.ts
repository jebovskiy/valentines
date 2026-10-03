import { useCallback, useEffect, useState } from 'react';
import { APP_BACKGROUND_COLOR, type TelegramWebApp } from '../utils/telegram';

/**
 * Обёртка над Bot API 8.0: полноэкранный режим и безопасные зоны.
 *
 * Важно: `window.Telegram.WebApp` читается лениво (в момент вызова), а не на
 * уровне модуля — тогда модуль можно импортировать в обычном браузере, в
 * юнит-тестах и до загрузки скрипта Telegram без падений.
 */

/** Полноэкранный режим включён только на мобильных клиентах: на Desktop/Web его нет. */
const MOBILE_PLATFORMS = ['android', 'ios'];

/** Ключ пользовательского выбора в Настройках: 'auto' | 'on' | 'off'. */
export const FULLSCREEN_PREF_KEY = 'vn_fullscreen_pref';

export type FullscreenPreference = 'auto' | 'on' | 'off';

export function resolveWebApp(): TelegramWebApp | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.Telegram?.WebApp;
}

function isAtLeast(app: TelegramWebApp, version: string): boolean {
  try {
    return app.isVersionAtLeast?.(version) === true;
  } catch {
    return false;
  }
}

/** Никогда не бросает: старые клиенты и обычный браузер — это норма. */
function safeCall(fn: () => void): void {
  try {
    fn();
  } catch (error) {
    warnDev('WebApp call failed', error);
  }
}

/**
 * `import.meta.env` есть только под Vite (в тестах и Node его может не быть),
 * поэтому DEV проверяем мягко — иначе сам лог стал бы источником падений.
 */
function warnDev(message: string, detail?: unknown): void {
  if (import.meta.env?.DEV) {
    console.warn(`[telegram] ${message}`, detail);
  }
}

export function isFullscreenSupported(app: TelegramWebApp | undefined = resolveWebApp()): boolean {
  if (!app) return false;
  return MOBILE_PLATFORMS.includes(app.platform) && isAtLeast(app, '8.0');
}

export function readFullscreenPreference(): FullscreenPreference {
  try {
    const raw = window.localStorage.getItem(FULLSCREEN_PREF_KEY);
    return raw === 'on' || raw === 'off' ? raw : 'auto';
  } catch {
    return 'auto';
  }
}

export function writeFullscreenPreference(pref: FullscreenPreference): void {
  try {
    window.localStorage.setItem(FULLSCREEN_PREF_KEY, pref);
  } catch {
    /* приватный режим — просто не сохраняем */
  }
}

/**
 * Стартовый вход в мини-апп: готовность, expand, полный экран на мобильных,
 * запрет свайпа сверху и цвета шапки. Вызывается один раз до рендера.
 * Вне Telegram и на клиентах старше 8.0 — мягкий no-op.
 */
export function initFullscreen(): void {
  const app = resolveWebApp();
  if (!app) return;

  safeCall(() => app.ready());
  safeCall(() => app.expand());
  safeCall(() => app.setHeaderColor(APP_BACKGROUND_COLOR));
  safeCall(() => app.setBackgroundColor(APP_BACKGROUND_COLOR));

  // 7.7+: без этого жест «потянуть вниз» сворачивает приложение.
  if (isAtLeast(app, '7.7')) {
    safeCall(() => app.disableVerticalSwipes?.());
  }

  const onFullscreenFailed = (error: unknown) => {
    warnDev('requestFullscreen was rejected', error);
  };
  safeCall(() => app.onEvent('fullscreenFailed', onFullscreenFailed));

  const preference = readFullscreenPreference();
  if (preference === 'off') return;
  // Гейт по клиенту общий для 'auto' и 'on': на Desktop/Web и клиентах старше
  // 8.0 запрос не отправляем никогда, даже если пользователь выбрал 'on'.
  if (!isFullscreenSupported(app)) return;

  if (app.isFullscreen !== true) {
    safeCall(() => app.requestFullscreen?.());
  }
}

export interface FullscreenState {
  /** Клиент умеет полный экран (мобильный + 8.0+). */
  supported: boolean;
  isFullscreen: boolean;
  /** Включить/выключить полный экран и запомнить выбор. */
  setEnabled: (enabled: boolean) => void;
}

/** Состояние полноэкранного режима для Настроек: живёт по событию fullscreenChanged. */
export function useFullscreen(): FullscreenState {
  const [supported, setSupported] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const app = resolveWebApp();
    if (!app) return;

    setSupported(isFullscreenSupported(app));
    setIsFullscreen(app.isFullscreen === true);

    const sync = () => setIsFullscreen(resolveWebApp()?.isFullscreen === true);
    app.onEvent('fullscreenChanged', sync);
    return () => {
      try {
        app.offEvent('fullscreenChanged', sync);
      } catch {
        /* клиент мог выгрузиться раньше cleanup */
      }
    };
  }, []);

  const setEnabled = useCallback((enabled: boolean) => {
    writeFullscreenPreference(enabled ? 'on' : 'off');
    const app = resolveWebApp();
    if (!app) return;
    if (!isFullscreenSupported(app)) return;
    if (enabled) safeCall(() => app.requestFullscreen?.());
    else safeCall(() => app.exitFullscreen?.());
  }, []);

  return { supported, isFullscreen, setEnabled };
}