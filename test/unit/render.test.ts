/** Markdown to Gutenberg block markup. */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderDoc, renderBlock, createRenderContext } from '../../src/render/index';
import { serializeAttrs, escapeCode, escapeText } from '../../src/render/blocks';
import { renderInline } from '../../src/render/inline';
import { createSlugger, headingIdFor } from '../../src/render/slug';
import { excerptFrom } from '../../src/render/excerpt';
import { parseCodeMeta } from '../../src/render/code';
import { parseMarkdown, detectFormat } from '../../src/render/parse';
import { createTheme } from '../../src/render/theme';
import { toInternalPath } from '../../src/render/links';
import { IssueCollector } from '../../src/util/issues';
import { FIXTURES, goldenPath, renderFixture } from '../fixtures/render-fixture';

const fixturesDir = path.dirname(fileURLToPath(new URL('../fixtures/x', import.meta.url)));

/** Render a snippet with the defaults most tests want. */
function render(markdown: string, resolveLink?: Parameters<typeof renderDoc>[0]['resolveLink']) {
  return renderDoc({
    markdown,
    file: 'test.md',
    permalink: '/docs/test',
    theme: createTheme({ classPrefix: 'x' }),
    ...(resolveLink ? { resolveLink } : {}),
  });
}

for (const name of FIXTURES) {
  test(`the ${name} fixture matches its golden markup`, () => {
    const { body } = renderFixture(name);
    assert.equal(body, fs.readFileSync(goldenPath(name), 'utf8').trimEnd());
  });
}

test('the rendering matches the tool this package was extracted from', () => {
  // Byte-for-byte parity with the DocStack sync script's own golden, so the
  // extraction cannot have changed the output by accident.
  const v0 = fs.readFileSync(path.join(fixturesDir, 'v0-sample.expected.html'), 'utf8');
  assert.equal(`${renderFixture('sample').body}\n`, v0);
});

test('a reference-style link becomes a real link and its definition disappears', () => {
  const { body } = render('See [it][ref].\n\n[ref]: ./other.md\n', (href) =>
    href === './other.md' ? { href: '/wp/other/', path: 'other' } : { href },
  );
  assert.ok(body.includes('<a href="/wp/other/">it</a>'), body);
  assert.ok(!body.includes('[ref]:'), 'the definition must not reach the page');
});

test('a reference with no definition stays as the text that was typed', () => {
  const { body } = render('See [it][missing].\n');
  assert.ok(body.includes('&#91;it]&#91;missing]'), body);
  assert.ok(!body.includes('<a '), body);
});

test('a leading H1 is dropped even when a comment comes first', () => {
  const { body } = render('<!-- hello -->\n\n# The title\n\nBody.\n');
  assert.ok(!body.includes('<h1'), body);
  assert.ok(body.startsWith('<!-- wp:paragraph -->'), body);
});

test('a later H1 survives, because it is not the title', () => {
  const { body } = render('Intro.\n\n# Later\n');
  assert.ok(body.includes('<!-- wp:heading {"level":1} -->'), body);
});

test('a standalone image becomes an image block and an inline one stays inline', () => {
  const standalone = render('![Alt](./a.png "Caption")\n').body;
  assert.ok(standalone.includes('<!-- wp:image'), standalone);
  assert.ok(standalone.includes('<figcaption class="wp-element-caption">Caption</figcaption>'));

  const inline = render('Text with ![Alt](./a.png) inside.\n').body;
  assert.ok(inline.startsWith('<!-- wp:paragraph -->'), inline);
  assert.ok(inline.includes('<img src="./a.png"'), inline);
});

test('an image URL containing a quote cannot break out of the attribute', () => {
  const { body } = render('![a"b](./x".png)\n');
  assert.ok(body.includes('src="./x&quot;.png"'), body);
  assert.ok(body.includes('alt="a&quot;b"'), body);
});

test('a code fence carries its title, line numbers and a note about what was lost', () => {
  const { body, issues } = render('```ts title="a.ts" showLineNumbers {1,3}\nconst a = 1;\n```\n');
  assert.ok(body.includes('x-code-title'), body);
  assert.ok(body.includes('a.ts'), body);
  assert.ok(body.includes('language-ts x-line-numbers'), body);
  assert.equal(issues.issues[0]?.code, 'code-highlight-dropped');
});

test('code metastrings parse in the shapes Docusaurus accepts', () => {
  assert.deepEqual(parseCodeMeta('title="a b.ts" showLineNumbers {1,3-5}'), {
    title: 'a b.ts',
    showLineNumbers: true,
    highlight: '1,3-5',
  });
  assert.deepEqual(parseCodeMeta(''), { showLineNumbers: false });
  assert.equal(parseCodeMeta("title='x.ts'").title, 'x.ts');
});

test('mermaid keeps its source and hides brackets from the shortcode parser', () => {
  const { body } = render('```mermaid\ngraph TD\n  A[Start] --> B\n```\n');
  assert.ok(body.includes('<pre class="mermaid">'), body);
  assert.ok(body.includes('A&#91;Start]'), body);
});

test('shortcode brackets are escaped in text but never inside a tag', () => {
  const { body } = render('<a href="/x?a[]=1" title="a > b">link</a>\n');
  assert.ok(body.includes('href="/x?a[]=1"'), body);
  assert.ok(body.includes('title="a > b"'), body);
});

test('a list holding a code block falls back to HTML rather than invalid blocks', () => {
  const { body, issues } = render('- Step one:\n\n    ```js\n    go();\n    ```\n\n- Step two\n');
  assert.ok(body.includes('<!-- wp:html -->'), body);
  assert.ok(!body.includes('<!-- wp:list-item -->'), body);
  assert.equal(issues.issues[0]?.code, 'list-not-representable');
});

test('an unrecognised directive keeps its content and says so', () => {
  const { body, issues } = render(':::mystery\nStill here.\n:::\n');
  assert.ok(body.includes('Still here.'), body);
  assert.equal(issues.issues[0]?.code, 'directive-unknown');
});

test('admonition keywords come from the site, not from a guess', () => {
  const withSuccess = renderDoc({
    markdown: ':::success\nIt worked.\n:::\n',
    permalink: '/docs/t',
    theme: createTheme({ classPrefix: 'x' }),
  });
  assert.ok(withSuccess.body.includes('x-admonition x-admonition-success'), withSuccess.body);

  const narrowed = renderDoc({
    markdown: ':::success\nIt worked.\n:::\n',
    permalink: '/docs/t',
    theme: createTheme({ classPrefix: 'x' }),
    admonitionKeywords: ['note'],
  });
  assert.ok(!narrowed.body.includes('x-admonition-success'), narrowed.body);
});

test('block attributes are encoded the way WordPress encodes them', () => {
  assert.equal(serializeAttrs({ className: 'a--b' }), '{"className":"a\\u002d\\u002db"}');
  assert.equal(serializeAttrs({ x: '<i>&' }), '{"x":"\\u003ci\\u003e\\u0026"}');
});

test('code and text escaping cover the characters that would break a page', () => {
  assert.equal(escapeCode('a < b & c [d]'), 'a &lt; b &amp; c &#91;d]');
  assert.equal(escapeText('a "b" [c]'), 'a &quot;b&quot; &#91;c]');
});

test('inline content converts in one pass, without stray whitespace', () => {
  const [paragraph] = parseMarkdown('a `b` c [d](/e) f').children;
  const html = renderInline((paragraph as { children: never[] }).children);
  assert.equal(html, 'a <code>b</code> c <a href="/e">d</a> f');
});

test('heading ids follow the text, and an explicit id wins', () => {
  const slugger = createSlugger();
  const [plain] = parseMarkdown('## A heading, with punctuation!').children;
  assert.equal(headingIdFor(plain as never, slugger).id, 'a-heading-with-punctuation');
  const [explicit] = parseMarkdown('## Labeling {#labeling}').children;
  const result = headingIdFor(explicit as never, slugger);
  assert.equal(result.id, 'labeling');
  assert.equal(result.text, 'Labeling');
});

test('repeated headings get distinct ids', () => {
  const { body } = render('## Same\n\n## Same\n');
  assert.ok(body.includes('id="same"'), body);
  assert.ok(body.includes('id="same-1"'), body);
});

test('relative links resolve against the linking page, absolute ones stay put', () => {
  assert.deepEqual(toInternalPath('./b.md', '/docs/a/'), { urlPath: '/docs/b', hash: '' });
  assert.deepEqual(toInternalPath('../c/d.md#x', '/docs/a/b/'), { urlPath: '/docs/c/d', hash: '#x' });
  assert.deepEqual(toInternalPath('/docs/e', '/docs/a/'), { urlPath: '/docs/e', hash: '' });
  assert.equal(toInternalPath('#top', '/docs/a/'), undefined);
  assert.equal(toInternalPath('https://example.com', '/docs/a/'), undefined);
});

test('a link with no published target keeps its words and loses the link', () => {
  const { body } = render('See [it](./gone.md).\n', () => ({ href: null }));
  assert.ok(!body.includes('<a '), body);
  assert.ok(body.includes('See it.'), body);
});

test('the markdown flavour follows the file extension when Docusaurus says detect', () => {
  assert.equal(detectFormat('a/b.md'), 'md');
  assert.equal(detectFormat('a/b.markdown'), 'md');
  assert.equal(detectFormat('a/b.mdx'), 'mdx');
});

test('excerpts break on a word and only when they must', () => {
  assert.equal(excerptFrom('  short   text '), 'short text');
  const long = excerptFrom('word '.repeat(60), 40);
  assert.ok(long.length <= 41, long);
  assert.ok(long.endsWith('…'));
});

test('an empty paragraph produces no block', () => {
  const ctx = createRenderContext({
    theme: createTheme(),
    slugger: createSlugger(),
    issues: new IssueCollector(),
  });
  assert.equal(renderBlock({ type: 'paragraph', children: [] } as never, ctx), '');
});
