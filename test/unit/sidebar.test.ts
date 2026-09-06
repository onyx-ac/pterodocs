/** Building the page tree from Docusaurus's resolved sidebars. */

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCapture } from '../../src/docusaurus/capture';
import { buildPageTree } from '../../src/docusaurus/sidebar';
import { IssueCollector } from '../../src/util/issues';
import type { DocsVersion, SiteModel } from '../../src/docusaurus/types';

const fixtures = path.dirname(fileURLToPath(new URL('../fixtures/x', import.meta.url)));

async function model(name: 'mini' | 'docstack'): Promise<SiteModel> {
  return readCapture(path.join(fixtures, 'models', `${name}.model.json`));
}

async function version(name: 'mini' | 'docstack'): Promise<DocsVersion> {
  return (await model(name)).instances[0]!.versions[0]!;
}

function build(v: DocsVersion, options: Partial<Parameters<typeof buildPageTree>[0]> = {}) {
  const issues = new IssueCollector();
  const tree = buildPageTree({ version: v, sidebars: ['docs'], rootTitle: '', issues, ...options });
  return { tree, issues };
}

test('the tree follows the sidebar, and directories land at their first member', async () => {
  const { tree } = build(await version('mini'));
  assert.deepEqual(
    tree.chain.map((node) => node.path),
    ['alpha', 'alpha/first', 'alpha/second', 'beta', 'beta/child'],
  );
  assert.deepEqual(
    tree.root.children.map((node) => node.menuOrder),
    [0, 10],
  );
});

test('a document with the version slug becomes the root, keeping its own title', async () => {
  const { tree } = build(await version('mini'));
  assert.equal(tree.root.doc?.id, 'intro');
  assert.equal(tree.root.title, 'Welcome');
  assert.equal(tree.root.kind, 'root');
});

test('a category names its directory, and its own page supplies the body', async () => {
  const { tree } = build(await version('mini'));
  const alpha = tree.byPath.get('alpha')!;
  assert.equal(alpha.title, 'Alpha');
  assert.equal(alpha.doc, undefined);

  const beta = tree.byPath.get('beta')!;
  assert.equal(beta.title, 'Beta');
  assert.equal(beta.doc?.id, 'beta/index');
});

test('pagination walks the pages that exist, including section pages', async () => {
  const { tree } = build(await version('mini'));

  // Docusaurus would send the reader from the root straight to alpha/first,
  // because a category with no document of its own is not a page there. Here
  // it is a page with a URL of its own, so the reader passes through it.
  const first = tree.byPath.get('alpha/first')!;
  assert.equal(first.previousPath, 'alpha');
  assert.equal(first.nextPath, 'alpha/second');

  const alpha = tree.byPath.get('alpha')!;
  assert.equal(alpha.previousPath, undefined, 'the first page has nothing before it');
  assert.equal(tree.byPath.get('beta/child')!.nextPath, undefined, 'nor the last anything after');
});

test('a page is findable by the file it came from, for relative links', async () => {
  const { tree } = build(await version('mini'));
  assert.equal(tree.bySourcePath.get('docs/beta/index.md')?.path, 'beta');
  assert.equal(tree.bySourcePath.get('docs/alpha/first.md')?.path, 'alpha/first');
});

test('a page carries its description, so a section can summarise its children', async () => {
  const { tree } = build(await version('mini'));
  assert.equal(tree.byPath.get('alpha/first')!.description, 'The first page.');
});

test('a cross-reference to another sidebar publishes no page', async () => {
  const { tree, issues } = build(await version('mini'));
  assert.equal(tree.byPath.has('other/thing'), false);
  assert.ok(issues.issues.some((issue) => issue.code === 'sidebar-ref-item'));
  assert.ok(issues.issues.some((issue) => issue.code === 'sidebar-category-empty'));
});

test('a sidebar link is navigation, not a page', async () => {
  const { issues } = build(await version('mini'));
  assert.ok(issues.issues.some((issue) => issue.code === 'sidebar-link-item'));
});

test('an unlisted document stays unpublished unless asked for', async () => {
  const plain = build(await version('mini'));
  assert.equal(plain.tree.byPath.has('hidden'), false);
  assert.ok(plain.issues.issues.some((issue) => issue.code === 'doc-unlisted'));

  const included = build(await version('mini'), { includeUnlisted: true, includeOrphans: true });
  assert.equal(included.tree.byPath.has('hidden'), true);
});

test('a document belonging to another sidebar is never published as an orphan', async () => {
  const { tree } = build(await version('mini'), { includeOrphans: true });
  assert.equal(tree.byPath.has('other/thing'), false);
});

test('publishing every sidebar picks up the other one too', async () => {
  const { tree } = build(await version('mini'), { sidebars: 'all' });
  assert.equal(tree.byPath.has('other/thing'), true);
});

test('the root title falls back to the one supplied when no document claims it', async () => {
  const v = await version('mini');
  const withoutRoot: DocsVersion = { ...v, docs: v.docs.filter((doc) => doc.treePath !== '') };
  const { tree } = build(withoutRoot, { rootTitle: 'Documentation' });
  assert.equal(tree.root.title, 'Documentation');
  assert.equal(tree.root.doc, undefined);
});

test('the real DocStack sidebar produces the tree the site shows', async () => {
  const { tree, issues } = build(await version('docstack'));

  assert.equal(tree.chain.length + 1, 47, 'root plus every published page');
  assert.equal(tree.root.doc?.id, 'intro');

  // The top level is the sidebar's own categories, in its order.
  assert.deepEqual(
    tree.root.children.map((node) => node.path),
    ['get-started', 'guides', 'concepts', 'reference', 'contributing'],
  );
  assert.deepEqual(
    tree.root.children.map((node) => node.title),
    ['Get started', 'Guides', 'Concepts', 'Reference', 'Contributing'],
  );

  // A nested category names its own directory without stealing its parent's.
  assert.equal(tree.byPath.get('concepts')!.title, 'Concepts');
  const accessControl = tree.byPath.get('concepts/access-control')!;
  assert.equal(accessControl.title, 'Access control');
  assert.equal(accessControl.doc?.id, 'concepts/access-control/index');
  assert.equal(accessControl.menuOrder, 50);

  // The generated API reference belongs to other sidebars and stays out.
  for (const node of tree.chain) {
    assert.ok(!node.path.startsWith('api'), `${node.path} should not be published`);
  }
  assert.equal(issues.issues.filter((issue) => issue.severity === 'warning').length, 0);
});

test('every published page has a title, a unique path and a parent', async () => {
  const { tree } = build(await version('docstack'));
  const seen = new Set<string>();
  for (const node of tree.chain) {
    assert.ok(node.title, `${node.path} has no title`);
    assert.equal(seen.has(node.path), false, `${node.path} appears twice`);
    seen.add(node.path);
    assert.ok(node.parent, `${node.path} has no parent`);
  }
});
