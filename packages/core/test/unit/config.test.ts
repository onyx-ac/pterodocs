/** Configuration precedence and validation. */

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { resolveConfig, discoverConfigFile, CONFIG_NAMES } from '../../src/config/load';

const CREDENTIALS = {
  WP_URL: 'https://example.test',
  WP_USER: 'someone',
  WP_APP_PASSWORD: 'abcd efgh ijkl mnop',
};

test('flags win over the environment, which wins over the file', () => {
  const config = resolveConfig({
    flags: { root: '/from-flag' },
    env: { ...CREDENTIALS, PTERODOCS_WP_ROOT: '/from-env' },
    file: { target: { root: '/from-file' } },
  });
  assert.deepEqual(config.rootSegments, ['from-flag']);

  const withoutFlag = resolveConfig({
    env: { ...CREDENTIALS, PTERODOCS_WP_ROOT: '/from-env' },
    file: { target: { root: '/from-file' } },
  });
  assert.deepEqual(withoutFlag.rootSegments, ['from-env']);

  const fileOnly = resolveConfig({ env: CREDENTIALS, file: { target: { root: '/from-file' } } });
  assert.deepEqual(fileOnly.rootSegments, ['from-file']);
});

test('the older unprefixed variable names still work, and say so', () => {
  const config = resolveConfig({ env: { ...CREDENTIALS, WP_ROOT_PATH: '/legacy' } });
  assert.deepEqual(config.rootSegments, ['legacy']);
  assert.ok(config.notices.some((notice) => notice.includes('WP_ROOT_PATH')));
  // The credential and URL names did not change, so using them says nothing.
  assert.equal(
    resolveConfig({ env: CREDENTIALS }).notices.some((notice) => notice.includes('WP_URL')),
    false,
  );
});

test('an empty base publishes straight under the root', () => {
  const config = resolveConfig({
    flags: { base: '' },
    env: CREDENTIALS,
    file: { target: { base: 'docs' } },
  });
  assert.deepEqual(config.baseSegments, []);
});

test('the application password loses its display spaces', () => {
  const config = resolveConfig({ env: CREDENTIALS });
  assert.equal(config.appPassword, 'abcdefghijklmnop');
  assert.equal(config.offline, false);
  assert.equal(config.dryRun, false);
});

test('missing credentials downgrade the run instead of failing it', () => {
  const config = resolveConfig({ env: { WP_URL: 'https://example.test' } });
  assert.equal(config.offline, true);
  assert.equal(config.dryRun, true);
  assert.ok(config.notices.some((notice) => /offline/.test(notice)), config.notices.join('; '));
});

test('credentials are read from the variables the config names', () => {
  const config = resolveConfig({
    env: { WP_URL: 'https://example.test', DOCS_USER: 'a', DOCS_PASS: 'b' },
    file: { target: { auth: { userEnv: 'DOCS_USER', passwordEnv: 'DOCS_PASS' } } },
  });
  assert.equal(config.user, 'a');
  assert.equal(config.offline, false);
});

test('invalid values are refused with the setting named', () => {
  assert.throws(() => resolveConfig({ flags: { status: 'published' }, env: CREDENTIALS }), /publish/);
  assert.throws(() => resolveConfig({ env: { ...CREDENTIALS, WP_URL: 'example.test' } }), /http/);
  assert.throws(
    () => resolveConfig({ env: CREDENTIALS, file: { target: { root: '/Bad Slug' } } }),
    /not a slug/,
  );
  assert.throws(
    () => resolveConfig({ env: CREDENTIALS, file: { layout: { align: 'middle' as never } } }),
    /alignment/,
  );
});

test('layout and strings fall back to the defaults, and overrides merge', () => {
  const config = resolveConfig({
    env: CREDENTIALS,
    file: { layout: { navWidth: '30%' }, render: { strings: { indexHeading: 'Inside' } } },
  });
  assert.equal(config.layout.navWidth, '30%');
  assert.equal(config.layout.mainWidth, '75%', 'untouched settings keep their default');
  assert.equal(config.strings.indexHeading, 'Inside');
  assert.equal(config.strings.breadcrumbSeparator, ' › ');
});

test('--no-media turns uploads off whatever the file says', () => {
  const config = resolveConfig({
    flags: { noMedia: true },
    env: CREDENTIALS,
    file: { media: { upload: true } },
  });
  assert.equal(config.uploadMedia, false);
});

test('a configuration file is discovered by name, in order', () => {
  const siteDir = path.resolve('/site');
  const found = path.join(siteDir, 'pterodocs.config.js');
  const present = new Set([found]);
  assert.equal(discoverConfigFile(siteDir, { existsSync: (file) => present.has(file) }), found);
  assert.equal(discoverConfigFile(siteDir, { existsSync: () => false }), undefined);
  assert.equal(CONFIG_NAMES[0], 'pterodocs.config.mjs');
});
