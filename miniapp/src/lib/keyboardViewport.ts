import { resolveWebApp } from './telegramFullscreen';

/**
 * Клавиатура и визуальный вьюпорт.
 *
 * Воспроизводимый в коде случай: bottom-sheet «Ваш отзыв» в MoviesScreen —
 * `position: fixed` c `<textarea>` внутри. Клавиатура в полноэкранном режиме не
 * уменьшает layout viewport, поэтому такая шторка остаётся под ней. Лечится
 * двумя связанными вещами:
 *
 *  1) `--app-viewport-height` синхронизируется с реальной высотой вьюпорта из
 *     события Telegram, поэтому слой, привязанный к низу, оказывается ровно над
 *     клавиатурой (и возвращается на место, когда она закрыта);
 *  2) сфокусированное текстовое поле подтягивается в видимую область.
 *
 * Вне Telegram события `viewportChanged` нет — поведение в браузере и на старых
 * клиентах не меняется.
 */

const VIEWPORT_EVENT = 'viewportChanged';

/** Насколько вьюпорт должен сократиться, чтобы считать это клавиатурой. */
const KEYBOARD_THRESHOLD_PX = 120;

let initialized = false;
let lastHeight: number | null = null;

function isTextField(node: Element | null): node is HTMLElement {
  if (!(node instanceof HTMLElement)) return false;
  return node.tagName === 'INPUT' || node.tagName === 'TEXTAREA' || node.isContentEditable;
}

/** Обновляет CSS-переменную и признак открытой клавиатуры. */
function applyViewportHeight(height: number): void {
  const root = document.documentElement;
  root.style.setProperty('--app-viewport-height', `${Math.round(height)}px`);

  const keyboardOpen = lastHeight !== null && lastHeight - height > KEYBOARD_THRESHOLD_PX;
  root.dataset.keyboard = keyboardOpen ? 'open' : 'closed';
  lastHeight = height;
}

/**
 * Держит сфокусированное поле в видимой области: у fixed-контейнеров
 * скроллится сам контейнер, у обычных страниц — документ.
 */
function keepFocusedFieldVisible(keyboardOpen: boolean): void {
  const active = document.activeElement;
  if (!isTextField(active)) return;
  if (!active.isConnected) return;
  active.scrollIntoView({ block: 'center', behavior: keyboardOpen ? 'smooth' : 'auto' });
}

/**
 * Одноразовая подписка на `viewportChanged`. Вызывается из `main.tsx` до рендера.
 * Вне Telegram и на клиентах без события — мягкий no-op.
 */
export function initKeyboardViewport(): void {
  if (initialized) return;
  const app = resolveWebApp();
  if (!app || typeof app.onEvent !== 'function') return;
  initialized = true;

  try {
    app.onEvent(VIEWPORT_EVENT, (state?: unknown) => {
      const height = (state as { height?: number } | undefined)?.height;
      const keyboardOpen =
        typeof height === 'number' &&
        height > 0 &&
        lastHeight !== null &&
        lastHeight - height > KEYBOARD_THRESHOLD_PX;

      if (typeof height === 'number' && height > 0) applyViewportHeight(height);

      requestAnimationFrame(() => keepFocusedFieldVisible(keyboardOpen));
    });
  } catch {
    initialized = false;
  }
}