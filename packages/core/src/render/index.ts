/**
 * Rendering a document: parse, resolve, and serialise to blocks.
 *
 * This layer is pure. It never reaches the network, never loads Docusaurus and
 * knows nothing about the target beyond the URLs a resolver hands back.
 */

import matter from 'gray-matter';
import { parseMarkdown, detectFormat, type MarkdownFormat } from './parse';
import { resolveReferences } from './references';
import { lowerMdx, type UnknownPolicy } from './mdx';
import { rewriteLinks, type LinkResolver } from './links';
import { createRenderContext, renderBody, type RenderContext } from './renderers';
import { createSlugger } from './slug';
import { excerptFrom } from './excerpt';
import { DEFAULT_ADMONITION_KEYWORDS } from './admonitions';
import type { Theme } from './theme';
import { IssueCollector } from '../util/issues';

export { createTheme, DEFAULT_STRINGS } from './theme';
export type { Theme, Strings, BlockVocabulary } from './theme';
export { parseMarkdown, detectFormat } from './parse';
export type { MarkdownFormat } from './parse';
export { renderBlock, renderBody, createRenderContext } from './renderers';
export type { RenderContext } from './renderers';
export { excerptFrom } from './excerpt';
export { serializeBlock, serializeVoidBlock, serializeAttrs, escapeCode, escapeText, joinBlocks } from './blocks';
export { renderInline } from './inline';
export { headingIdFor, createSlugger } from './slug';
export { resolveReferences } from './references';
export { rewriteLinks, toInternalPath, isAbsoluteUrl } from './links';
export type { LinkResolver, ResolvedLink } from './links';
export { DEFAULT_ADMONITION_KEYWORDS } from './admonitions';
export { lowerMdx, isTranslatable, KNOWN_COMPONENTS } from './mdx';
export type { UnknownPolicy } from './mdx';
export { renderJsxBlock, attribute } from './components';
export { collectImages, resolveImage } from './images';
export type { ImageReference, ResolvedImage } from './images';
export { composePage, DEFAULT_LAYOUT, renderNavigationStub, renderVersionBanner } from './page';
export type { ComposePageInput, PageLayout, PageLike } from './page';

/** What to render, and how. */
export interface RenderDocInput {
  /** The document body, front matter included or not. */
  markdown: string;
  /** Absolute or site-relative path, used for issue positions and format detection. */
  file?: string;
  /** Permalink of this document, which relative links resolve against. */
  permalink: string;
  /** Which flavour to parse as; detected from `file` when omitted. */
  format?: MarkdownFormat;
  /** Class names and strings. */
  theme: Theme;
  /** Where each link should point. */
  resolveLink?: LinkResolver;
  /** Directive names that mean "admonition" on this site. */
  admonitionKeywords?: Iterable<string>;
  /** Whether Docusaurus keeps heading case when generating anchors. */
  maintainCase?: boolean;
  /** Drop a leading H1 that repeats the page title. */
  dedupeTitle?: boolean;
  /** Uploaded media, keyed by the URL as written in the source. */
  media?: Map<string, { id: number; url: string }>;
  /** What to do about JSX with no translation. */
  onUnknownJsx?: UnknownPolicy;
  /** Collector to record issues into; a fresh one is made when omitted. */
  issues?: IssueCollector;
}

/** A rendered document body and what was learned while rendering it. */
export interface RenderedDoc {
  /** The block markup. */
  body: string;
  /** Tree paths of the pages this document links to. */
  links: Set<string>;
  /** Plain text of the first paragraph, for an excerpt. */
  firstParagraph: string;
  /** Everything worth telling the user about this document. */
  issues: IssueCollector;
}

/**
 * Render one document to Gutenberg block markup.
 */
export function renderDoc(input: RenderDocInput): RenderedDoc {
  const issues = input.issues ?? new IssueCollector();
  const parsed = matter(input.markdown);
  const source = parsed.content.replace(/\r\n/g, '\n').replace(/^\n+/, '');

  const format = input.format ?? (input.file ? detectFormat(input.file) : 'md');
  const root = parseMarkdown(source, format);

  if (format === 'mdx') {
    lowerMdx(root, {
      source,
      file: input.file,
      issues,
      onUnknown: input.onUnknownJsx ?? 'report',
    });
  }

  resolveReferences(root);
  const links = input.resolveLink
    ? rewriteLinks(root, input.permalink, input.resolveLink, issues)
    : new Set<string>();

  const ctx: RenderContext = createRenderContext({
    theme: input.theme,
    slugger: createSlugger(),
    issues,
    maintainCase: input.maintainCase ?? false,
    admonitionKeywords: new Set(input.admonitionKeywords ?? DEFAULT_ADMONITION_KEYWORDS),
    file: input.file,
    source,
    media: input.media,
    onUnknownJsx: input.onUnknownJsx ?? 'report',
  });

  const { body, firstParagraph } = renderBody(root, ctx, {
    dedupeTitle: input.dedupeTitle ?? true,
  });

  return { body, links, firstParagraph, issues };
}

/** Build an excerpt from a description, falling back to the opening paragraph. */
export function excerptFor(description: string, firstParagraph: string, max = 160): string {
  return excerptFrom(description || firstParagraph || '', max);
}
