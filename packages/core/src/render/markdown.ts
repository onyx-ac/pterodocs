/**
 * Serialising a document back to markdown.
 *
 * The renderer's job is Gutenberg blocks, but an `llms-full.txt` wants the same
 * documents as markdown, and the useful moment to take that copy is in the
 * middle of the pipeline rather than at either end.
 *
 * By the time this runs, MDX has been lowered, references have been resolved
 * and — the part that matters — links have been rewritten to point at the
 * target. Serialising here therefore yields markdown whose links are the
 * published URLs, which is the whole reason not to reuse the markdown a
 * Docusaurus plugin wrote at build time: that copy still points at the
 * Docusaurus site.
 *
 * The plugin list mirrors `parse.ts`. Each of these contributes serialising
 * handlers as well as parsing ones, so a tree that round-trips through the
 * parser round-trips back out: tables need gfm, `:::note` needs directive, and
 * any JSX that survived lowering needs mdx.
 */

import { unified, type Processor } from 'unified';
import remarkStringify from 'remark-stringify';
import remarkGfm from 'remark-gfm';
import remarkDirective from 'remark-directive';
import remarkMdx from 'remark-mdx';
import { visit } from 'unist-util-visit';
import type { Image, Root } from 'mdast';

/**
 * Built once and reused, like the parsers.
 *
 * The options pin the choices `mdast-util-to-markdown` would otherwise make by
 * counting what is already in the tree, so the same document always serialises
 * the same way. That matters because this output is compared between runs.
 */
const processor = (
  unified()
    .use(remarkStringify, {
      // A dash is what a person writes, and what Prettier leaves behind.
      bullet: '-',
      // Never indent a code block to mean a fence: an indented block loses its
      // language, and the language is most of what a reader gets from it.
      fences: true,
      rule: '-',
      // `_` reads as emphasis inside a word; `*` is safer next to punctuation.
      emphasis: '_',
      strong: '*',
    })
    .use(remarkGfm)
    .use(remarkDirective) as unknown as { use: (plugin: unknown) => Processor<Root> }
).use(remarkMdx);

/**
 * Serialise a document tree to markdown.
 *
 * Image sources are pointed at the uploaded copies the same way the image
 * block points at them. Link rewriting has already happened on the tree, but
 * images are not links: the renderer resolves those against the media map as
 * it emits each block, so without this the markdown would keep the paths the
 * author wrote, which resolve against the Docusaurus source tree and nothing
 * else.
 *
 * The swap is undone before returning. The tree still has to render to blocks
 * afterwards, and that lookup is keyed on the source URL.
 *
 * @param tree The tree, after lowering and link rewriting.
 * @param options The uploaded media, keyed by the URL as written in the source.
 * @returns Markdown, ending in a single newline.
 */
export function toMarkdown(
  tree: Root,
  options: { media?: Map<string, { id: number; url: string }> | undefined } = {},
): string {
  const swapped: { node: Image; url: string }[] = [];

  if (options.media?.size) {
    visit(tree, 'image', (node: Image) => {
      const uploaded = options.media?.get(node.url);
      if (!uploaded) return;
      swapped.push({ node, url: node.url });
      node.url = uploaded.url;
    });
  }

  try {
    return String((processor as unknown as { stringify: (t: Root) => unknown }).stringify(tree));
  } finally {
    for (const { node, url } of swapped) node.url = url;
  }
}
