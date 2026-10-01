import { test } from 'node:test';
import assert from 'node:assert/strict';
import { raceWithGeminiFallback } from '../src/services/gemini';

type LlmResult = { body: { candidates?: { content?: { parts?: { text?: string }[] } }[] }; error: { kind: string; message?: string; status?: number } | null };

function ok(text: string): LlmResult {
  return { body: { candidates: [{ content: { parts: [{ text }] } }] }, error: null };
}

function fail(kind: string): LlmResult {
  return { body: {}, error: { kind } };
}

test('race: resolves with the first success and aborts the loser', async () => {
  let backupAborted = false;
  let resolvePrimary: (r: LlmResult) => void = () => {};
  const primary = new Promise<LlmResult>((res) => (resolvePrimary = res));
  const backup = new Promise<LlmResult>(() => {}); // never settles unless aborted

  const race = raceWithGeminiFallback(
    primary,
    backup,
    'deepseek',
    () => (backupAborted = true),
    () => {}
  );

  resolvePrimary(ok('winner'));
  const result = await race;
  assert.equal(result.error, null);
  assert.equal(result.body.candidates?.[0]?.content?.parts?.[0]?.text, 'winner');
  assert.equal(backupAborted, true);
});

test('race: backup wins when primary is slow, primary is aborted', async () => {
  let primaryAborted = false;
  const primary = new Promise<LlmResult>(() => {});
  const backup = Promise.resolve(ok('backup-winner'));

  const race = raceWithGeminiFallback(
    primary,
    backup,
    'deepseek',
    () => {},
    () => (primaryAborted = true)
  );

  const result = await race;
  assert.equal(result.error, null);
  assert.equal(result.body.candidates?.[0]?.content?.parts?.[0]?.text, 'backup-winner');
  assert.equal(primaryAborted, true);
});

test('race: both fail -> resolves with primary error', async () => {
  const race = raceWithGeminiFallback(
    Promise.resolve(fail('timeout')),
    Promise.resolve(fail('network')),
    'deepseek',
    () => {},
    () => {}
  );

  const result = await race;
  assert.deepEqual(result.error, fail('timeout').error);
});