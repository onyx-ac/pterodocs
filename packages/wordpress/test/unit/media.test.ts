/** Finding, resolving and uploading the files a document references. */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { collectImages, resolveImage } from '@pterodocs/core/render';
import { loadMediaIndex, uploadMedia } from '../../src/media';
import { WpClient } from '../../src/client';
import { contentHash } from '@pterodocs/core/util';
import { createFakeWp } from '../fixtures/fake-wp';

// Every fixture path is resolved rather than written out: an absolute path is
// spelled differently on Windows, and what these tests are about is which
// directory a URL resolves against, not how a root is spelled.
const SITE = path.resolve('/site');

/** A fixture path below the site directory, from POSIX-ish segments. */
const at = (...segments: string[]) => path.join(SITE, ...segments.join('/').split('/'));

const ctx = (present: string[]) => ({
  sourceAbsolutePath: at('docs/guides/sync.md'),
  contentPath: at('docs'),
  contentPathLocalized: at('i18n/fr/docs'),
  staticDirs: [at('static')],
  baseUrl: '/project/',
  siteDir: SITE,
  exists: (file: string) => present.includes(file),
});

test('images are found wherever they sit, including behind a reference', () => {
  const found = collectImages(
    'Text with ![inline](./a.png) and\n\n![standalone](./b.png "Caption")\n\n![ref][r]\n\n[r]: ./c.png\n',
  );
  assert.deepEqual(
    found.map((image) => image.url),
    ['./a.png', './b.png', './c.png'],
  );
  assert.equal(found[1]!.title, 'Caption');
  assert.equal(found[0]!.alt, 'inline');
});

test('the same file referenced twice is collected once', () => {
  assert.equal(collectImages('![a](./x.png) and ![b](./x.png)\n').length, 1);
});

test('an external image is left alone', () => {
  assert.deepEqual(resolveImage('https://example.test/a.png', ctx([])), {
    kind: 'external',
    url: 'https://example.test/a.png',
  });
  assert.equal(resolveImage('data:image/png;base64,AAA', ctx([])).kind, 'external');
});

test('a relative image resolves against the document', () => {
  const resolved = resolveImage('./img/a.png', ctx([at('docs/guides/img/a.png')]));
  assert.deepEqual(resolved, {
    kind: 'file',
    url: './img/a.png',
    file: at('docs/guides/img/a.png'),
  });
});

test('a localised copy of an asset is preferred when there is one', () => {
  const resolved = resolveImage('./img/a.png', ctx([at('i18n/fr/docs/guides/img/a.png')]));
  assert.equal(resolved.kind, 'file');
  assert.equal((resolved as { file: string }).file, at('i18n/fr/docs/guides/img/a.png'));
});

test('a root-relative image comes from a static directory, with or without the base URL', () => {
  assert.equal(resolveImage('/img/a.png', ctx([at('static/img/a.png')])).kind, 'file');
  assert.equal(resolveImage('/project/img/a.png', ctx([at('static/img/a.png')])).kind, 'file');
});

test('a site-relative image uses the @site prefix', () => {
  const resolved = resolveImage('@site/static/img/a.png', ctx([at('static/img/a.png')]));
  assert.equal(resolved.kind, 'file');
});

test('an image that is not there is reported, not invented', () => {
  assert.deepEqual(resolveImage('./missing.png', ctx([])), { kind: 'missing', url: './missing.png' });
});

test('an uploaded file is identified by its content, and set as its slug', async () => {
  const fake = createFakeWp();
  const client = new WpClient({
    baseUrl: 'https://example.test',
    user: 'a',
    appPassword: 'b',
    fetch: fake.fetch,
    sleep: async () => {},
  });

  const bytes = new TextEncoder().encode('pretend this is a png');
  const hash = contentHash(bytes);
  const uploaded = await uploadMedia(
    client,
    { bytes, filename: 'diagram.png', hash, mime: 'image/png', alt: 'A diagram', title: 'Diagram' },
    'pterodocs',
  );

  assert.equal(uploaded.hash, hash);
  assert.equal(fake.media[0]!.slug, `pterodocs-${hash}`, 'the slug carries the identity');
  assert.equal(fake.media[0]!.alt_text, 'A diagram');
  // Two requests: WordPress derives a slug from the filename, so it is set after.
  assert.equal(fake.calls.filter((call) => call.path.startsWith('/media')).length, 2);
});

test('what was uploaded before is found again by its hash', async () => {
  const fake = createFakeWp({
    media: [
      { id: 5, slug: 'pterodocs-0123456789abcdef', source_url: 'https://example.test/a.png', mime_type: 'image/png' },
      { id: 6, slug: 'something-else', source_url: 'https://example.test/b.png', mime_type: 'image/png' },
    ],
  });
  const client = new WpClient({
    baseUrl: 'https://example.test',
    user: 'a',
    appPassword: 'b',
    fetch: fake.fetch,
    sleep: async () => {},
  });

  const index = await loadMediaIndex(client, 'pterodocs');
  assert.equal(index.size, 1, 'only files this tool uploaded are ours to reuse');
  assert.equal(index.get('0123456789abcdef')!.id, 5);
});

test('an SVG refusal is explained rather than reported as a mystery', async () => {
  const failures = new Map([['POST /media', [{ status: 400, body: '{"code":"rest_upload_file_type"}' }]]]);
  const fake = createFakeWp({ failures });
  const client = new WpClient({
    baseUrl: 'https://example.test',
    user: 'a',
    appPassword: 'b',
    fetch: fake.fetch,
    sleep: async () => {},
  });

  await assert.rejects(
    () =>
      uploadMedia(
        client,
        {
          bytes: new TextEncoder().encode('<svg/>'),
          filename: 'logo.svg',
          hash: 'abc',
          mime: 'image/svg+xml',
          alt: '',
          title: '',
        },
        'pterodocs',
      ),
    /blocks image\/svg\+xml uploads/,
  );
});

test('a real file on disk hashes the same however it is read', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pterodocs-media-'));
  const file = path.join(dir, 'a.bin');
  await fs.writeFile(file, 'contents');
  assert.equal(contentHash(await fs.readFile(file)), contentHash('contents'));
  await fs.rm(dir, { recursive: true, force: true });
});
