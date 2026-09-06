/**
 * Where pages live on WordPress.
 *
 * URL policy belongs to the target: the renderer asks for a path and gets one
 * back, without knowing whether the site nests pages, uses a subdirectory
 * install, or publishes versions under their own segment.
 */

import { joinPath, segments, slugify } from '../../util/paths';

/** How a WordPress site's documentation tree is addressed. */
export interface WordpressUrlPolicy {
  /** Segments of the path the tree hangs from, e.g. ['docstack']. */
  rootSegments: string[];
  /** Segments below the root holding the docs, e.g. ['docs']. May be empty. */
  baseSegments: string[];
  /** Name of the version published at the base, which needs no segment of its own. */
  primaryVersion?: string | undefined;
  /** Locale published at the base; other locales get a segment. */
  primaryLocale?: string | undefined;
}

/**
 * Segments that come before a page's own path.
 *
 * A version or a locale only earns a segment when it is not the primary one,
 * so a single-version, single-locale site publishes exactly where it did
 * before any of this existed.
 */
export function prefixSegments(
  policy: WordpressUrlPolicy,
  context: { versionName: string; locale: string },
): string[] {
  const parts = [...policy.rootSegments, ...policy.baseSegments];
  if (policy.primaryLocale !== undefined && context.locale !== policy.primaryLocale) {
    parts.push(slugify(context.locale));
  }
  if (policy.primaryVersion !== undefined && context.versionName !== policy.primaryVersion) {
    parts.push(slugify(context.versionName));
  }
  return parts;
}

/** The absolute site path of a page. */
export function hrefFor(
  policy: WordpressUrlPolicy,
  treePath: string,
  context: { versionName: string; locale: string },
): string {
  return joinPath([...prefixSegments(policy, context), ...segments(treePath)]);
}

/**
 * The path pages hang from, and the slug of the page that owns the tree.
 *
 * Everything above the owned page is created once if missing and never edited;
 * the owned page is the documentation root itself.
 */
export function splitOwnership(policy: WordpressUrlPolicy): {
  stubSegments: string[];
  rootSlug: string;
} {
  const all = [...policy.rootSegments, ...policy.baseSegments];
  const rootSlug = all[all.length - 1];
  if (rootSlug === undefined) {
    throw new Error('There is nowhere to publish: the root path and the base are both empty.');
  }
  return { stubSegments: all.slice(0, -1), rootSlug };
}
