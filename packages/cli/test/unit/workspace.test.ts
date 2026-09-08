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
