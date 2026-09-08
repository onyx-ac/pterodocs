/**
 * Markdown block nodes to Gutenberg blocks.
 *
 * One function per node type, dispatched from `renderBlock`. Everything that
 * cannot be represented is reported as an issue; nothing is dropped quietly.
 */

import type {
  Blockquote,
  Code,
  Heading,
  Image,
  List,
  ListItem,
  Paragraph,
  PhrasingContent,
  Root,
  RootContent,
  Table,
} from 'mdast';
import type { ContainerDirective } from 'mdast-util-directive';
import { toHast } from 'mdast-util-to-hast';
import { escapeText, joinBlocks, serializeBlock } from './blocks';
import { escapeShortcodesInHast, hastToHtml, renderInline } from './inline';
import { headingIdFor, type Slugger } from './slug';
import { renderCode } from './code';
import { renderAdmonition, DEFAULT_ADMONITION_KEYWORDS } from './admonitions';
import { renderJsxBlock, type JsxElement } from './components';
import type { Theme } from './theme';
import type { IssueCollector } from '../util/issues';

/** Everything a block renderer needs that is not the node itself. */
export interface RenderContext {
  /** Class names and strings. */
  theme: Theme;
  /** The document's heading slugger. */
  slugger: Slugger;
  /** Whether Docusaurus keeps heading case when generating anchors. */
  maintainCase: boolean;
  /** Directive names that mean "admonition" on this site. */
  admonitionKeywords: Set<string>;
  /** Where problems are recorded. */
  issues: IssueCollector;
  /** Source file, for issue positions. */
  file?: string | undefined;
  /** The markdown the tree was parsed from, for reproducing unhandled nodes. */
  source: string;
  /** Media already uploaded, keyed by the URL as written in the source. */
  media?: Map<string, { id: number; url: string }> | undefined;
  /** What to do about JSX with no translation. */
  onUnknownJsx?: 'report' | 'placeholder' | 'error';
}

/** A context with the defaults a caller usually wants. */
export function createRenderContext(
  init: Partial<RenderContext> & Pick<RenderContext, 'theme' | 'slugger' | 'issues'>,
): RenderContext {
  return {
    maintainCase: false,
    admonitionKeywords: new Set(DEFAULT_ADMONITION_KEYWORDS),
    source: '',
    ...init,
  };
}

/** True when a list only holds shapes core's list block can carry. */
function listIsSimple(list: List): boolean {
  return list.children.every(
    (item) =>
      item.type === 'listItem' &&
      item.children.every(
        (child, index) => (child.type === 'paragraph' && index === 0) || child.type === 'list',
      ),
  );
}

function renderListItem(item: ListItem, ctx: RenderContext): string {
  const parts: string[] = [];
  for (const child of item.children) {
    if (child.type === 'paragraph') parts.push(renderInline(child.children));
    else if (child.type === 'list') parts.push(renderList(child, ctx));
  }
  const marker = item.checked === true ? '☑ ' : item.checked === false ? '☐ ' : '';
  return serializeBlock('list-item', undefined, `<li>${marker}${parts.join('')}</li>`);
}

function renderList(node: List, ctx: RenderContext): string {
  const tag = node.ordered ? 'ol' : 'ul';
  const attributes: Record<string, unknown> = {};
  if (node.ordered) attributes['ordered'] = true;
  const start = node.ordered && typeof node.start === 'number' && node.start !== 1 ? node.start : null;
  if (start !== null) attributes['start'] = start;

  const items = node.children.map((item) => renderListItem(item as ListItem, ctx)).join('\n\n');
  const open = `<${tag}${start !== null ? ` start="${start}"` : ''} class="wp-block-list">`;
  return serializeBlock('list', attributes, `${open}${items}</${tag}>`);
}

function renderTable(node: Table): string {
  const align = node.align ?? [];
  const cell = (content: { children?: PhrasingContent[] }, index: number, header: boolean): string => {
    const tag = header ? 'th' : 'td';
    const alignment = align[index];
    const attrs = alignment ? ` class="has-text-align-${alignment}" data-align="${alignment}"` : '';
    return `<${tag}${attrs}>${renderInline(content.children ?? [])}</${tag}>`;
  };

  const [head, ...body] = node.children;
  const thead = head
    ? `<thead><tr>${head.children.map((c, i) => cell(c, i, true)).join('')}</tr></thead>`
    : '';
  const tbody = body.length
    ? `<tbody>${body
        .map((row) => `<tr>${row.children.map((c, i) => cell(c, i, false)).join('')}</tr>`)
        .join('')}</tbody>`
    : '';

  return serializeBlock(
    'table',
    { hasFixedLayout: false },
    `<figure class="wp-block-table"><table>${thead}${tbody}</table></figure>`,
  );
}

/** A paragraph holding nothing but one image becomes an image block. */
function loneImage(node: Paragraph): Image | undefined {
  const meaningful = node.children.filter(
    (child) => !(child.type === 'text' && child.value.trim() === ''),
  );
  return meaningful.length === 1 && meaningful[0]!.type === 'image'
    ? (meaningful[0] as Image)
    : undefined;
}

function renderImageBlock(node: Image, ctx: RenderContext): string {
  const uploaded = ctx.media?.get(node.url);
  const src = uploaded?.url ?? node.url;
  const attributes: Record<string, unknown> = { sizeSlug: 'large', linkDestination: 'none' };
  if (uploaded) attributes['id'] = uploaded.id;

  const classes = `wp-block-image size-large`;
  const imgClass = uploaded ? ` class="wp-image-${uploaded.id}"` : '';
  const caption = node.title
    ? `<figcaption class="wp-element-caption">${escapeText(node.title)}</figcaption>`
    : '';

  return serializeBlock(
    'image',
    attributes,
    `<figure class="${classes}"><img src="${escapeText(src)}" alt="${escapeText(node.alt ?? '')}"${imgClass}/>${caption}</figure>`,
  );
}

/**
 * Render one top-level markdown node.
 *
 * @param node The node.
 * @param ctx Theme, slugger and issue collector.
 */
export function renderBlock(node: RootContent, ctx: RenderContext): string {
  switch (node.type) {
    case 'paragraph': {
      const image = loneImage(node as Paragraph);
      if (image) return renderImageBlock(image, ctx);
      const html = renderInline((node as Paragraph).children);
      if (html.trim() === '') return '';
      return serializeBlock('paragraph', undefined, `<p>${html}</p>`);
    }

    case 'heading': {
      const heading = node as Heading;
      const { id, children } = headingIdFor(heading, ctx.slugger, ctx.maintainCase);
      const level = heading.depth;
      const attributes = level === 2 ? undefined : { level };
      return serializeBlock(
        'heading',
        attributes,
        `<h${level} class="wp-block-heading" id="${id}">${renderInline(children)}</h${level}>`,
      );
    }

    case 'list': {
      const list = node as List;
      if (listIsSimple(list)) return renderList(list, ctx);
      ctx.issues.add({
        code: 'list-not-representable',
        severity: 'info',
        message: 'A list item holds blocks the WordPress list block cannot carry; kept as HTML.',
        file: ctx.file,
        line: node.position?.start.line,
      });
      const hast = toHast(list, { allowDangerousHtml: true });
      const escaped = hast ? escapeShortcodesInHast([hast as never]) : [];
      return serializeBlock('html', undefined, hastToHtml(escaped));
    }

    case 'code':
      return renderCode(node as Code, ctx.theme, ctx.issues, ctx.file);

    case 'blockquote': {
      const inner = joinBlocks(
        (node as Blockquote).children.map((child) => renderBlock(child, ctx)),
      );
      return serializeBlock('quote', undefined, `<blockquote class="wp-block-quote">${inner}</blockquote>`);
    }

    case 'table':
      return renderTable(node as Table);

    case 'thematicBreak':
      return serializeBlock(
        'separator',
        undefined,
        '<hr class="wp-block-separator has-alpha-channel-opacity"/>',
      );

    case 'containerDirective': {
      const directive = node as ContainerDirective;
      const name = String(directive.name ?? '').toLowerCase();
      if (ctx.admonitionKeywords.has(name)) {
        return renderAdmonition(directive, ctx.theme, (child) => renderBlock(child, ctx));
      }
      ctx.issues.add({
        code: 'directive-unknown',
        severity: 'warning',
        message: `":::${directive.name}" is not an admonition on this site; its content was kept without the wrapper.`,
        file: ctx.file,
        line: node.position?.start.line,
      });
      return joinBlocks((directive.children as RootContent[]).map((child) => renderBlock(child, ctx)));
    }

    case 'mdxJsxFlowElement': {
      const element = node as unknown as JsxElement;
      const rendered = renderJsxBlock(element, {
        theme: ctx.theme,
        issues: ctx.issues,
        source: ctx.source,
        file: ctx.file,
        renderChild: (child) => renderBlock(child, ctx),
      });
      if (rendered !== undefined) return rendered;
      ctx.issues.add({
        code: 'mdx-unknown-component',
        severity: ctx.onUnknownJsx === 'error' ? 'error' : 'warning',
        message: `<${element.name ?? 'fragment'}> is a React component, which a page cannot run, so it was left out.`,
        file: ctx.file,
        line: node.position?.start.line,
        column: node.position?.start.column,
      });
      return ctx.onUnknownJsx === 'placeholder'
        ? serializeBlock('html', undefined, `<!-- pterodoc: <${element.name ?? 'fragment'}> omitted -->`)
        : '';
    }

    case 'html': {
      const value = (node as { value: string }).value;
      // Comments carry no content; Docusaurus hides them too.
      if (/^\s*<!--[\s\S]*-->\s*$/.test(value)) return '';
      return serializeBlock('html', undefined, value);
    }

    case 'image':
      return renderImageBlock(node as Image, ctx);

    case 'definition':
    case 'yaml':
    case 'footnoteDefinition':
      return '';

    default: {
      const position = node.position;
      if (position && ctx.source) {
        const raw = ctx.source.slice(position.start.offset ?? 0, position.end.offset ?? 0);
        ctx.issues.add({
          code: 'node-unhandled',
          severity: 'warning',
          message: `A "${node.type}" node has no WordPress equivalent; its source was kept verbatim.`,
          file: ctx.file,
          line: position.start.line,
        });
        return serializeBlock('paragraph', undefined, `<p>${escapeText(raw)}</p>`);
      }
      ctx.issues.add({
        code: 'node-unhandled',
        severity: 'warning',
        message: `A "${node.type}" node has no WordPress equivalent and was skipped.`,
        file: ctx.file,
      });
      return '';
    }
  }
}

/**
 * Render a document body.
 *
 * @param root The parsed document.
 * @param ctx Theme, slugger and issue collector.
 * @param options `dedupeTitle` drops a leading H1 that repeats the page title.
 */
export function renderBody(
  root: Root,
  ctx: RenderContext,
  options: { dedupeTitle?: boolean } = {},
): { body: string; firstParagraph: string } {
  const children = [...root.children];

  if (options.dedupeTitle !== false) {
    // The theme prints the page title, so a body that opens with the same
    // heading would show it twice. Skipping anything that renders to nothing
    // first means a comment or a stripped import cannot hide the heading.
    const firstVisible = children.findIndex(
      (child) =>
        !(child.type === 'html' && /^\s*<!--[\s\S]*-->\s*$/.test(child.value)) &&
        child.type !== 'yaml' &&
        child.type !== 'definition',
    );
    const candidate = firstVisible === -1 ? undefined : children[firstVisible];
    if (candidate && candidate.type === 'heading' && candidate.depth === 1) {
      children.splice(firstVisible, 1);
    }
  }

  const firstParagraph = children.find((child) => child.type === 'paragraph');
  const body = joinBlocks(children.map((child) => renderBlock(child, ctx)));
  return {
    body,
    firstParagraph: firstParagraph ? plainText(firstParagraph as Paragraph) : '',
  };
}

/** Plain text of a node, for excerpts. */
function plainText(node: Paragraph): string {
  const parts: string[] = [];
  const walk = (child: { type: string; value?: string; children?: unknown[] }): void => {
    if (typeof child.value === 'string' && (child.type === 'text' || child.type === 'inlineCode')) {
      parts.push(child.value);
    }
    if (Array.isArray(child.children)) {
      for (const grandChild of child.children) walk(grandChild as never);
    }
  };
  walk(node as never);
  return parts.join('');
}
