/** Invariants that hold across the workspace rather than inside one package. */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packages = path.join(
  path.dirname(fileURLToPath(new URL('../../../x', import.meta.url))),
);

/** Read one workspace manifest. */
function manifest(name: string): { name: string; version: string; dependencies?: Record<string, string> } {
  return JSON.parse(fs.readFileSync(path.join(packages, name, 'package.json'), 'utf8'));
}

const NAMES = ['core', 'docusaurus', 'wordpress', 'cli'];

test('every workspace package carries the same version', () => {
  const versions = NAMES.map((name) => [name, manifest(name).version] as const);
  const first = versions[0]![1];
  for (const [name, version] of versions) {
    assert.equal(version, first, `${name} is at ${version}, not ${first}`);
  }
});

test('a dependency on a sibling asks for exactly the version in the tree', () => {
  const version = manifest('core').version;
  for (const name of NAMES) {
    for (const [dependency, range] of Object.entries(manifest(name).dependencies ?? {})) {
      if (!dependency.startsWith('@pterodoc/')) continue;
      assert.equal(range, version, `${name} wants ${dependency}@${range}, not ${version}`);
    }
  }
});

test('core depends on neither of the packages that depend on it', () => {
  // The whole point of the split: the dependency graph points inwards, and npm
  // rather than convention is what enforces it.
  const dependencies = Object.keys(manifest('core').dependencies ?? {});
  assert.ok(!dependencies.includes('@pterodoc/docusaurus'));
  assert.ok(!dependencies.includes('@pterodoc/wordpress'));
});

test('the WordPress plugin agrees with its manifest about its own version', () => {
  // WordPress reads the version from the plugin header, uses the constant to
  // bust asset caches, and shows the stable tag to anyone installing it. Three
  // copies of one number is three chances to ship a stale stylesheet.
  const dir = path.join(packages, 'wordpress', 'plugin');
  const version = JSON.parse(
    fs.readFileSync(path.join(dir, 'package.json'), 'utf8'),
  ).version as string;

  const php = fs.readFileSync(path.join(dir, 'pterodoc.php'), 'utf8');
  const readme = fs.readFileSync(path.join(dir, 'readme.txt'), 'utf8');

  const header = /^ \* Version: +(.+)$/m.exec(php);
  const constant = /const VERSION = '([^']+)';/.exec(php);
  const stable = /^Stable tag: (.+)$/m.exec(readme);

  assert.equal(header?.[1]?.trim(), version, 'the plugin header');
  assert.equal(constant?.[1], version, 'the VERSION constant');
  assert.equal(stable?.[1]?.trim(), version, 'the readme stable tag');
});

test('the plugin moves in step with the packages', () => {
  const plugin = JSON.parse(
    fs.readFileSync(path.join(packages, 'wordpress', 'plugin', 'package.json'), 'utf8'),
  ).version as string;

  assert.equal(plugin, manifest('core').version);
});
