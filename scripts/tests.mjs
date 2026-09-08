/**
 * Run one tier of tests across every package, in a single process.
 *
 * The files are enumerated here rather than passed as a shell glob: `npm run`
 * goes through cmd.exe on Windows, which does not expand them, and Node 20's
 * test runner does not accept glob patterns either.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const tier = process.argv[2] ?? 'unit';

const files = fs
  .readdirSync(path.join(root, 'packages'))
  .map((name) => path.join(root, 'packages', name, 'test', tier))
  .filter((dir) => fs.existsSync(dir))
  .flatMap((dir) =>
    fs
      .readdirSync(dir)
      .filter((file) => file.endsWith('.test.ts'))
      .map((file) => path.join(dir, file)),
  );

if (files.length === 0) {
  process.stdout.write(`no ${tier} tests\n`);
  process.exit(0);
}

// Resolved from source through tsconfig.dev.json's paths, so the suites run
// without a build.
const result = spawnSync(
  'tsx',
  ['--tsconfig', path.join(root, 'tsconfig.dev.json'), '--test', ...files],
  { stdio: 'inherit', shell: process.platform === 'win32', cwd: root },
);

process.exit(result.status ?? 1);
