/**
 * Copy Prism out of node_modules and into the plugin.
 *
 * Copied rather than committed, so what ships is provably the published package
 * at a pinned version, and the provenance is one `npm ls prismjs` away. The
 * plugin checks for the copy at runtime and simply does not highlight when it
 * is absent, so a checkout that has not run this is not broken.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const target = path.join(here, '..', 'assets', 'vendor', 'prism');

const source = path.dirname(require.resolve('prismjs/package.json'));
const version = require('prismjs/package.json').version;

fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(path.join(target, 'components'), { recursive: true });
fs.mkdirSync(path.join(target, 'plugins', 'line-numbers'), { recursive: true });
fs.mkdirSync(path.join(target, 'plugins', 'line-highlight'), { recursive: true });

fs.copyFileSync(path.join(source, 'prism.js'), path.join(target, 'prism.js'));

// Every grammar: which ones a page needs is decided at render time, and only
// those are enqueued, so shipping the set costs disk rather than bandwidth.
let grammars = 0;
for (const name of fs.readdirSync(path.join(source, 'components'))) {
  if (!name.endsWith('.min.js')) continue;
  fs.copyFileSync(
    path.join(source, 'components', name),
    path.join(target, 'components', name),
  );
  grammars += 1;
}

fs.copyFileSync(
  path.join(source, 'plugins', 'line-numbers', 'prism-line-numbers.min.js'),
  path.join(target, 'plugins', 'line-numbers', 'prism-line-numbers.min.js'),
);

// Highlighted line ranges: Docusaurus writes them in the fence's metastring,
// pterodocs carries them in the block comment, and this renders them.
fs.copyFileSync(
  path.join(source, 'plugins', 'line-highlight', 'prism-line-highlight.min.js'),
  path.join(target, 'plugins', 'line-highlight', 'prism-line-highlight.min.js'),
);

// No Prism theme is copied: token colours are custom properties in the
// plugin's own stylesheet, derived from the block's colours.
fs.writeFileSync(
  path.join(target, 'VERSION'),
  `prismjs ${version}\ncopied unmodified from the npm package by tools/vendor-prism.mjs\n`,
  'utf8',
);

process.stdout.write(`vendored prismjs ${version}: prism.js, ${grammars} grammars, line-numbers, line-highlight\n`);
