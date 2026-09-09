/** The reconciler, end to end against an in-memory WordPress. */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCapture } from '@pterodocs/core/model';
import { createMemoryReader } from '@pterodocs/core/model';
import { resolveConfig, type ResolvedConfig } from '@pterodocs/core';
import { createWordpressTarget } from '@pterodocs/wordpress';
import { runSync } from '@pterodocs/core';
import type { SiteModel } from '@pterodocs/core/model';
import { createFakeWp, type FakeWp } from '../../../wordpress/test/fixtures/fake-wp';

// Captured models are a core artefact and live with core's fixtures.
const fixtures = path.dirname(
  fileURLToPath(new URL('../../../core/test/fixtures/x', import.meta.url)),
);

/** A site whose documents exist on disk, so bodies can actually be read. */
async function siteOnDisk(): Promise<{ model: SiteModel; dir: string }> {
  const model = await readCapture(path.join(fixtures, 'models', 'mini.model.json'));
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pterodocs-site-'));

  const version = model.instances[0]!.versions[0]!;
  for (const doc of version.docs) {
    const file = path.join(dir, doc.sourceRelativePath);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, `Body of ${doc.title}, linking to [the first page](./alpha/first.md).\n`);
    doc.sourceAbsolutePath = file;
  }
  model.siteDir = dir;
  version.contentPath = path.join(dir, 'docs');
  version.contentPathLocalized = version.contentPath;
  return { model, dir };
}

/** A configuration writing to a scratch directory. */
function configFor(outDir: string, overrides: Partial<ResolvedConfig> = {}): ResolvedConfig {
  const config = resolveConfig({
    env: { WP_URL: 'https://example.test', WP_USER: 'someone', WP_APP_PASSWORD: 'secret' },
    file: {
      site: { sidebars: ['docs'] },
      target: { root: '/products/docstack', base: 'docs', meta: { description: 'seo' } },
      render: { classPrefix: 'x' },
      media: { upload: false },
    },
    fileDir: outDir,
  });
  return { ...config, outDir, ...overrides };
}

function targetFor(config: ResolvedConfig, fake: FakeWp) {
  return createWordpressTarget(
    {
      url: config.targetUrl,
      user: config.user,
      appPassword: config.appPassword,
      policy: { rootSegments: config.rootSegments, baseSegments: config.baseSegments },
      status: config.status,
      template: config.template,
      lang: config.lang,
      mediaSlugPrefix: config.mediaSlugPrefix,
      methodOverride: config.methodOverride,
    },
    { fetch: fake.fetch, sleep: async () => {} },
  );
}

/** Set up a run: a site on disk, a fake WordPress, and somewhere to write. */
async function setup(overrides: Partial<ResolvedConfig> = {}, fake = createFakeWp()) {
  const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pterodocs-out-'));
  const { model, dir } = await siteOnDisk();
  const config = configFor(outDir, overrides);
  const reader = createMemoryReader(model);
  return {
    config,
    reader,
    fake,
    outDir,
    cleanup: async () => {
      await fs.rm(outDir, { recursive: true, force: true });
      await fs.rm(dir, { recursive: true, force: true });
    },
    run: () => runSync(config, { reader, target: targetFor(config, fake) }),
  };
}

test('an empty site gets the path pages and the whole tree', async () => {
  const t = await setup();
  const { plan } = await t.run();

  assert.equal(plan.summary['create-root'], 2, 'products and docstack');
  assert.equal(plan.summary['create'], 6, 'the docs page plus five pages');
  assert.equal(plan.summary['update'], 6);

  assert.deepEqual(
    t.fake.pages.map((page) => page.slug),
    ['products', 'docstack', 'docs', 'alpha', 'first', 'second', 'beta', 'child'],
  );
  for (const page of t.fake.pages) assert.equal(page.status, 'publish', page.slug);

  // The navigation points at the documentation page, not at a placeholder.
  const docs = t.fake.pages.find((page) => page.slug === 'docs')!;
  const child = t.fake.pages.find((page) => page.slug === 'child')!;
  assert.ok(child.content.raw.includes(`"parentPageID":${docs.id}`), child.content.raw.slice(0, 200));
  await t.cleanup();
});

test('running twice changes nothing the second time', async () => {
  const t = await setup();
  await t.run();
  const { plan } = await t.run();

  assert.equal(plan.summary['create'], undefined);
  assert.equal(plan.summary['update'], undefined);
  assert.equal(plan.summary['unchanged'], 6);
  await t.cleanup();
});

test('a page edited on the site is put back, and the change is named', async () => {
  const t = await setup();
  await t.run();

  const child = t.fake.pages.find((page) => page.slug === 'child')!;
  child.content = { raw: '<!-- wp:paragraph --><p>Edited by hand.</p><!-- /wp:paragraph -->' };
  child.title = { raw: 'Renamed', rendered: 'Renamed' };

  const { plan } = await t.run();
  const update = plan.actions.find((action) => action.op === 'update')!;
  assert.deepEqual([...update.changed!].sort(), ['content', 'title']);
  assert.equal(t.fake.pages.find((page) => page.id === child.id)!.title.raw, 'Child');
  await t.cleanup();
});

test('a dry run reads but never writes', async () => {
  const t = await setup({ dryRun: true });
  const { plan } = await t.run();

  assert.equal(plan.dryRun, true);
  assert.equal(t.fake.calls.some((call) => call.routedAs !== 'GET'), false);
  assert.equal(t.fake.pages.length, 0);
  assert.ok((plan.summary['create'] ?? 0) > 0);

  const rendered = await fs.readFile(path.join(t.outDir, 'pages', 'en', 'current', 'index.html'), 'utf8');
  assert.ok(rendered.includes('wp:columns'));
  const written = JSON.parse(await fs.readFile(path.join(t.outDir, 'plan.json'), 'utf8')) as {
    rootPath: string;
  };
  assert.equal(written.rootPath, '/products/docstack/docs/');
  await t.cleanup();
});

test('a render with no target contacts nothing', async () => {
  const t = await setup();
  const { plan } = await runSync(t.config, {
    reader: t.reader,
    target: targetFor(t.config, t.fake),
    renderOnly: true,
  });
  assert.equal(t.fake.calls.length, 0);
  assert.equal(plan.actions.length, 0);
  await t.cleanup();
});

test('pages along the root path are created once and never edited again', async () => {
  const fake = createFakeWp({
    pages: [
      {
        id: 5,
        slug: 'products',
        parent: 0,
        title: { raw: 'Our products', rendered: 'Our products' },
        content: { raw: 'Hand written.' },
      },
    ],
  });
  const t = await setup({}, fake);
  await t.run();

  const products = fake.pages.find((page) => page.id === 5)!;
  assert.equal(products.title.raw, 'Our products');
  assert.equal(products.content.raw, 'Hand written.');
  assert.equal(fake.writes.includes(5), false, 'the existing page must not be written to');
  await t.cleanup();
});

/** Add a page under the documentation root that no document accounts for. */
function orphan(t: Awaited<ReturnType<typeof setup>>, id: number, content: string): void {
  const docs = t.fake.pages.find((page) => page.slug === 'docs')!;
  t.fake.pages.push({
    id,
    parent: docs.id,
    slug: `orphan-${id}`,
    status: 'publish',
    link: `https://example.test/orphan-${id}/`,
    title: { raw: 'Orphan', rendered: 'Orphan' },
    content: { raw: content },
    excerpt: { raw: '' },
    menu_order: 0,
    template: '',
    meta: {},
  });
}

test('a page with no source document is reported, and only trashed when asked', async () => {
  const t = await setup();
  await t.run();

  // Written by pterodoc: it carries the class prefix pterodoc composes with.
  orphan(t, 999, `<!-- wp:columns {"className":"${t.config.classPrefix}-docs"} --><div></div><!-- /wp:columns -->`);

  const reported = await t.run();
  const prune = reported.plan.actions.find((action) => action.op === 'prune')!;
  assert.equal(prune.id, 999);
  assert.equal(prune.applied, false);
  assert.equal(t.fake.pages.find((page) => page.id === 999)!.status, 'publish');

  const pruning = { ...t.config, prune: true };
  await runSync(pruning, { reader: t.reader, target: targetFor(pruning, t.fake) });
  assert.equal(t.fake.pages.find((page) => page.id === 999)!.status, 'trash');
  await t.cleanup();
});

test('a page somebody else put under the documentation root is never trashed', async () => {
  // Position inside the tree is not ownership. Pruning by position alone would
  // make pterodoc delete work it did not do.
  const t = await setup();
  await t.run();

  orphan(t, 998, '<!-- wp:paragraph --><p>Written by a person.</p><!-- /wp:paragraph -->');

  const pruning = { ...t.config, prune: true };
  const { plan } = await runSync(pruning, { reader: t.reader, target: targetFor(pruning, t.fake) });

  assert.equal(t.fake.pages.find((page) => page.id === 998)!.status, 'publish');
  assert.equal(plan.actions.some((action) => action.op === 'prune' && action.id === 998), false);
  assert.ok(plan.issues.some((issue) => issue.code === 'prune-skipped-foreign'));
  await t.cleanup();
});

test('--only restricts the writes and turns pruning off', async () => {
  const t = await setup();
  await t.run();
  for (const page of t.fake.pages) page.content = { raw: 'wiped' };

  const scoped = { ...t.config, only: 'alpha', prune: true };
  const { plan } = await runSync(scoped, { reader: t.reader, target: targetFor(scoped, t.fake) });

  assert.deepEqual(
    plan.actions.filter((action) => action.op === 'update').map((action) => action.path).sort(),
    ['alpha', 'alpha/first', 'alpha/second'],
  );
  assert.equal(t.fake.pages.find((page) => page.slug === 'child')!.content.raw, 'wiped');
  assert.ok(plan.issues.some((issue) => issue.code === 'prune-skipped'));
  await t.cleanup();
});

test('--only on an empty site creates the scope and its parents, nothing else', async () => {
  const t = await setup({ only: 'alpha' });
  await t.run();

  assert.deepEqual(
    t.fake.pages.map((page) => page.slug).sort(),
    ['alpha', 'docs', 'docstack', 'first', 'products', 'second'],
  );
  for (const page of t.fake.pages) {
    assert.notEqual(page.content.raw, '', `${page.slug} should have been rendered`);
    assert.equal(page.status, 'publish');
  }
  await t.cleanup();
});

test('the run writes a manifest and a plan that describe what happened', async () => {
  const t = await setup();
  const { plan } = await t.run();

  const manifest = JSON.parse(await fs.readFile(path.join(t.outDir, 'manifest.json'), 'utf8')) as {
    path: string;
    href: string;
    locale: string;
  }[];
  assert.equal(manifest.length, 6);
  assert.equal(manifest.find((entry) => entry.path === 'beta/child')!.href, '/products/docstack/docs/beta/child/');
  assert.equal(manifest[0]!.locale, 'en');

  assert.equal(plan.versions.pterodocs.length > 0, true);
  assert.equal(plan.artifactError, null);
  assert.ok(plan.requests > 0);
  await t.cleanup();
});
