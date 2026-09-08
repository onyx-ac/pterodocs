/**
 * What changes, and what must not, when the WordPress plugin is expected.
 *
 * The contract of `render.blocks: 'plugin'` is narrow on purpose: it may add
 * block-comment attributes and it may add markup of its own inside pterodoc's
 * generated furniture, but it must never change the markup of a core block —
 * WordPress re-runs a block's save function on edit and compares, and content
 * it would not have written itself is content the editor refuses.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { renderDoc } from '../../src/render/index';
import { composePage, DEFAULT_LAYOUT, type PageLike } from '../../src/render/page';
import { createTheme } from '../../src/render/theme';

/** Render a snippet under one vocabulary. */
function render(markdown: string, blocks: 'core' | 'plugin') {
  return renderDoc({
    markdown,
    file: 'test.md',
    permalink: '/docs/test',
    theme: createTheme({ classPrefix: 'x', blocks }),
  });
}

const FENCE = '```ts {1,3-5}\nconst a = 1;\nconst b = 2;\nconst c = 3;\n```\n';

test('core blocks are what the renderer emits unless the plugin is asked for', () => {
  const { body } = render(FENCE, 'core');
  assert.equal(body.includes('pterodocHighlight'), false, body);
  assert.ok(body.includes('<!-- wp:code {"className":"language-ts"} -->'), body);
});

test('a highlighted range is reported when nothing can render it', () => {
  const { issues } = render(FENCE, 'core');
  const dropped = issues.issues.filter((issue) => issue.code === 'code-highlight-dropped');
  assert.equal(dropped.length, 1);
  assert.match(dropped[0]!.message, /1,3-5/);
});

test('a highlighted range is carried rather than dropped when the plugin can render it', () => {
  const { body, issues } = render(FENCE, 'plugin');

  assert.ok(body.includes('"pterodocHighlight":"1,3-5"'), body);
  assert.equal(
    issues.issues.filter((issue) => issue.code === 'code-highlight-dropped').length,
    0,
  );
});

test('carrying the range leaves the code block’s own markup untouched', () => {
  // The whole reason the range travels in the block comment: WordPress compares
  // stored markup with what `save()` would produce, so the two vocabularies must
  // differ only inside the comment.
  const markup = (blocks: 'core' | 'plugin') =>
    render(FENCE, blocks)
      .body.split('\n')
      .filter((line) => ! line.startsWith('<!--'))
      .join('\n');

  assert.equal(markup('plugin'), markup('core'));
});

test('a fence with nothing to carry is identical under both vocabularies', () => {
  const plain = '```ts\nconst a = 1;\n```\n';
  assert.equal(render(plain, 'plugin').body, render(plain, 'core').body);
});

/** A three-deep page, so the breadcrumb has something to separate. */
function page(): PageLike {
  const root: PageLike = { path: '', title: 'Docs', children: [], sections: [] };
  const guides: PageLike = { path: 'guides', title: 'Guides', parent: root, children: [], sections: [] };
  return { path: 'guides/sync', title: 'Sync', parent: guides, children: [], sections: [] };
}

/** Compose one page's breadcrumb under one vocabulary. */
function breadcrumb(blocks: 'core' | 'plugin'): string {
  return composePage({
    node: page(),
    body: '<!-- wp:paragraph -->\n<p>Body.</p>\n<!-- /wp:paragraph -->',
    links: new Set<string>(),
    href: (path) => `/docs/${path}`,
    lookup: () => undefined,
    theme: createTheme({ classPrefix: 'x', blocks }),
    layout: { ...DEFAULT_LAYOUT, kind: 'single', nav: 'none' },
  });
}

test('the breadcrumb separator is plain text unless the plugin can swap it', () => {
  const body = breadcrumb('core');
  assert.ok(body.includes('</a> › <a'), body);
  assert.equal(body.includes('x-breadcrumb-separator'), false);
});

test('the plugin gets a marked separator, so swapping it needs no guesswork', () => {
  const body = breadcrumb('plugin');
  assert.ok(body.includes('<span class="x-breadcrumb-separator"> › </span>'), body);

  // Still one paragraph of links: the marking is inside pterodoc's own
  // furniture, not a change to how the breadcrumb is built.
  assert.equal(body.match(/<!-- wp:paragraph -->/g)?.length, 2);
});

test('the two vocabularies differ only in the separator', () => {
  const stripped = breadcrumb('plugin')
    .replace(/<span class="x-breadcrumb-separator">([^<]*)<\/span>/g, '$1');

  assert.equal(stripped, breadcrumb('core'));
});
