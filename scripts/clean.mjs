/**
 * Remove every package's build output.
 *
 * The build info must go with `lib/`: leave it behind and `tsc -b` believes it
 * is up to date, emits no declarations, and rollup then writes .js files into a
 * directory with no .d.ts beside them — a package that typechecks as `any`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packages = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'packages');

for (const name of fs.readdirSync(packages)) {
  const dir = path.join(packages, name);
  if (!fs.statSync(dir).isDirectory()) continue;
  fs.rmSync(path.join(dir, 'lib'), { recursive: true, force: true });
  fs.rmSync(path.join(dir, 'tsconfig.tsbuildinfo'), { force: true });
}
