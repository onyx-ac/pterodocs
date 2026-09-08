/**
 * Copy the repository's README and changelog into the published package.
 *
 * They are listed in `files`, and npm omits a missing file silently, so without
 * this the package would ship on npm with no description at all. Copying rather
 * than duplicating keeps one source of truth.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(root, 'packages', 'cli');

for (const name of ['README.md', 'CHANGELOG.md']) {
  fs.copyFileSync(path.join(root, name), path.join(target, name));
}
