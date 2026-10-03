import assert from 'node:assert/strict';
import test from 'node:test';

import {
  HOME_SCREEN_COOLDOWN_MS,
  checkHomeScreenStatus,
  createHomeScreenPromptController,
  isHomeScreenSupported,
  readHomeScreenRecord,
  recordAfterAddOutcome,
  recordAfterDismiss,
  shouldShowHomeScreenPrompt,
  stateAfterAddOutcome,
  writeHomeScreenRecord,
  type HomeScreenStorage,
} from '../src/lib/homeScreen';

const DAY = 24 * 60 * 60 * 1000;

function createStorage(initial: Record<string, string> = {}): HomeScreenStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
}

interface FakeOptions {
  platform?: string;
  status?: 'added' | 'missed' | 'unknown' | 'unsupported';
  addResult?: 'added' | 'missed' | 'already' | 'unsupported' | 'unknown';
  addThrows?: boolean;
  hasMethods?: boolean;
  statusThrows?: boolean;
}

function createFakeApp(options: FakeOptions = {}) {
  const {
    platform = 'android',
    status = 'missed',
    addResult = 'added',
    addThrows = false,
    hasMethods = true,
    statusThrows = false,
  } = options;

  const calls: string[] = [];
  const app: Record<string, unknown> = {
    platform,
    calls,
    version: '8.0',
    isVersionAtLeast: () => true,
    onEvent: () => {},
  };

  if (hasMethods) {
    app.checkHomeScreenStatus = (cb: (s: string) => void) => {
      calls.push('checkHomeScreenStatus');
      if (statusThrows) throw new Error('boom');
      cb(status);
    };
    app.addToHomeScreen = async () => {
      calls.push('addToHomeScreen');
      if (addThrows) throw new Error('boom');
      return addResult;
    };
  }

  return app as never as Parameters<typeof isHomeScreenSupported>[0] & { calls: string[] };
}

test('видимость баннера по статусу и кулдауну', () => {
  const now = 1_000 * DAY;
  assert.equal(shouldShowHomeScreenPrompt({ status: 'missed', record: null, now }), true);
  assert.equal(shouldShowHomeScreenPrompt({ status: 'unknown', record: null, now }), true);
  assert.equal(shouldShowHomeScreenPrompt({ status: 'added', record: null, now }), false);
  assert.equal(shouldShowHomeScreenPrompt({ status: 'unsupported', record: null, now }), false);
  assert.equal(
    shouldShowHomeScreenPrompt({ status: 'missed', record: { state: 'added', ts: now }, now }),
    false
  );
  assert.equal(
    shouldShowHomeScreenPrompt({ status: 'missed', record: { state: 'dismissed', ts: now - DAY }, now }),
    false
  );
  assert.equal(
    shouldShowHomeScreenPrompt({
      status: 'missed',
      record: { state: 'dismissed', ts: now - HOME_SCREEN_COOLDOWN_MS - 1000 },
      now,
    }),
    true
  );
});

test('поддержка фичи: только мобильные клиенты с методами 8.0+', () => {
  assert.equal(isHomeScreenSupported(createFakeApp({ platform: 'android' })), true);
  assert.equal(isHomeScreenSupported(createFakeApp({ platform: 'tdesktop' })), false);
  assert.equal(isHomeScreenSupported(createFakeApp({ platform: 'weba' })), false);
  assert.equal(isHomeScreenSupported(createFakeApp({ hasMethods: false })), false);
  assert.equal(isHomeScreenSupported(undefined), false);
});

test('checkHomeScreenStatus не бросает на старых клиентах', () => {
  const seen: string[] = [];
  checkHomeScreenStatus(createFakeApp({ statusThrows: true }) as never, (s) => seen.push(s));
  checkHomeScreenStatus(createFakeApp({ hasMethods: false }) as never, (s) => seen.push(s));
  checkHomeScreenStatus(createFakeApp({ status: 'added' }) as never, (s) => seen.push(s));
  assert.deepEqual(seen, ['unsupported', 'unsupported', 'added']);
});

test('запись в localStorage переживает битые значения', () => {
  const storage = createStorage({ vn_home_screen_prompt: '{"state":"hacked","ts":"soon"}' });
  assert.equal(readHomeScreenRecord(storage), null);
  assert.equal(readHomeScreenRecord(createStorage({ vn_home_screen_prompt: 'not json' })), null);
  assert.equal(readHomeScreenRecord(null), null);

  writeHomeScreenRecord(recordAfterDismiss(500), storage);
  assert.deepEqual({ ...readHomeScreenRecord(storage) }, { state: 'dismissed', ts: 500 });
});

test('результат addToHomeScreen решает, что запомнить', () => {
  assert.deepEqual(recordAfterAddOutcome('added', 10), { state: 'added', ts: 10 });
  assert.deepEqual(recordAfterAddOutcome('already', 10), { state: 'added', ts: 10 });
  assert.deepEqual(recordAfterAddOutcome('missed', 10), { state: 'dismissed', ts: 10 });
  assert.equal(recordAfterAddOutcome('unsupported', 10), null);
  assert.equal(recordAfterAddOutcome('unknown', 10), null);
});

test('состояние после add: успех и отказ гасят баннер, неизвестность оставляет', () => {
  const current = { status: 'missed' as const, visible: true, busy: true };
  assert.deepEqual(stateAfterAddOutcome(current, 'added'), { status: 'added', visible: false, busy: false });
  assert.deepEqual(stateAfterAddOutcome(current, 'missed'), { status: 'missed', visible: false, busy: false });
  assert.deepEqual(stateAfterAddOutcome(current, 'unsupported'), {
    status: 'unsupported',
    visible: false,
    busy: false,
  });
  assert.deepEqual(stateAfterAddOutcome(current, 'unknown'), { status: 'missed', visible: true, busy: false });
});

test('контроллер: успешное добавление запоминается навсегда', async () => {
  const app = createFakeApp({ status: 'missed', addResult: 'added' });
  const storage = createStorage();
  const controller = createHomeScreenPromptController({ app, storage, now: () => 1_000 });

  controller.start();
  assert.equal(controller.getState().visible, true);

  await controller.add();
  assert.deepEqual(app.calls, ['checkHomeScreenStatus', 'addToHomeScreen']);
  assert.equal(controller.getState().visible, false);
  assert.equal(controller.getState().status, 'added');
  assert.deepEqual({ ...readHomeScreenRecord(storage) }, { state: 'added', ts: 1_000 });

  // Повторный запуск в рамках недели баннер не показывает.
  const next = createHomeScreenPromptController({ app, storage, now: () => 2_000 });
  next.start();
  assert.equal(next.getState().visible, false);
});

test('контроллер: отказ ставит кулдаун в неделю', async () => {
  const app = createFakeApp({ status: 'missed', addResult: 'missed' });
  const storage = createStorage();
  const controller = createHomeScreenPromptController({ app, storage, now: () => 1_000 });
  controller.start();
  await controller.add();

  assert.equal(controller.getState().visible, false);
  assert.deepEqual({ ...readHomeScreenRecord(storage) }, { state: 'dismissed', ts: 1_000 });

  const soon = createHomeScreenPromptController({ app, storage, now: () => 1_000 + 6 * DAY });
  soon.start();
  assert.equal(soon.getState().visible, false);

  const later = createHomeScreenPromptController({
    app,
    storage,
    now: () => 1_000 + HOME_SCREEN_COOLDOWN_MS + 1,
  });
  later.start();
  assert.equal(later.getState().visible, true);
});

test('контроллер: «Не сейчас» тоже убирает баннер на неделю', () => {
  const app = createFakeApp({ status: 'unknown' });
  const storage = createStorage();
  const controller = createHomeScreenPromptController({ app, storage, now: () => 42 });
  controller.start();
  assert.equal(controller.getState().visible, true);

  controller.dismiss();
  assert.equal(controller.getState().visible, false);
  assert.deepEqual(app.calls, ['checkHomeScreenStatus']);
  assert.deepEqual({ ...readHomeScreenRecord(storage) }, { state: 'dismissed', ts: 42 });
});

test('контроллер: неизвестный ответ оставляет баннер для повтора', async () => {
  const app = createFakeApp({ status: 'missed', addThrows: true });
  const storage = createStorage();
  const controller = createHomeScreenPromptController({ app, storage, now: () => 1_000 });
  controller.start();
  await controller.add();

  assert.equal(controller.getState().visible, true);
  assert.equal(controller.getState().busy, false);
  assert.equal(readHomeScreenRecord(storage), null);
});

test('контроллер: неподдерживаемый клиент остаётся в покое', () => {
  const app = createFakeApp({ platform: 'tdesktop' });
  const storage = createStorage();
  const controller = createHomeScreenPromptController({ app, storage, now: () => 1_000 });
  const states: boolean[] = [];
  controller.subscribe(() => states.push(controller.getState().visible));

  controller.start();
  controller.start();
  controller.dismiss();

  assert.deepEqual(app.calls, []);
  assert.equal(controller.getState().visible, false);
  assert.equal(controller.getState().status, null);
  assert.deepEqual(states, [false]);
  assert.deepEqual({ ...readHomeScreenRecord(storage) }, { state: 'dismissed', ts: 1_000 });
});

test('подписчики получают изменения состояния и отписываются', () => {
  const app = createFakeApp({ status: 'missed' });
  const controller = createHomeScreenPromptController({ app, storage: createStorage(), now: () => 1 });
  const seen: boolean[] = [];
  const unsubscribe = controller.subscribe(() => seen.push(controller.getState().visible));

  controller.start();
  controller.dismiss();
  unsubscribe();
  controller.start();

  assert.deepEqual(seen, [true, false]);
});