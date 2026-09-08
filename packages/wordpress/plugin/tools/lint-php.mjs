/**
 * Check that every shipped PHP file parses.
 *
 * PHP is often not on PATH on a Windows development machine even when it is
 * installed, so a few usual homes are tried before giving up. Not finding it is
 * reported rather than passed over in silence: a lint that quietly does nothing
 * is worse than no lint.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const CANDIDATES = [
  'php',
  'C:/xampp/php/php.exe',
  'C:/laragon/bin/php/php.exe',
  'C:/tools/php/php.exe',
  '/usr/bin/php',
  '/usr/local/bin/php',
];

/** The first PHP that answers, or nothing. */
function findPhp() {
  for (const candidate of CANDIDATES) {
    const result = spawnSync(candidate, ['--version'], { encoding: 'utf8' });
    if (result.status === 0) return candidate;
  }
  return undefined;
}

/** Every .php file that ships. */
function phpFiles(dir) {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if ('tools' === entry.name || 'node_modules' === entry.name) continue;
      found.push(...phpFiles(full));
    } else if (entry.name.endsWith('.php')) {
      found.push(full);
    }
  }
  return found;
}

const php = findPhp();

if (!php) {
  process.stderr.write(
    'no PHP found. Tried: ' + CANDIDATES.join(', ') + '\nInstall PHP, or put it on PATH.\n',
  );
  process.exit(2);
}

const version = spawnSync(php, ['--version'], { encoding: 'utf8' }).stdout.split('\n')[0];
process.stdout.write(`${version}\n`);

let failed = 0;
for (const file of phpFiles(root)) {
  const result = spawnSync(php, ['-l', file], { encoding: 'utf8' });
  const name = path.relative(root, file).split(path.sep).join('/');

  if (result.status === 0) {
    process.stdout.write(`ok    ${name}\n`);
  } else {
    failed += 1;
    process.stdout.write(`FAIL  ${name}\n${result.stdout}${result.stderr}`);
  }
}

process.exit(failed === 0 ? 0 : 1);
