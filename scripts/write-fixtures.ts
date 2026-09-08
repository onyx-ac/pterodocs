/**
 * Regenerate the golden files.
 *
 * Never run by the tests: a golden that rewrites itself proves nothing. Run it
 * by hand with `npm run fixtures` after a deliberate change, and read the diff.
 */

import fs from 'node:fs';
import { FIXTURES, goldenPath, renderFixture } from '../packages/core/test/fixtures/render-fixture';

for (const name of FIXTURES) {
  const { body, issues } = renderFixture(name);
  fs.writeFileSync(goldenPath(name), `${body}\n`, 'utf8');
  process.stdout.write(`wrote ${name}.expected.html (${issues.issues.length} issues)\n`);
}
