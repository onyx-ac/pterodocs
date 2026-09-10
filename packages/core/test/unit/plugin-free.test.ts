/**
 * Looking right without anything installed.
 *
 * WordPress renders core blocks with almost no opinion, so what pterodocs
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

/** One declaration block from the stylesheet, found by a selector fragment. */
function ruleFor(what: string): string {
  const css = stylesheetFor(createTheme({ classPrefix: 'x' }));
  const selectors: Record<string, string> = { 'inline code': ':not(pre)>code' };
  const line = css.split(String.fromCharCode(10)).find((l) => l.includes(selectors[what] as string));
  assert.ok(line, `no rule for ${what}`);
  return line as string;
}

test('the stylesheet is written with the run’s own class prefix', () => {
  const css = stylesheetFor(createTheme({ classPrefix: 'docstack' }));

  assert.ok(css.includes('.docstack-docs-nav'), css.slice(0, 200));
  assert.equal(css.includes('{p}'), false, 'a placeholder survived');
  assert.equal(css.includes('.pterodocs-'), false, 'the default prefix leaked');
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

test('inline code gets a ground, an edge and room to breathe', () => {
  // A theme that styles it at all usually only changes the font, which leaves a
  // word in a different face sitting on nothing.
  const rule = ruleFor('inline code');

  assert.ok(rule.includes('background:'), rule);
  assert.ok(rule.includes('border:'), rule);
  assert.ok(rule.includes('padding:'), rule);
  assert.ok(rule.includes('border-radius:'), rule);
});

test('the inline code chip is mixed from the text colour, never painted', () => {
  // The property the whole rule exists for: on a dark theme the chip has to
  // lighten what is behind it. A literal pale background would be a white chip.
  const rule = ruleFor('inline code');
  const background = /background:([^;}]+)/.exec(rule)?.[1] ?? '';

  assert.ok(background.includes('currentColor'), background);
  assert.equal(/#[0-9a-f]{3,6}/i.test(background), false, background);
  assert.equal(/(white|black|#fff|#000)/i.test(background), false, background);
});

test('the accent only tints the inline code text, so it cannot go unreadable', () => {
  // Blended on top of currentColor rather than replacing it: a theme whose
  // primary is very light or very dark still leaves legible text.
  const rule = ruleFor('inline code');
  const colour = /(?:^|;)color:([^;}]+)/.exec(rule)?.[1] ?? '';

  assert.ok(colour.includes('currentColor'), colour);
  assert.ok(colour.includes('-accent'), colour);
});

test('the inline rule does not reach inside a code block', () => {
  // `.wp-block-code` is a pre, and its contents are already styled as a block.
  const rule = ruleFor('inline code');

  assert.ok(rule.includes(':not(pre)>code'), rule);
});

test('inline code inside a link keeps the link’s colour', () => {
  const css = stylesheetFor(createTheme({ classPrefix: 'x' }));

  assert.ok(css.includes(':where(.x-docs-main) a code{color:inherit}'), 'no link reset');
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

/* ---------------------------------------------------------------------- *
 * The navigation toggle
 * ---------------------------------------------------------------------- */

test('the navigation is opened by a control that needs no script', () => {
  const composed = compose();
  // Only the markup: the class names appear in the stylesheet too, and an
  // assertion that matched those would pass whatever the markup did.
  const markup = composed.slice(composed.indexOf('<!-- wp:columns'));

  assert.ok(markup.includes('type="checkbox"'), 'no checkbox');
  assert.ok(markup.includes('for="x-docs-nav-toggle"'), 'the label does not point at it');
  assert.ok(markup.includes('x-docs-scrim'), 'nothing to close it from outside');
});

test('the control shares a row with the breadcrumb', () => {
  // They are one bar on a small screen, which is why they are one block.
  const markup = compose().slice(compose().indexOf('<!-- wp:columns'));
  const bar = markup.slice(markup.indexOf('x-docs-bar'));

  assert.ok(bar.indexOf('x-docs-toggle-label') < bar.indexOf('x-docs-docs-breadcrumb') || bar.includes('x-docs-breadcrumb'));
  assert.ok(bar.includes('x-docs-breadcrumb'), 'the breadcrumb is not in the bar');
});

test('the control does not have to sit beside the list it opens', () => {
  // The list is in the navigation column and the control is in the document
  // column; :has() is what connects them, so source order carries no meaning.
  const markup = compose().slice(compose().indexOf('<!-- wp:columns'));

  assert.ok(markup.indexOf('wp:page-list') < markup.indexOf('type="checkbox"'));
});

test('the toggle’s id is fixed, so a page does not differ from itself', () => {
  // A generated id would make every page change on every sync, for ever.
  assert.equal(compose(), compose());
});

test('a site that does not want the control can drop it', () => {
  const composed = composePage({
    node: page(),
    body: '',
    links: new Set<string>(),
    href: (path) => `/docs/${path}`,
    lookup: () => undefined,
    theme: createTheme({ classPrefix: 'x' }),
    layout: { ...DEFAULT_LAYOUT, navToggle: false },
  });

  assert.equal(composed.includes('type="checkbox"'), false);
  assert.ok(composed.includes('wp:page-list'));
});

test('the documentation pads itself, because alignfull escapes the theme’s padding', () => {
  const css = stylesheetFor(createTheme({ classPrefix: 'x' }));
  const root = css.split(String.fromCharCode(10)).find((line) => line.includes('.x-docs{display:'));

  assert.ok(root, 'the layout rule is missing');
  assert.ok(root!.includes('padding-inline'), root);
});

test('the two columns cannot overflow the page', () => {
  // The columns carry inline flex-basis:25% and 75%, which together are the
  // whole content box. Laid out as flex, any gap pushes the document off the
  // right edge, and an inline style cannot be overridden from a stylesheet.
  // Grid ignores flex-basis, and 1fr accounts for the gap by itself.
  const css = stylesheetFor(createTheme({ classPrefix: 'x' }));
  const root = css.split(String.fromCharCode(10)).find((line) => line.includes('.x-docs{display:'));

  assert.ok(root, 'the layout rule is missing');
  assert.ok(root!.includes('display:grid'), root);
  assert.equal(root!.includes('display:flex'), false, root);
  // Both tracks must be allowed to shrink below their content.
  assert.ok(root!.includes('minmax(0,'), root);

  // And it has to outrank core, which ships .wp-block-columns{display:flex} at
  // one class. Wrapped in :where() this rule scores zero and never applies.
  assert.ok(root!.startsWith('.wp-block-columns.x-docs'), root);
  assert.equal(root!.includes(':where'), false, root);
});

test('the configured navigation width reaches the layout', () => {
  // A grid ignores the inline flex-basis the columns carry, so the setting has
  // to arrive as a custom property or it would quietly stop meaning anything.
  const css = stylesheetFor(createTheme({ classPrefix: 'x' }), { navWidth: '30%' });

  assert.ok(css.includes('--x-nav-width:30%'), css.slice(0, 120));
});

test('a nonsense width is ignored rather than written into the page', () => {
  const css = stylesheetFor(createTheme({ classPrefix: 'x' }), { navWidth: 'red;}body{display:none' });

  // The stylesheet has its own display:none rules, so asserting on that would
  // prove nothing. What matters is that the property is never written at all.
  // The template *reads* the property with a fallback, so its name appears
  // either way. What must not appear is a declaration setting it.
  assert.equal(css.includes('--x-nav-width:'), false);
  assert.equal(css.includes('body{'), false);
});
