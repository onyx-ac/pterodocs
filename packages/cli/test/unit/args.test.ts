/** Parsing the command line. */

import test from 'node:test';
import assert from 'node:assert/strict';
import { ConfigError } from '@pterodocs/core';
import { parseCliArgs } from '../../src/cli/args';

test('the command line parses into flags, and an unknown one explains itself', () => {
  const parsed = parseCliArgs(['sync', '--dry-run', '--root', '/products/docs', '--locale', 'fr']);
  assert.equal(parsed.command, 'sync');
  assert.equal(parsed.flags.dryRun, true);
  assert.equal(parsed.flags.root, '/products/docs');
  assert.deepEqual(parsed.flags.locale, ['fr']);
  assert.throws(() => parseCliArgs(['--nope']), ConfigError);
  assert.throws(() => parseCliArgs(['publish']), /Unknown command/);
});

test('the default command is sync', () => {
  assert.equal(parseCliArgs([]).command, 'sync');
  assert.equal(parseCliArgs(['render']).command, 'render');
});
