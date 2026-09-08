/**
 * Looking right without anything installed.
 *
 * WordPress renders core blocks with almost no opinion, so what pterodoc
 * publishes has to carry its own appearance: a stylesheet stored with the page,
 * and code tokenised before it ever gets there. These tests are about the two
 * properties that make that safe to do — the markup stays valid core blocks,
 * and nothing about it is a colour.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { renderDoc } from '../../src/render/index';
import { composePage, DEFAULT_LAYOUT, type PageLike } from '../../src/render/page';
import { createTheme } from '../../src/render/theme';
import { stylesheetFor } from '../../src/render/stylesheet';
import { highlightCode } from '../../src/render/highlight';

/** Render a snippet under one set of options. */
function render(markdown: string, options: Parameters<typeof createTheme>[0] = {}) {
  return renderDoc({
    markdown,
    file: 'test.md',
    permalink: '/docs/test',
    theme: createTheme({ classPrefix: 'x', ...options }),
  });
}

const FENCE = "```ts\nconst a = 1; // note\n```\n";

/* ---------------------------------------------------------------------- *
 * Highlighting
 * ---------------------------------------------------------------------- */

test('a fence is tokenised, and what lands in the content is classes', () => {
  const { body } = render(FENCE);

  assert.ok(body.includes('<span class="token keyword">const</span>'), body);
  assert.ok(body.includes('token comment'), body);
});

test('no colour is ever written into the content', () => {
  // The whole reason for classes: the palette lives in the stylesheet, so
  // restyling code is a CSS edit and not a republication of every page.
  const { body } = render(FENCE);

  assert.equal(/style="/.test(body), false, body);
  assert.equal(/#[0-9a-f]{3,6}/i.test(body), false, body);
});

test('the block around the tokens is still an ordinary core code block', () => {
  const { body } = render(FENCE);

  assert.ok(body.includes('<!-- wp:code {"className":"language-ts"} -->'), body);
  assert.ok(body.includes('<pre class="wp-block-code language-ts"><code>'), body);
});

test('highlighting can be turned off, and then the source is escaped as before', () => {
  const { body } = render(FENCE, { highlight: false });

  assert.equal(body.includes('<span class="token'), false);
  assert.ok(body.includes('const a = 1; // note'), body);
});

test('a language Prism does not know is left plain rather than mangled', () => {
  const { body } = render('```notalanguage\nliteral text\n```\n');

  assert.equal(body.includes('<span class="token'), false);
  assert.ok(body.includes('literal text'), body);
});

test('a fence with no language is left plain', () => {
  const { body } = render('```\njust text\n```\n');

  assert.equal(body.includes('<span class="token'), false);
});

test('shortcode brackets are still escaped inside highlighted code', () => {
  // WordPress expands shortcodes inside code as happily as anywhere else, and
  // Prism escapes `&`, `<` and `>` but not `[`.
  const { body } = render('```ts\nconst first = items[0];\n```\n');

  assert.ok(body.includes('&#91;'), body);
  assert.equal(body.includes('items[0]'), false, body);
});

test('highlighting never invents or loses source text', () => {
  const source = 'const a = 1;\nfunction f(x) { return x; }\n';
  const marked = highlightCode(source, 'ts');

  assert.ok(marked);
  const text = marked!.replace(/<[^>]+>/g, '').replace(/&#91;/g, '[').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  assert.equal(text, source);
});

/* ---------------------------------------------------------------------- *
 * The stylesheet
 * ---------------------------------------------------------------------- */

test('the stylesheet is written with the run’s own class prefix', () => {
  const css = stylesheetFor(createTheme({ classPrefix: 'docstack' }));

  assert.ok(css.includes('.docstack-docs-nav'), css.slice(0, 200));
  assert.equal(css.includes('{p}'), false, 'a placeholder survived');
  assert.equal(css.includes('.pterodoc-'), false, 'the default prefix leaked');
});

test('the stylesheet assumes neither a light theme nor a dark one', () => {
  // Every colour is mixed from currentColor, so it follows whatever the theme
  // paints its text. A bare hex would be a light-mode assumption.
  const css = stylesheetFor(createTheme({}));
  const declarations = css.match(/color:[^;}]+/g) ?? [];

  for (const declaration of declarations) {
    const fixed = /#[0-9a-f]{3,6}/i.test(declaration);
    const mixed = declaration.includes('currentColor');
    assert.ok(!fixed || mixed, `not adaptive: ${declaration}`);
  }
});

/** A page with a parent, so there is a breadcrumb to compose. */
function page(): PageLike {
  const root: PageLike = { path: '', title: 'Docs', children: [], sections: [] };
  return { path: 'guide', title: 'Guide', parent: root, children: [], sections: [] };
}

/** Compose one page under one set of options. */
function compose(options: Parameters<typeof createTheme>[0] = {}): string {
  return composePage({
    node: page(),
    body: '<!-- wp:paragraph -->\n<p>Body.</p>\n<!-- /wp:paragraph -->',
    links: new Set<string>(),
    href: (path) => `/docs/${path}`,
    lookup: () => undefined,
    theme: createTheme({ classPrefix: 'x', ...options }),
    layout: DEFAULT_LAYOUT,
  });
}

test('the stylesheet travels with the page, as a block', () => {
  const composed = compose();

  assert.ok(composed.startsWith('<!-- wp:html -->'), composed.slice(0, 80));
  assert.ok(composed.includes('<style>'), 'no style element');
  assert.ok(composed.includes('.x-docs-nav'), 'the prefix did not reach the CSS');
});

test('a site that styles its own documentation can turn it off', () => {
  const composed = compose({ styles: 'none' });

  assert.equal(composed.includes('<style>'), false);
  assert.ok(composed.startsWith('<!-- wp:columns'), composed.slice(0, 60));
});

test('the documentation is full width unless the layout says otherwise', () => {
  // Its absence is why an unstyled page came out in a narrow column.
  assert.equal(DEFAULT_LAYOUT.align, 'full');
  assert.ok(compose().includes('"align":"full"'));
  assert.ok(compose().includes('wp-block-columns alignfull'));
});
