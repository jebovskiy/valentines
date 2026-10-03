import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FULLSCREEN_PREF_KEY,
  initFullscreen,
  isFullscreenSupported,
  readFullscreenPreference,
  writeFullscreenPreference,
} from '../src/lib/telegramFullscreen';

interface FakeOptions {
  version?: string;
  platform?: string;
  fullscreenMethods?: boolean;
  swipeGate?: string | null;
  isFullscreen?: boolean;
  requestThrows?: boolean;
}

interface FakeWebApp {
  platform: string;
  version: string;
  ready: () => void;
  expand: () => void;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
  disableVerticalSwipes?: () => void;
  isVersionAtLeast?: (version: string) => boolean;
  isFullscreen?: boolean;
  requestFullscreen?: () => void;
  exitFullscreen?: () => void;
  onEvent: (type: string, cb: (arg?: unknown) => void) => void;
  calls: string[];
  emit: (type: string, arg?: unknown) => void;
}

function createFakeWebApp(options: FakeOptions = {}): FakeWebApp {
  const {
    version = '8.0',
    platform = 'android',
    fullscreenMethods = true,
    swipeGate = '7.7',
    isFullscreen = false,
    requestThrows = false,
  } = options;

  const handlers = new Map<string, (arg?: unknown) => void>();
  const calls: string[] = [];

  const app: FakeWebApp = {
    platform,
    version,
    calls,
    ready: () => calls.push('ready'),
    expand: () => calls.push('expand'),
    setHeaderColor: (color: string) => calls.push(`header:${color}`),
    setBackgroundColor: (color: string) => calls.push(`background:${color}`),
    isFullscreen,
    onEvent: (type, cb) => handlers.set(type, cb),
    emit: (type, arg) => handlers.get(type)?.(arg),
  };

  if (swipeGate) {
    app.isVersionAtLeast = (v: string) => compareVersions(version, v) >= 0;
    app.disableVerticalSwipes = () => calls.push('swipesDisabled');
  }
  if (fullscreenMethods) {
    app.requestFullscreen = () => {
      calls.push('requestFullscreen');
      if (requestThrows) throw new Error('user cancelled');
    };
    app.exitFullscreen = () => calls.push('exitFullscreen');
  }

  return app;
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i += 1) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  }
  return 0;
}

/** Минимальный window: localStorage в памяти + подменяемый WebApp. */
function installWindow(webApp: unknown | undefined): { restore: () => void; storage: Map<string, string> } {
  const store = new Map<string, string>();
  const previous = (globalThis as { window?: unknown }).window;

  (globalThis as { window?: unknown }).window = {
    Telegram: webApp === undefined ? undefined : { WebApp: webApp },
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
    },
  };

  return {
    storage: store,
    restore: () => {
      if (previous === undefined) delete (globalThis as { window?: unknown }).window;
      else (globalThis as { window?: unknown }).window = previous;
    },
  };
}

test('старый клиент: fullscreen не запрашивается, ошибок нет', () => {
  const app = createFakeWebApp({ version: '6.9', fullscreenMethods: false, swipeGate: null });
  const env = installWindow(app);
  try {
    initFullscreen();
    assert.deepEqual(app.calls, ['ready', 'expand', 'header:#fbfbf9', 'background:#fbfbf9']);
    assert.equal(isFullscreenSupported(app as never), false);
  } finally {
    env.restore();
  }
});

test('7.7+ отключает pull-to-dismiss, мобильный 8.0 запрашивает fullscreen', () => {
  const app = createFakeWebApp();
  const env = installWindow(app);
  try {
    initFullscreen();
    assert.ok(app.calls.includes('swipesDisabled'));
    assert.equal(app.calls.filter((c) => c === 'requestFullscreen').length, 1);
  } finally {
    env.restore();
  }
});

test('desktop и web не получают requestFullscreen даже с сохранённым on', () => {
  for (const platform of ['tdesktop', 'weba', 'macos']) {
    const app = createFakeWebApp({ platform });
    const env = installWindow(app);
    try {
      writeFullscreenPreference('on');
      initFullscreen();
      assert.equal(app.calls.includes('requestFullscreen'), false, platform);
    } finally {
      env.restore();
    }
  }
});

test('уже полноэкранный режим: повторный запрос не отправляется', () => {
  const app = createFakeWebApp({ isFullscreen: true });
  const env = installWindow(app);
  try {
    initFullscreen();
    assert.equal(app.calls.includes('requestFullscreen'), false);
  } finally {
    env.restore();
  }
});

test('отказ пользователя в настройках блокирует запрос на старте', () => {
  const app = createFakeWebApp();
  const env = installWindow(app);
  try {
    writeFullscreenPreference('off');
    initFullscreen();
    assert.equal(app.calls.includes('requestFullscreen'), false);
  } finally {
    env.restore();
  }
});

test('исключение от requestFullscreen не ломает инициализацию', () => {
  const app = createFakeWebApp({ requestThrows: true });
  const env = installWindow(app);
  const warnings: unknown[][] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => warnings.push(args);
  try {
    initFullscreen();
    assert.ok(app.calls.includes('requestFullscreen'));
    assert.equal(warnings.length, 1);
    assert.match(String(warnings[0][1]), /cancelled/);
  } finally {
    console.warn = originalWarn;
    env.restore();
  }
});

test('событие fullscreenFailed не бросает исключение', () => {
  const app = createFakeWebApp();
  const env = installWindow(app);
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    initFullscreen();
    assert.doesNotThrow(() => app.emit('fullscreenFailed', { name: 'x' }));
  } finally {
    console.warn = originalWarn;
    env.restore();
  }
});

test('вне Telegram (нет window.Telegram) — полный no-op', () => {
  const env = installWindow(undefined);
  try {
    assert.doesNotThrow(() => initFullscreen());
    assert.equal(isFullscreenSupported(), false);
  } finally {
    env.restore();
  }
});

test('выбор пользователя переживает чтение/запись и битый JSON', () => {
  const env = installWindow(createFakeWebApp());
  try {
    assert.equal(readFullscreenPreference(), 'auto');
    writeFullscreenPreference('off');
    assert.equal(env.storage.get(FULLSCREEN_PREF_KEY), 'off');
    assert.equal(readFullscreenPreference(), 'off');
    env.storage.set(FULLSCREEN_PREF_KEY, 'nonsense');
    assert.equal(readFullscreenPreference(), 'auto');
  } finally {
    env.restore();
  }
});