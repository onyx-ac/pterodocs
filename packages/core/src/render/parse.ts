/**
 * Markdown and MDX parsing.
 *
 * Two processors, built once and reused: Docusaurus decides per document
 * whether a file is plain markdown or MDX, and the model carries that decision
 * so it is never guessed here.
 */

import { unified, type Processor } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkDirective from 'remark-directive';
import remarkFrontmatter from 'remark-frontmatter';
import remarkMdx from 'remark-mdx';
import type { Root } from 'mdast';

/** Which flavour a document is written in. */
export type MarkdownFormat = 'md' | 'mdx';

/** Extensions Docusaurus treats as plain markdown when `format: 'detect'`. */
const PLAIN_EXTENSIONS = new Set([
  '.md',
  '.markdown',
  '.mdown',
  '.mkdn',
  '.mkd',
  '.mdwn',
  '.mkdown',
  '.ron',
]);

/**
 * Resolve `format: 'detect'` the way Docusaurus does: by extension.
 *
 * @param filePath Path of the source file.
 */
export function detectFormat(filePath: string): MarkdownFormat {
  const dot = filePath.lastIndexOf('.');
  const extension = dot === -1 ? '' : filePath.slice(dot).toLowerCase();
  return PLAIN_EXTENSIONS.has(extension) ? 'md' : 'mdx';
}

const base = (): Processor<Root> =>
  unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ['yaml'])
    .use(remarkGfm)
    .use(remarkDirective) as unknown as Processor<Root>;

const markdownProcessor = base();
const mdxProcessor = (base() as never as { use: (p: unknown) => Processor<Root> }).use(remarkMdx);

/**
 * Parse a document body.
 *
 * Only the parser runs: no transformers, no compiler. The tree is what the
 * rest of the renderer works on.
 *
 * @param markdown The body, with front matter already removed.
 * @param format Which flavour to parse as.
 */
export function parseMarkdown(markdown: string, format: MarkdownFormat = 'md'): Root {
  const processor = format === 'mdx' ? mdxProcessor : markdownProcessor;
  return processor.parse(markdown) as Root;
}
