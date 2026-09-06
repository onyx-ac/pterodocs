/**
 * Path helpers shared by the source reader and the targets.
 *
 * Everything here is POSIX-shaped: a documentation tree is addressed by URL
 * paths, not by the host's separators.
 */

import path from 'node:path';
import { ConfigError } from '../errors';

/** Prefix Docusaurus uses for paths relative to the site directory. */
const SITE_ALIAS = '@site/';

/**
 * Resolve a Docusaurus `@site/...` path to an absolute one.
 *
 * @param aliased The path as Docusaurus records it, e.g. `@site/docs/intro.md`.
 * @param siteDir Absolute path of the Docusaurus site directory.
 */
export function resolveAliasedPath(aliased: string, siteDir: string): string {
  if (!aliased.startsWith(SITE_ALIAS)) {
    throw new ConfigError(
      `Expected a "@site/"-relative path from Docusaurus but got "${aliased}". This usually means an unsupported Docusaurus version.`,
    );
  }
  return path.resolve(siteDir, aliased.slice(SITE_ALIAS.length));
}

/** Turn a host path into the POSIX form used for ids and messages. */
export function toPosix(value: string): string {
  return value.split(path.sep).join('/');
}

/** Split a URL-ish path into its non-empty segments. */
export function segments(value: string): string[] {
  return value.split('/').filter(Boolean);
}

/**
 * Split a configured path into slug segments, rejecting anything WordPress
 * would not accept as a page slug.
 *
 * @param value A path such as `/products/docstack`.
 * @param label The setting's name, used in the error message.
 */
export function toSlugSegments(value: string, label: string): string[] {
  const parts = segments(String(value ?? '').trim());
  for (const part of parts) {
    if (!/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(part)) {
      throw new ConfigError(
        `${label} segment "${part}" is not a slug. Use lowercase letters, digits, hyphens and underscores.`,
      );
    }
  }
  return parts;
}

/**
 * Make a slug out of arbitrary text, for path segments we derive ourselves
 * (a version name, for instance) rather than receive from Docusaurus.
 */
export function slugify(value: string): string {
  return String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'untitled';
}

/** Title-case a slug, for a page that has no better label available. */
export function titleCase(slug: string): string {
  return segments(slug.replace(/[-_]/g, ' ').replace(/\s+/g, ' '))
    .join(' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * The path a URL points at below a prefix.
 *
 * Returns undefined when `url` is not under `prefix`, which is how the link
 * resolver decides whether a link belongs to the documentation at all.
 */
export function relativeToPrefix(url: string, prefix: string): string | undefined {
  const normalisedPrefix = `/${segments(prefix).join('/')}`;
  const normalisedUrl = `/${segments(url).join('/')}`;
  if (normalisedPrefix === '/') return segments(normalisedUrl).join('/');
  if (normalisedUrl === normalisedPrefix) return '';
  if (!normalisedUrl.startsWith(`${normalisedPrefix}/`)) return undefined;
  return normalisedUrl.slice(normalisedPrefix.length + 1);
}

/** Join path segments into an absolute URL path with a trailing slash. */
export function joinPath(parts: string[], trailingSlash = true): string {
  const joined = parts.flatMap((part) => segments(part)).join('/');
  if (joined === '') return '/';
  return trailingSlash ? `/${joined}/` : `/${joined}`;
}
