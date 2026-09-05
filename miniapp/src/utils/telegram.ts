import { TelegramUser } from '../types';

declare global {
  interface Window {
    Telegram: {
      WebApp: TelegramWebApp;
    };
  }
}

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
  BackButton: BackButton;
  MainButton: MainButton;
  SettingsButton: SettingsButton;
  HapticFeedback: HapticFeedback;
  CloudStorage: CloudStorage;
  BiometricManager: BiometricManager;
  ready: () => void;
  expand: () => void;
  close: () => void;
  addToHomeScreen: () => void;
  onEvent: (eventType: string, callback: () => void) => void;
  offEvent: (eventType: string, callback: () => void) => void;
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
  offClick: (callback: () => void) => void;
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

export function initTelegramWebApp(): void {
  if (webApp) {
    webApp.ready();
    webApp.expand();
  }
}

export function getInitData(): string {
  return webApp?.initData || '';
}

export function getTelegramUser(): TelegramUser | null {
  return webApp?.initDataUnsafe?.user || null;
}

export function setMainButton(params: { text: string; onClick: () void; isVisible?: boolean; color?: string }): void {
  if (!webApp?.MainButton) return;
  const btn = webApp.MainButton;
  btn.setText(params.text);
  btn.onClick(params.onClick);
  if (params.color) btn.setParams({ color: params.color });
  if (params.isVisible !== false) btn.show();
  else btn.hide();
}

export function hideMainButton(): void {
  webApp?.MainButton?.hide();
}

export function setBackButton(visible: boolean, onClick?: () => void): void {
  if (!webApp?.BackButton) return;
  if (visible) {
    webApp.BackButton.show();
    if (onClick) webApp.BackButton.onClick(onClick);
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
  const { themeParams } = webApp;
  const root = document.documentElement;
  if (themeParams.bg_color) root.style.setProperty('--tg-bg-color', themeParams.bg_color);
  if (themeParams.text_color) root.style.setProperty('--tg-text-color', themeParams.text_color);
  if (themeParams.hint_color) root.style.setProperty('--tg-hint-color', themeParams.hint_color);
  if (themeParams.link_color) root.style.setProperty('--tg-link-color', themeParams.link_color);
  if (themeParams.button_color) root.style.setProperty('--tg-button-color', themeParams.button_color);
  if (themeParams.button_text_color) root.style.setProperty('--tg-button-text-color', themeParams.button_text_color);
  if (themeParams.secondary_bg_color) root.style.setProperty('--tg-secondary-bg-color', themeParams.secondary_bg_color);
  root.style.setProperty('--tg-color-scheme', webApp.colorScheme);
}