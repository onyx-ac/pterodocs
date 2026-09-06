/**
 * Link rewriting.
 *
 * A documentation link can be relative to the source file, absolute against
 * the site's base URL, or an anchor. Whichever it is, it has to end up
 * pointing at the right page on the target — or, when the target has no such
 * page, somewhere honest.
 */

import path from 'node:path';
import { visit } from 'unist-util-visit';
import type { Link, Root } from 'mdast';
import type { IssueCollector } from '../util/issues';

/** What a link should become. */
export interface ResolvedLink {
  /** The replacement URL, or null to keep the text and drop the link. */
  href: string | null;
  /** Target page's tree path, when the link points at a published page. */
  path?: string | undefined;
}

/** Decides where a link should point. */
export type LinkResolver = (href: string, fromPermalink: string) => ResolvedLink;

/** True for a URL that already names its own scheme or host. */
export function isAbsoluteUrl(href: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href) || href.startsWith('//');
}

/**
 * Resolve a documentation link to the URL path it refers to.
 *
 * Relative targets are resolved against the linking document's own permalink,
 * which is what makes this work regardless of where the docs are mounted.
 *
 * @param href The link as written.
 * @param fromPermalink Permalink of the document containing the link.
 * @returns The URL path and fragment, or undefined when the link is not internal.
 */
export function toInternalPath(
  href: string,
  fromPermalink: string,
): { urlPath: string; hash: string } | undefined {
  if (!href || href.startsWith('#') || isAbsoluteUrl(href)) return undefined;

  const hashIndex = href.indexOf('#');
  const hash = hashIndex === -1 ? '' : href.slice(hashIndex);
  const target = hashIndex === -1 ? href : href.slice(0, hashIndex);

  const withoutExtension = target.replace(/\.mdx?$/, '');
  const base = fromPermalink.endsWith('/') ? fromPermalink : `${fromPermalink}/`;

  const urlPath = withoutExtension.startsWith('/')
    ? path.posix.normalize(withoutExtension)
    : path.posix.normalize(path.posix.join(base, '..', withoutExtension));

  return { urlPath, hash };
}

/**
 * Rewrite every link in a document.
 *
 * @param root The document, modified in place.
 * @param fromPermalink Permalink of the document.
 * @param resolve Where each link should point.
 * @returns Tree paths of the pages this document links to.
 */
export function rewriteLinks(
  root: Root,
  fromPermalink: string,
  resolve: LinkResolver,
  _issues?: IssueCollector,
): Set<string> {
  const linked = new Set<string>();

  visit(root, 'link', (node: Link, index, parent) => {
    const resolved = resolve(node.url, fromPermalink);
    if (resolved.path !== undefined) linked.add(resolved.path);

    if (resolved.href === null) {
      // The target is not published, so keep the words and drop the link.
      if (parent && index !== undefined) {
        parent.children.splice(index, 1, ...(node.children as never[]));
        return index;
      }
      return;
    }
    node.url = resolved.href;
    return;
  });

  return linked;
}
