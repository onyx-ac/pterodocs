/** Path, hash and issue helpers. */

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { ConfigError } from '../../src/errors';
import { contentHash } from '../../src/util/hash';
import { IssueCollector, formatIssue } from '../../src/util/issues';
import { mimeTypeFor, isBlockedByDefault } from '../../src/util/mime';
import {
  resolveAliasedPath,
  toSlugSegments,
  slugify,
  titleCase,
  relativeToPrefix,
  joinPath,
} from '../../src/util/paths';

test('a Docusaurus @site path resolves against the site directory', () => {
  // Resolved rather than written out, because an absolute path is spelled
  // differently on Windows and the point of the test is the join, not the shape.
  const siteDir = path.resolve('/srv/site');
  assert.equal(
    resolveAliasedPath('@site/docs/intro.md', siteDir),
    path.join(siteDir, 'docs', 'intro.md'),
  );
  assert.throws(() => resolveAliasedPath('docs/intro.md', siteDir), ConfigError);
});

test('configured paths split into slug segments and reject anything else', () => {
  assert.deepEqual(toSlugSegments('/products/docstack/', 'root'), ['products', 'docstack']);
  assert.deepEqual(toSlugSegments('', 'root'), []);
  assert.throws(() => toSlugSegments('/Products', 'root'), /not a slug/);
  assert.throws(() => toSlugSegments('a b', 'root'), /not a slug/);
});

test('derived slugs lose accents, case and punctuation', () => {
  assert.equal(slugify('1.0.0'), '1-0-0');
  assert.equal(slugify('Édition Française'), 'edition-francaise');
  assert.equal(slugify('!!!'), 'untitled');
  assert.equal(titleCase('get-started'), 'Get Started');
});

test('a URL below a prefix yields its remainder, and one outside yields nothing', () => {
  assert.equal(relativeToPrefix('/docstack/docs/guides/sync/', '/docstack/docs'), 'guides/sync');
  assert.equal(relativeToPrefix('/docstack/docs/', '/docstack/docs'), '');
  assert.equal(relativeToPrefix('/elsewhere/', '/docstack/docs'), undefined);
  assert.equal(relativeToPrefix('/anything/here', '/'), 'anything/here');
});

test('paths join into an absolute URL path', () => {
  assert.equal(joinPath(['/docstack/', 'docs', 'guides/sync']), '/docstack/docs/guides/sync/');
  assert.equal(joinPath([]), '/');
  assert.equal(joinPath(['a'], false), '/a');
});

test('content hashes are stable and short', () => {
  assert.equal(contentHash('hello'), contentHash('hello'));
  assert.equal(contentHash('hello').length, 16);
  assert.notEqual(contentHash('hello'), contentHash('hello '));
});

test('media types cover what a documentation site embeds', () => {
  assert.equal(mimeTypeFor('diagram.PNG'), 'image/png');
  assert.equal(mimeTypeFor('logo.svg'), 'image/svg+xml');
  assert.equal(mimeTypeFor('notes'), undefined);
  assert.equal(isBlockedByDefault('image/svg+xml'), true);
  assert.equal(isBlockedByDefault('image/png'), false);
});

test('issues carry their position and sort by severity', () => {
  const issues = new IssueCollector();
  issues.add({ code: 'a', severity: 'info', message: 'just so you know' });
  issues.add({ code: 'b', severity: 'warning', message: 'careful', file: 'docs/x.md', line: 3, column: 5 });
  assert.equal(issues.hasAtLeast('warning'), true);
  assert.equal(issues.hasAtLeast('error'), false);
  assert.deepEqual(issues.countByCode(), { a: 1, b: 1 });
  assert.equal(formatIssue(issues.issues[1]!), 'docs/x.md:3:5: careful');
  assert.equal(formatIssue(issues.issues[0]!), 'just so you know');
});
