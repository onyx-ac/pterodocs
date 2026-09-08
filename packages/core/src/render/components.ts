/**
 * The MDX component table.
 *
 * Docusaurus ships a small set of components that documentation actually uses.
 * Each one here has a WordPress block that carries the same meaning; anything
 * else is reported by the lowering pass rather than guessed at.
 */

import type { RootContent } from 'mdast';
import { escapeText, joinBlocks, serializeBlock } from './blocks';
import { escapeCode } from './blocks';
import type { Theme } from './theme';
import type { IssueCollector } from '../util/issues';
import { HTML_ELEMENTS } from './mdx';

/** A JSX element as mdast holds it. */
export interface JsxElement {
  type: string;
  name?: string | null;
  attributes?: {
    type: string;
    name?: string;
    value?: unknown;
  }[];
  children?: RootContent[];
  position?: { start: { line: number; column: number; offset?: number }; end: { offset?: number } };
}

/** Read a string attribute, ignoring expression values we cannot evaluate. */
export function attribute(element: JsxElement, name: string): string | undefined {
  for (const attr of element.attributes ?? []) {
    if (attr.type !== 'mdxJsxAttribute' || attr.name !== name) continue;
    if (typeof attr.value === 'string') return attr.value;
    const value = attr.value as { type?: string; value?: string } | null;
    if (value && typeof value.value === 'string') return value.value;
    return undefined;
  }
  return undefined;
}

/** What a component renderer is given. */
export interface ComponentContext {
  theme: Theme;
  issues: IssueCollector;
  source: string;
  file?: string | undefined;
  /** Render an ordinary markdown node. */
  renderChild: (node: RootContent) => string;
}

/** A details block, which is what a collapsible section becomes. */
function detailsBlock(summary: string, inner: string): string {
  return serializeBlock(
    'details',
    undefined,
    `<details class="wp-block-details"><summary>${escapeText(summary)}</summary>${inner}</details>`,
  );
}

/** Render `<TabItem>` as one collapsible section. */
function renderTabItem(element: JsxElement, ctx: ComponentContext): string {
  const label = attribute(element, 'label') ?? attribute(element, 'value') ?? 'Tab';
  const inner = joinBlocks((element.children ?? []).map(ctx.renderChild));
  return detailsBlock(label, inner);
}

/**
 * Render `<Tabs>`.
 *
 * Tabs need JavaScript that a published page does not have, so each tab
 * becomes a collapsible section instead. All of the content survives, and it
 * stays readable without any script at all.
 */
function renderTabs(element: JsxElement, ctx: ComponentContext): string {
  const items = (element.children ?? []).filter(
    (child) => (child as JsxElement).name === 'TabItem',
  ) as JsxElement[];

  const rendered = items.map((item) => renderTabItem(item, ctx));
  const className = ctx.theme.cls('tabs');
  return serializeBlock(
    'group',
    { className },
    `<div class="wp-block-group ${className}">${joinBlocks(rendered)}</div>`,
  );
}

/** Render `<Details>` or a raw `<details>` element. */
function renderDetails(element: JsxElement, ctx: ComponentContext): string {
  const children = [...(element.children ?? [])];
  let summary = attribute(element, 'summary') ?? '';

  const summaryIndex = children.findIndex((child) => (child as JsxElement).name === 'summary');
  if (summaryIndex !== -1) {
    const node = children[summaryIndex] as JsxElement;
    summary = plainText(node, ctx.source);
    children.splice(summaryIndex, 1);
  }

  return detailsBlock(summary || 'Details', joinBlocks(children.map(ctx.renderChild)));
}

/** Render `<CodeBlock language="ts" title="x">`. */
function renderCodeBlock(element: JsxElement, ctx: ComponentContext): string {
  const language = attribute(element, 'language') ?? '';
  const title = attribute(element, 'title');
  // The children parse as ordinary markdown, so the code arrives as text
  // inside paragraphs rather than as one raw string.
  const value = textContent(element.children ?? []);

  const classes = language ? `wp-block-code language-${language}` : 'wp-block-code';
  const code = serializeBlock(
    'code',
    language ? { className: `language-${language}` } : undefined,
    `<pre class="${classes}"><code>${escapeCode(value)}</code></pre>`,
  );
  if (!title) return code;

  const groupClass = ctx.theme.cls('code-group');
  const titleClass = ctx.theme.cls('code-title');
  return serializeBlock(
    'group',
    { className: groupClass },
    `<div class="wp-block-group ${groupClass}">${joinBlocks([
      serializeBlock('paragraph', { className: titleClass }, `<p class="${titleClass}">${escapeText(title)}</p>`),
      code,
    ])}</div>`,
  );
}

/** Render `<Admonition type="tip" title="…">`. */
function renderAdmonitionElement(element: JsxElement, ctx: ComponentContext): string {
  const type = (attribute(element, 'type') ?? 'note').toLowerCase();
  const label = attribute(element, 'title') ?? type.charAt(0).toUpperCase() + type.slice(1);
  const base = ctx.theme.cls('admonition');
  const className = `${base} ${base}-${type}`;
  const titleClass = ctx.theme.cls('admonition-title');

  const inner = joinBlocks([
    serializeBlock(
      'paragraph',
      { className: titleClass },
      `<p class="${titleClass}"><strong>${escapeText(label)}</strong></p>`,
    ),
    ...(element.children ?? []).map(ctx.renderChild),
  ]);
  return serializeBlock(
    'group',
    { className },
    `<div class="wp-block-group ${className}">${inner}</div>`,
  );
}

/**
 * The text a run of nodes carries.
 *
 * Block-level children are separated by a blank line, which is what keeps the
 * lines of a code block apart once MDX has parsed them into paragraphs.
 */
function textContent(nodes: RootContent[]): string {
  const blocks: string[] = [];
  for (const node of nodes) {
    const parts: string[] = [];
    const walk = (child: { type?: string; value?: string; children?: unknown[] }): void => {
      if (typeof child.value === 'string' && child.type !== 'html') parts.push(child.value);
      for (const grandChild of (child.children ?? []) as never[]) walk(grandChild);
    };
    walk(node as never);
    const text = parts.join('');
    if (text !== '') blocks.push(text);
  }
  return blocks.join('\n\n');
}

/** The text inside an element, for a summary. */
function plainText(element: JsxElement, source: string): string {
  const parts: string[] = [];
  const walk = (node: { type?: string; value?: string; children?: unknown[] }): void => {
    if (typeof node.value === 'string' && node.type === 'text') parts.push(node.value);
    for (const child of (node.children ?? []) as never[]) walk(child);
  };
  walk(element as never);
  const text = parts.join('').trim();
  if (text) return text;
  const start = element.position?.start.offset;
  const end = element.position?.end.offset;
  return start !== undefined && end !== undefined
    ? source.slice(start, end).replace(/<[^>]*>/g, '').trim()
    : '';
}

/**
 * Render a block-level JSX element.
 *
 * @returns The block markup, or undefined when nothing here can render it.
 */
export function renderJsxBlock(element: JsxElement, ctx: ComponentContext): string | undefined {
  const name = element.name ?? '';

  switch (name) {
    case 'Tabs':
      return renderTabs(element, ctx);
    case 'TabItem':
      return renderTabItem(element, ctx);
    case 'Details':
    case 'details':
      return renderDetails(element, ctx);
    case 'CodeBlock':
      return renderCodeBlock(element, ctx);
    case 'Admonition':
      return renderAdmonitionElement(element, ctx);
    default:
      break;
  }

  if (name === '') {
    // A fragment contributes nothing of its own.
    return joinBlocks((element.children ?? []).map(ctx.renderChild));
  }

  if (HTML_ELEMENTS.has(name)) {
    const start = element.position?.start.offset;
    const end = element.position?.end.offset;
    if (start !== undefined && end !== undefined) {
      return serializeBlock('html', undefined, ctx.source.slice(start, end));
    }
  }

  return undefined;
}
