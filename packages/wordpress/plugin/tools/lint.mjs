/**
 * Check that every shipped script parses.
 *
 * Not a linter: this plugin has no bundler, so the guarantee that matters is
 * that the exact bytes WordPress will serve are valid JavaScript. `node --check`
 * is what actually proves that.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const scripts = path.join(here, '..', 'assets', 'js');

let failed = 0;
for (const name of fs.readdirSync(scripts).filter((file) => file.endsWith('.js'))) {
  const file = path.join(scripts, name);
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) failed += 1;
  else process.stdout.write(`ok  ${name}\n`);
}

process.exit(failed === 0 ? 0 : 1);
