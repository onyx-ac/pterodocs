/**
 * Finding and resolving the files a document references.
 *
 * Images are found wherever they sit — in a paragraph, behind a reference,
 * inside raw HTML — because the one place they never sit is at the top level
 * of a document, which is where an earlier version of this code looked.
 */

import fs from 'node:fs';
import path from 'node:path';
import { visit } from 'unist-util-visit';
import type { Image, Root } from 'mdast';
import { parseMarkdown, type MarkdownFormat } from './parse';
import { resolveReferences } from './references';
import { isAbsoluteUrl } from './links';

/** An image a document points at. */
export interface ImageReference {
  /** The URL exactly as written in the source. */
  url: string;
  /** Alternative text. */
  alt: string;
  /** Title, which becomes a caption. */
  title?: string | undefined;
}

/** Where an image URL actually points. */
export type ResolvedImage =
  | { kind: 'external'; url: string }
  | { kind: 'file'; url: string; file: string }
  | { kind: 'missing'; url: string };

/** Where to look when resolving a relative or absolute reference. */
export interface ImageResolutionContext {
  /** Absolute path of the document's own source file. */
  sourceAbsolutePath: string;
  /** The version's content directory. */
  contentPath: string;
  /** The localised content directory, preferred when the file exists in both. */
  contentPathLocalized: string;
  /** Absolute paths of the site's static directories. */
  staticDirs: string[];
  /** The site's base URL, stripped from absolute references when present. */
  baseUrl: string;
  /** The Docusaurus site directory, for `@site/` references. */
  siteDir: string;
  /** Injected so resolution can be tested without a filesystem. */
  exists?: (file: string) => boolean;
}

/** Every image a document references, including ones behind a reference definition. */
export function collectImages(markdown: string, format: MarkdownFormat = 'md'): ImageReference[] {
  const root: Root = parseMarkdown(markdown, format);
  // Reference-style images become ordinary ones first, so they are not missed.
  resolveReferences(root);

  const found: ImageReference[] = [];
  const seen = new Set<string>();
  visit(root, 'image', (node: Image) => {
    if (seen.has(node.url)) return;
    seen.add(node.url);
    found.push({
      url: node.url,
      alt: node.alt ?? '',
      ...(node.title != null ? { title: node.title } : {}),
    });
  });
  return found;
}

/**
 * Work out which file an image URL points at.
 *
 * The order matches how Docusaurus itself resolves them: an absolute URL is
 * left alone, `@site/` is site-relative, a leading slash is served from a
 * static directory, and anything else is relative to the document — preferring
 * the localised copy when there is one.
 */
export function resolveImage(url: string, ctx: ImageResolutionContext): ResolvedImage {
  const exists = ctx.exists ?? ((file: string) => fs.existsSync(file));

  if (!url || url.startsWith('data:') || isAbsoluteUrl(url)) return { kind: 'external', url };

  if (url.startsWith('@site/')) {
    const file = path.resolve(ctx.siteDir, url.slice('@site/'.length));
    return exists(file) ? { kind: 'file', url, file } : { kind: 'missing', url };
  }

  if (url.startsWith('/')) {
    const base = ctx.baseUrl.replace(/\/+$/, '');
    const withoutBase = base && url.startsWith(`${base}/`) ? url.slice(base.length) : url;
    for (const dir of ctx.staticDirs) {
      for (const candidate of [path.join(dir, url), path.join(dir, withoutBase)]) {
        if (exists(candidate)) return { kind: 'file', url, file: candidate };
      }
    }
    return { kind: 'missing', url };
  }

  const sourceDir = path.dirname(ctx.sourceAbsolutePath);
  const direct = path.resolve(sourceDir, url);
  if (exists(direct)) return { kind: 'file', url, file: direct };

  // The document may be the unlocalised original while its assets sit beside
  // the translated copy, or the other way round.
  if (ctx.contentPath && ctx.contentPathLocalized && ctx.contentPath !== ctx.contentPathLocalized) {
    const relative = path.relative(ctx.contentPath, direct);
    const twin = path.resolve(ctx.contentPathLocalized, relative);
    if (!relative.startsWith('..') && exists(twin)) return { kind: 'file', url, file: twin };
  }

  return { kind: 'missing', url };
}
