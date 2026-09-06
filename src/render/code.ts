/**
 * Code blocks.
 *
 * Docusaurus carries extra instructions in the fence's metastring — a title,
 * highlighted line ranges, line numbers. WordPress core's code block has
 * nowhere to put them, so the title becomes a visible caption, line numbers
 * become a class a theme can act on, and anything left over is reported rather
 * than dropped in silence.
 */

import type { Code } from 'mdast';
import { escapeCode, joinBlocks, serializeBlock } from './blocks';
import type { Theme } from './theme';
import type { IssueCollector } from '../util/issues';

/** What a fence's metastring asked for. */
export interface CodeMeta {
  /** Title shown above the block. */
  title?: string;
  /** True when the fence asked for line numbers. */
  showLineNumbers: boolean;
  /** Highlighted line ranges, exactly as written. */
  highlight?: string;
}

/**
 * Read a fence's metastring.
 *
 * @param meta The text after the language on the opening fence.
 */
export function parseCodeMeta(meta: string | null | undefined): CodeMeta {
  const source = meta ?? '';
  const title = /(?:^|\s)title=(?:"([^"]*)"|'([^']*)'|([^\s]+))/.exec(source);
  const highlight = /\{([\d,\s-]+)\}/.exec(source);
  return {
    ...(title ? { title: title[1] ?? title[2] ?? title[3] ?? '' } : {}),
    showLineNumbers: /(?:^|\s)showLineNumbers(?:\s|=|$)/.test(source),
    ...(highlight ? { highlight: highlight[1]!.trim() } : {}),
  };
}

/**
 * Render a fenced code block.
 *
 * @param node The code node.
 * @param theme Class names and strings.
 * @param issues Where unrepresentable instructions are reported.
 * @param file Source file, for the issue's position.
 */
export function renderCode(
  node: Code,
  theme: Theme,
  issues?: IssueCollector,
  file?: string,
): string {
  const lang = (node.lang ?? '').toLowerCase();
  const meta = parseCodeMeta(node.meta);

  if (lang === 'mermaid') {
    // Entities are decoded again when mermaid reads the element's text, so
    // escaping keeps `A[Start]` away from the shortcode parser without
    // changing the diagram.
    return serializeBlock('html', undefined, `<pre class="mermaid">${escapeCode(node.value)}</pre>`);
  }

  const classes: string[] = [];
  if (lang) classes.push(`language-${lang}`);
  if (meta.showLineNumbers) classes.push(theme.cls('line-numbers'));

  const className = classes.join(' ');
  const attributes = className ? { className } : undefined;
  const preClasses = className ? `wp-block-code ${className}` : 'wp-block-code';
  const code = serializeBlock(
    'code',
    attributes,
    `<pre class="${preClasses}"><code>${escapeCode(node.value)}</code></pre>`,
  );

  if (meta.highlight) {
    issues?.add({
      code: 'code-highlight-dropped',
      severity: 'info',
      message: `Highlighted lines {${meta.highlight}} have no WordPress equivalent and were not carried over.`,
      file,
      line: node.position?.start.line,
    });
  }

  if (!meta.title) return code;

  const caption = serializeBlock(
    'paragraph',
    { className: theme.cls('code-title') },
    `<p class="${theme.cls('code-title')}">${escapeCode(meta.title)}</p>`,
  );
  const groupClass = theme.cls('code-group');
  return serializeBlock(
    'group',
    { className: groupClass },
    `<div class="wp-block-group ${groupClass}">${joinBlocks([caption, code])}</div>`,
  );
}
