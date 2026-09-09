/**
 * The files an LLM reads instead of the site.
 *
 * The properties worth holding are the three that make these files describe
 * the site they are served from rather than the site they were built from: the
 * links are the target's, the selection is what was published, and nothing
 * published is missing from the index.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { renderLlmsIndex, renderLlmsFull, type LlmsInput } from '../../src/sync/llms';
import { renderDoc } from '../../src/render/index';
import { createTheme } from '../../src/render/theme';

/** A small published tree, in sidebar order, root first. */
function input(overrides: Partial<LlmsInput> = {}): LlmsInput {
  return {
    title: 'DocStack',
    description: 'A document store.',
    pages: [
      { path: '', title: 'Documentation', description: '', href: 'https://onyx.ac/products/docstack/docs/' },
      {
        path: 'get-started',
        title: 'Get started',
        description: 'Install and run.',
        href: 'https://onyx.ac/products/docstack/docs/get-started/',
        markdown: 'Install it.\n',
      },
      {
        path: 'get-started/install',
        title: 'Install',
        description: '',
        href: 'https://onyx.ac/products/docstack/docs/get-started/install/',
        markdown: 'Run `npm i`.\n',
      },
      {
        path: 'guides',
        title: 'Guides',
        description: '',
        href: 'https://onyx.ac/products/docstack/docs/guides/',
      },
    ],
    ...overrides,
  };
}

test('the index links to the target, never to where the documents came from', () => {
  // The whole reason this is not reused from a build-time plugin: that copy
  // links to the Docusaurus site.
  const index = renderLlmsIndex(input());

  for (const line of index.split('\n').filter((l) => l.includes(']('))) {
    assert.ok(line.includes('https://onyx.ac/products/docstack/docs/'), line);
  }
});

test('the index opens with the title and a summary, as the format asks', () => {
  const index = renderLlmsIndex(input());

  assert.ok(index.startsWith('# DocStack\n'), index.slice(0, 40));
  assert.ok(index.includes('\n> A document store.\n'), index);
});

test('sections come from the documentation’s own top level', () => {
  const index = renderLlmsIndex(input());
  const headings = index.split('\n').filter((line) => line.startsWith('## '));

  assert.deepEqual(headings, ['## Get started', '## Guides']);
});

test('the list nests, so the sidebar’s shape survives', () => {
  // A flat list would throw away the one thing this tool knows that a crawler
  // reading the published HTML does not.
  const index = renderLlmsIndex(input());

  assert.ok(index.includes('\n- [Get started]'), index);
  assert.ok(index.includes('\n  - [Install]'), index);
});

test('a category with no page of its own still opens its list at the margin', () => {
  // Not every category is published as a page. Indenting by absolute depth
  // would open the section with an item nested under nothing.
  const index = renderLlmsIndex(
    input({
      pages: [
        { path: 'reference/api', title: 'API', description: '', href: 'https://onyx.ac/d/reference/api/' },
        { path: 'reference/api/get', title: 'GET', description: '', href: 'https://onyx.ac/d/reference/api/get/' },
      ],
    }),
  );

  assert.ok(index.includes('## reference'), index);
  assert.ok(index.includes('\n- [API]'), index);
  assert.ok(index.includes('\n  - [GET]'), index);
});

test('a description becomes the note the format puts after the link', () => {
  const index = renderLlmsIndex(input());

  assert.ok(index.includes('](https://onyx.ac/products/docstack/docs/get-started/): Install and run.'), index);
});

test('every published page reaches the index, including ones with no document', () => {
  // Guides is a category with no page of its own. Dropping it would hide
  // everything filed under it.
  const index = renderLlmsIndex(input());

  for (const page of input().pages) {
    assert.ok(index.includes(`(${page.href})`), `${page.path || '(root)'} is missing`);
  }
});

test('the full file inlines each document under its own title', () => {
  const full = renderLlmsFull(input());

  assert.ok(full.includes('# Install\n'), full);
  assert.ok(full.includes('Source: https://onyx.ac/products/docstack/docs/get-started/install/'), full);
  assert.ok(full.includes('Run `npm i`.'), full);
});

test('pages in the full file are separated, so where one ends is unambiguous', () => {
  const full = renderLlmsFull(input());
  const rules = full.split('\n').filter((line) => line === '---');

  assert.equal(rules.length, input().pages.length);
});

test('a page with no document still appears, rather than being silently dropped', () => {
  const full = renderLlmsFull(input());

  assert.ok(full.includes('# Guides'), full);
  assert.ok(full.includes('https://onyx.ac/products/docstack/docs/guides/'), full);
});

test('a site with no description omits the summary rather than emitting an empty one', () => {
  const index = renderLlmsIndex(input({ description: '' }));

  assert.equal(index.includes('>'), false, index);
});

/* ---------------------------------------------------------------------- *
 * Where the markdown comes from
 * ---------------------------------------------------------------------- */

test('the markdown a document contributes carries the rewritten links', () => {
  // This is the property that makes generating the file worth the work: the
  // link is resolved to the target while the tree is still a tree.
  const rendered = renderDoc({
    markdown: 'See [the other page](./other.md).\n',
    file: 'test.md',
    permalink: '/docs/test',
    theme: createTheme({ classPrefix: 'x' }),
    emitMarkdown: true,
    resolveLink: () => ({ href: 'https://onyx.ac/products/docstack/docs/other/' }),
  });

  assert.ok(rendered.markdown, 'no markdown was emitted');
  assert.ok(
    rendered.markdown!.includes('[the other page](https://onyx.ac/products/docstack/docs/other/)'),
    rendered.markdown,
  );
});

test('markdown is not produced unless it was asked for', () => {
  const rendered = renderDoc({
    markdown: 'Text.\n',
    file: 'test.md',
    permalink: '/docs/test',
    theme: createTheme({ classPrefix: 'x' }),
  });

  assert.equal(rendered.markdown, undefined);
});

test('emitting markdown does not change the blocks that get published', () => {
  const source = '# Heading\n\nText with `code`.\n\n| a | b |\n| - | - |\n| 1 | 2 |\n';
  const args = {
    markdown: source,
    file: 'test.md',
    permalink: '/docs/test',
    theme: createTheme({ classPrefix: 'x' }),
  };

  assert.equal(renderDoc({ ...args, emitMarkdown: true }).body, renderDoc(args).body);
});

test('a table survives the round trip back to markdown', () => {
  // Serialising needs the same extensions as parsing, and a table is the
  // cheapest way to notice one of them missing.
  const rendered = renderDoc({
    markdown: '| a | b |\n| - | - |\n| 1 | 2 |\n',
    file: 'test.md',
    permalink: '/docs/test',
    theme: createTheme({ classPrefix: 'x' }),
    emitMarkdown: true,
  });

  assert.ok(rendered.markdown!.includes('| a | b |'), rendered.markdown);
  assert.ok(rendered.markdown!.includes('| 1 | 2 |'), rendered.markdown);
});

test('an admonition survives the round trip back to markdown', () => {
  const rendered = renderDoc({
    markdown: ':::note[Heads up]\nCareful.\n:::\n',
    file: 'test.md',
    permalink: '/docs/test',
    theme: createTheme({ classPrefix: 'x' }),
    emitMarkdown: true,
  });

  assert.ok(rendered.markdown!.includes(':::note[Heads up]'), rendered.markdown);
  assert.ok(rendered.markdown!.includes('Careful.'), rendered.markdown);
});

test('an image points at the uploaded copy, not at the path the author wrote', () => {
  // Images are not links, so link rewriting does not reach them: the renderer
  // resolves them against the media map as it emits each block. Without the
  // same lookup here the markdown would keep a path that resolves against the
  // Docusaurus source tree and nowhere else.
  const media = new Map([['./img/pixel.png', { id: 7, url: 'https://onyx.ac/wp-content/uploads/pixel.png' }]]);
  const rendered = renderDoc({
    markdown: '![A pixel](./img/pixel.png)\n',
    file: 'test.md',
    permalink: '/docs/test',
    theme: createTheme({ classPrefix: 'x' }),
    emitMarkdown: true,
    media,
  });

  assert.ok(rendered.markdown!.includes('https://onyx.ac/wp-content/uploads/pixel.png'), rendered.markdown);
  assert.equal(rendered.markdown!.includes('./img/pixel.png'), false, rendered.markdown);
});

test('the blocks still find their media after the markdown copy is taken', () => {
  // The swap has to be undone: the block renderer looks the image up by the
  // URL the author wrote, and it runs after this.
  const media = new Map([['./img/pixel.png', { id: 7, url: 'https://onyx.ac/wp-content/uploads/pixel.png' }]]);
  const args = {
    markdown: '![A pixel](./img/pixel.png)\n',
    file: 'test.md',
    permalink: '/docs/test',
    theme: createTheme({ classPrefix: 'x' }),
    media,
  };

  const withCopy = renderDoc({ ...args, emitMarkdown: true });
  assert.ok(withCopy.body.includes('wp-image-7'), withCopy.body);
  assert.equal(withCopy.body, renderDoc(args).body);
});

test('an image with no uploaded copy keeps the path it was written with', () => {
  const rendered = renderDoc({
    markdown: '![A pixel](./img/pixel.png)\n',
    file: 'test.md',
    permalink: '/docs/test',
    theme: createTheme({ classPrefix: 'x' }),
    emitMarkdown: true,
  });

  assert.ok(rendered.markdown!.includes('./img/pixel.png'), rendered.markdown);
});

test('a fenced block keeps its language, because the language is most of the point', () => {
  const rendered = renderDoc({
    markdown: '```ts\nconst a = 1;\n```\n',
    file: 'test.md',
    permalink: '/docs/test',
    theme: createTheme({ classPrefix: 'x' }),
    emitMarkdown: true,
  });

  assert.ok(rendered.markdown!.includes('```ts'), rendered.markdown);
});
