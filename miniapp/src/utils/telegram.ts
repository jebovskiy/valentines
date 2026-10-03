import { TelegramUser } from '../types';

declare global {
  interface Window {
    Telegram: {
      WebApp: TelegramWebApp;
    };
  }
}

/** Bot API 8.0 home-screen states reported by `checkHomeScreenStatus`. */
export type HomeScreenStatus = 'added' | 'missed' | 'unknown' | 'unsupported';

/** Bot API 8.0 result of `addToHomeScreen()`. */
export type AddToHomeScreenResult = 'added' | 'missed' | 'unsupported' | 'already';

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: TelegramUser;
    query_id?: string;
    auth_date?: number;
    hash?: string;
  };
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: ThemeParams;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  headerColor: string;
  backgroundColor: string;
  isClosingConfirmationEnabled: boolean;
  /** Bot API 6.9+ — feature gate for everything below. */
  isVersionAtLeast?: (version: string) => boolean;
  /** Bot API 7.7 — hides the pull-to-dismiss gesture. */
  disableVerticalSwipes?: () => void;
  /** Bot API 8.0 — true while the mini app occupies the whole screen. */
  isFullscreen?: boolean;
  requestFullscreen?: () => void;
  exitFullscreen?: () => void;
  /** Bot API 8.0 — adds a home-screen shortcut. */
  addToHomeScreen?: () => Promise<AddToHomeScreenResult>;
  /** Bot API 8.0 — reports whether the shortcut is already installed. */
  checkHomeScreenStatus?: (callback: (status: HomeScreenStatus) => void) => void;
  BackButton: BackButton;
  MainButton: MainButton;
  SettingsButton: SettingsButton;
  HapticFeedback: HapticFeedback;
  CloudStorage: CloudStorage;
  BiometricManager: BiometricManager;
  ready: () => void;
  expand: () => void;
  close: () => void;
  requestLocation?: (callback?: (location: { latitude: number; longitude: number } | null) => void) => void;
  onEvent: (eventType: string, callback: (arg?: unknown) => void) => void;
  offEvent: (eventType: string, callback: (arg?: unknown) => void) => void;
  sendData: (data: string) => void;
  switchInlineQuery: (query: string, choose_chat_types?: string[]) => void;
  openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
  openTelegramLink: (url: string) => void;
  openInvoice: (url: string, callback?: (status: string) => void) => void;
  showPopup: (params: PopupParams, callback?: (buttonId: string) => void) => void;
  showAlert: (message: string, callback?: () => void) => void;
  showConfirm: (message: string, callback?: (confirmed: boolean) => void) => void;
  showScanQrPopup: (params: ScanQrParams, callback?: (text: string) => void) => void;
  closeScanQrPopup: () => void;
  readTextFromClipboard: (callback?: (text: string) => void) => void;
  requestWriteAccess: (callback?: (granted: boolean) => void) => void;
  requestContact: (callback?: (granted: boolean) => void) => void;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
  enableClosingConfirmation: () => void;
  disableClosingConfirmation: () => void;
}

export interface ThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
}

export interface BackButton {
  isVisible: boolean;
  onClick: (callback: () => void) => void;
  offClick: (callback?: () => void) => void;
  show: () => void;
  hide: () => void;
}

export interface MainButton {
  text: string;
  color: string;
  textColor: string;
  isVisible: boolean;
  isActive: boolean;
  isProgressVisible: boolean;
  setText: (text: string) => MainButton;
  onClick: (callback: () => void) => MainButton;
  offClick: (callback: () => void) => MainButton;
  show: () => MainButton;
  hide: () => MainButton;
  enable: () => MainButton;
  disable: () => MainButton;
  showProgress: (leaveActive?: boolean) => MainButton;
  hideProgress: () => MainButton;
  setParams: (params: { color?: string; text_color?: string; is_active?: boolean; is_visible?: boolean }) => MainButton;
}

export interface SettingsButton {
  isVisible: boolean;
  onClick: (callback: () => void) => void;
  offClick: (callback: () => void) => void;
  show: () => void;
  hide: () => void;
}

export interface HapticFeedback {
  impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
  notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
  selectionChanged: () => void;
}

export interface CloudStorage {
  setItem: (key: string, value: string, callback?: (error: Error | null, result: boolean) => void) => void;
  getItem: (key: string, callback?: (error: Error | null, result: string | null) => void) => void;
  getItems: (keys: string[], callback?: (error: Error | null, result: Record<string, string>) => void) => void;
  removeItem: (key: string, callback?: (error: Error | null, result: boolean) => void) => void;
  removeItems: (keys: string[], callback?: (error: Error | null, result: boolean) => void) => void;
  getKeys: (callback?: (error: Error | null, result: string[]) => void) => void;
}

export interface BiometricManager {
  isInited: boolean;
  isBiometricAvailable: boolean;
  biometricType: 'fingerprint' | 'face' | 'unknown' | null;
  init: (callback?: (isBiometricAvailable: boolean, biometricType: string) => void) => void;
  requestAccess: (params: { reason?: string }, callback?: (accessGranted: boolean, accessError: Error | null) => void) => void;
  authenticate: (params: { reason?: string }, callback?: (authenticated: boolean, authError: Error | null) => void) => void;
}

export interface PopupParams {
  title?: string;
  message: string;
  buttons: Array<{ id: string; type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive'; text: string }>;
}

export interface ScanQrParams {
  text?: string;
}

export const webApp = window.Telegram?.WebApp;

/** Фон приложения: он же уходит в шапку Telegram (setHeaderColor). */
export const APP_BACKGROUND_COLOR = '#fbfbf9';

export function getInitData(): string {
  return webApp?.initData || '';
}

export function getTelegramUser(): TelegramUser | null {
  return webApp?.initDataUnsafe?.user || null;
}

/** Telegram-provided profile photo from initData — loads reliably in the WebView. */
export function getTelegramSelfPhotoUrl(): string | null {
  return webApp?.initDataUnsafe?.user?.photo_url || null;
}

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

/**
 * Request the user's geolocation. Tries the Telegram Mini App
 * `requestLocation` API first (if the client supports it), falls back to
 * the browser Geolocation API. Never throws.
 */
export function requestGeolocation(): Promise<GeoPoint | null> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (point: GeoPoint | null) => {
      if (!settled) {
        settled = true;
        resolve(point);
      }
    };

    const tryBrowser = () => {
      if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => done({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
          () => done(null),
          { timeout: 10000, maximumAge: 600000 },
        );
      } else {
        done(null);
      }
    };

    if (typeof webApp?.requestLocation === 'function') {
      let telegramHandled = false;
      try {
        webApp.requestLocation((location) => {
          if (!telegramHandled) {
            telegramHandled = true;
            done(location ?? null);
          }
        });
      } catch {
        telegramHandled = true;
      }
      // Telegram may be present but never invoke the callback (older
      // clients / desktop). Give it one window, then try the browser API.
      setTimeout(() => {
        if (!telegramHandled) {
          telegramHandled = true;
          tryBrowser();
        }
      }, 1200);
    } else {
      tryBrowser();
    }
  });
}

export function setMainButton(params: { text?: string; onClick?: () => void; isVisible?: boolean; color?: string }): void {
  if (!webApp?.MainButton) return;
  const btn = webApp.MainButton;
  if (params.text) btn.setText(params.text);
  if (params.onClick) btn.onClick(params.onClick);
  if (params.color) btn.setParams({ color: params.color });
  if (params.isVisible !== false) btn.show();
  else btn.hide();
}

export function hideMainButton(): void {
  webApp?.MainButton?.hide();
}

interface BackButtonEntry {
  visible: boolean;
  onClick?: () => void;
}

let baseBackButton: BackButtonEntry = { visible: false };
const overlayBackButtons: BackButtonEntry[] = [];

export function setBackButton(visible: boolean, onClick?: () => void): void {
  baseBackButton = { visible, onClick };
  applyBackButton();
}

/** Навешивает свой обработчик поверх текущего, не ломая базовый (для оверлеев типа bottom-sheet). */
export function pushBackButton(onClick: () => void): void {
  overlayBackButtons.push({ visible: true, onClick });
  applyBackButton();
}

/** Снимает временный обработчик и возвращает базовый (установленный экраном). */
export function popBackButton(): void {
  overlayBackButtons.pop();
  applyBackButton();
}

function applyBackButton(): void {
  if (!webApp?.BackButton) return;
  const entry = overlayBackButtons.length ? overlayBackButtons[overlayBackButtons.length - 1] : baseBackButton;
  webApp.BackButton.offClick();
  if (entry.visible) {
    webApp.BackButton.show();
    if (entry.onClick) webApp.BackButton.onClick(entry.onClick);
  } else {
    webApp.BackButton.hide();
  }
}

export function hapticFeedback(type: 'impact' | 'notification' | 'selection', style?: string): void {
  if (!webApp?.HapticFeedback) return;
  if (type === 'impact') webApp.HapticFeedback.impactOccurred(style as any);
  else if (type === 'notification') webApp.HapticFeedback.notificationOccurred(style as any);
  else webApp.HapticFeedback.selectionChanged();
}

export function applyTheme(): void {
  if (!webApp) return;
  webApp.setHeaderColor(APP_BACKGROUND_COLOR);
  webApp.setBackgroundColor(APP_BACKGROUND_COLOR);
}