/**
 * Тесты без новых зависимостей: esbuild уже лежит в дереве через Vite.
 *
 * Node-раннер не умеет разрешать импорты без расширения (`../utils/telegram`),
 * а ставить ради этого Vitest/Jest не хочется. Поэтому тесты собираются в
 * обычные ESM-модули и запускаются штатным `node --test`.
 *
 *   node scripts/run-tests.mjs
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as esbuild from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const testDir = join(root, 'test');

const testFiles = readdirSync(testDir)
  .filter((name) => name.endsWith('.test.ts'))
  .sort();

if (testFiles.length === 0) {
  console.error('No test files found in test/');
  process.exit(1);
}

const outDir = mkdtempSync(join(tmpdir(), 'miniapp-tests-'));

try {
  await esbuild.build({
    entryPoints: testFiles.map((name) => join(testDir, name)),
    outdir: outDir,
    outExtension: { '.js': '.mjs' },
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node20',
    logLevel: 'warning',
    // В тестах код Dev-веток (логи запроса fullscreen) должен быть достижим.
    define: { 'import.meta.env.DEV': 'true' },
  });

  const result = spawnSync(
    process.execPath,
    ['--test', ...testFiles.map((name) => join(outDir, name.replace(/\.test\.ts$/, '.test.mjs')))],
    { stdio: 'inherit' }
  );
  process.exit(result.status ?? 1);
} finally {
  rmSync(outDir, { recursive: true, force: true });
}