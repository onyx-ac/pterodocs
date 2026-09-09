/**
 * Normalising Docusaurus's loaded state into the site model.
 *
 * The mapping is deliberately thin: almost every field is copied, because the
 * point of loading Docusaurus is to inherit its answers rather than to
 * second-guess them.
 */

import path from 'node:path';
import { detectFormat, type MarkdownFormat } from '@pterodocs/core/render';
import { relativeToPrefix, resolveAliasedPath, toPosix } from '@pterodocs/core/util';
import { DEFAULT_ADMONITION_KEYWORDS } from '@pterodocs/core/render';
import { loadDocusaurusServer, type LoadedSite } from './server';
import type { Doc, DocsInstance, DocsVersion, SidebarItem, SiteModel } from '@pterodocs/core/model';

/** Name Docusaurus gives the docs plugin. */
const DOCS_PLUGIN = 'docusaurus-plugin-content-docs';

/** What to load, and which parts of it to keep. */
export interface LoadModelOptions {
  /** Absolute path of the Docusaurus site directory. */
  siteDir: string;
  /** Locale to load; one call loads exactly one locale. */
  locale?: string | undefined;
  /** Explicit `docusaurus.config.*` path. */
  configPath?: string | undefined;
  /** Docs plugin instance ids to keep, or 'all'. */
  instances?: string[] | 'all' | undefined;
  /** Versions to keep: 'last', 'all', or explicit names. */
  versions?: string[] | 'all' | 'last' | undefined;
  /** Publish draft documents. Docusaurus normally drops them from a build. */
  includeDrafts?: boolean | undefined;
  /** Called with warnings raised while loading. */
  warn?: ((message: string) => void) | undefined;
}

/** Read a nested property without pretending to know the whole shape. */
function get<T>(source: unknown, keys: string[], fallback: T): T {
  let current: unknown = source;
  for (const key of keys) {
    if (current === null || typeof current !== 'object') return fallback;
    current = (current as Record<string, unknown>)[key];
  }
  return (current ?? fallback) as T;
}

/** Docusaurus's admonition option is `true`, or an object that may extend the defaults. */
function admonitionKeywords(options: Record<string, unknown>): string[] {
  const admonitions = options['admonitions'];
  if (admonitions === false) return [];
  if (admonitions === true || admonitions === undefined) return [...DEFAULT_ADMONITION_KEYWORDS];

  const keywords = get<string[] | undefined>(admonitions, ['keywords'], undefined);
  const extendDefaults = get<boolean>(admonitions, ['extendDefaults'], true);
  if (!keywords) return [...DEFAULT_ADMONITION_KEYWORDS];
  return extendDefaults ? [...new Set([...DEFAULT_ADMONITION_KEYWORDS, ...keywords])] : [...keywords];
}

/** Turn one of Docusaurus's loaded documents into ours. */
function toDoc(
  raw: Record<string, unknown>,
  version: { name: string; pathPrefix: string },
  siteDir: string,
  siteFormat: 'md' | 'mdx' | 'detect',
): Doc {
  const sourceAliased = String(raw['source'] ?? '');
  const sourceAbsolutePath = resolveAliasedPath(sourceAliased, siteDir);
  const permalink = String(raw['permalink'] ?? '');
  const frontMatter = (raw['frontMatter'] ?? {}) as Record<string, unknown>;

  const declaredFormat = frontMatter['format'];
  const format: MarkdownFormat =
    declaredFormat === 'md' || declaredFormat === 'mdx'
      ? declaredFormat
      : siteFormat === 'detect'
        ? detectFormat(sourceAbsolutePath)
        : siteFormat;

  return {
    id: String(raw['id'] ?? ''),
    versionName: version.name,
    title: String(raw['title'] ?? ''),
    description: String(raw['description'] ?? ''),
    sourceAliased,
    sourceAbsolutePath,
    sourceRelativePath: toPosix(path.relative(siteDir, sourceAbsolutePath)),
    sourceDirName: String(raw['sourceDirName'] ?? '.'),
    slug: String(raw['slug'] ?? ''),
    permalink,
    // The position in the published tree is the permalink with the version's
    // own prefix removed, so front-matter slugs are honoured for free.
    treePath: relativeToPrefix(permalink, version.pathPrefix) ?? '',
    draft: raw['draft'] === true,
    unlisted: raw['unlisted'] === true,
    frontMatter,
    sidebarName: (raw['sidebar'] as string | undefined) ?? undefined,
    sidebarPosition: (raw['sidebarPosition'] as number | undefined) ?? undefined,
    previous: (raw['previous'] as Doc['previous']) ?? undefined,
    next: (raw['next'] as Doc['next']) ?? undefined,
    tags: (raw['tags'] as Doc['tags']) ?? [],
    format,
  };
}

/** Turn one of Docusaurus's loaded versions into ours. */
function toVersion(
  raw: Record<string, unknown>,
  siteDir: string,
  siteFormat: 'md' | 'mdx' | 'detect',
  includeDrafts: boolean,
): DocsVersion {
  const name = String(raw['versionName'] ?? 'current');
  const pathPrefix = String(raw['path'] ?? '');
  const contentPath = String(raw['contentPath'] ?? '');

  const published = (raw['docs'] as Record<string, unknown>[] | undefined) ?? [];
  const drafts = (raw['drafts'] as Record<string, unknown>[] | undefined) ?? [];
  const source = includeDrafts ? [...published, ...drafts] : published;

  return {
    name,
    label: String(raw['label'] ?? name),
    isLast: raw['isLast'] === true,
    pathPrefix,
    contentPath,
    contentPathLocalized: String(raw['contentPathLocalized'] ?? contentPath),
    banner: (raw['banner'] as DocsVersion['banner']) ?? null,
    noIndex: raw['noIndex'] === true,
    sidebars: (raw['sidebars'] as Record<string, SidebarItem[]> | undefined) ?? {},
    docs: source.map((doc) => toDoc(doc, { name, pathPrefix }, siteDir, siteFormat)),
    draftCount: drafts.length,
  };
}

/** Keep only the versions the caller asked for. */
function selectVersions(versions: DocsVersion[], selector: LoadModelOptions['versions']): DocsVersion[] {
  if (selector === 'all') return versions;
  if (Array.isArray(selector)) return versions.filter((version) => selector.includes(version.name));
  const last = versions.find((version) => version.isLast);
  return last ? [last] : versions.slice(0, 1);
}

/**
 * Normalise a loaded Docusaurus site into the model.
 *
 * Exposed separately from {@link loadModel} so the plugin, which already has
 * the loaded state, can reuse it without loading the site again.
 */
export function toSiteModel(site: LoadedSite, options: LoadModelOptions): SiteModel {
  const { props } = site;
  const siteDir = props.siteDir;
  const siteConfig = props.siteConfig;
  const siteFormat = get<'md' | 'mdx' | 'detect'>(siteConfig, ['markdown', 'format'], 'mdx');
  const staticDirectories = get<string[]>(siteConfig, ['staticDirectories'], ['static']);

  const instances: DocsInstance[] = props.plugins
    .filter((plugin) => plugin.name === DOCS_PLUGIN)
    .map((plugin) => {
      const loadedVersions =
        get<Record<string, unknown>[]>(plugin.content, ['loadedVersions'], []) ?? [];
      const versions = loadedVersions.map((version) =>
        toVersion(version, siteDir, siteFormat, options.includeDrafts === true),
      );
      return {
        id: String(plugin.options['id'] ?? 'default'),
        routeBasePath: String(plugin.options['routeBasePath'] ?? 'docs'),
        contentDirName: String(plugin.options['path'] ?? 'docs'),
        admonitionKeywords: admonitionKeywords(plugin.options),
        breadcrumbs: plugin.options['breadcrumbs'] !== false,
        versions: selectVersions(versions, options.versions),
      };
    })
    .filter(
      (instance) =>
        options.instances === undefined ||
        options.instances === 'all' ||
        options.instances.includes(instance.id),
    );

  return {
    siteDir,
    url: String(siteConfig['url'] ?? ''),
    baseUrl: props.baseUrl,
    trailingSlash: siteConfig['trailingSlash'] as boolean | undefined,
    locale: props.i18n.currentLocale,
    defaultLocale: props.i18n.defaultLocale,
    locales: props.i18n.locales,
    markdownFormat: siteFormat,
    maintainCase: get<boolean>(siteConfig, ['markdown', 'anchors', 'maintainCase'], false),
    siteTitle: String(siteConfig['title'] ?? ''),
    staticDirs: staticDirectories.map((dir) => path.resolve(siteDir, dir)),
    docusaurusVersion: props.siteMetadata.docusaurusVersion,
    instances,
  };
}

/**
 * Load a Docusaurus site and normalise it.
 *
 * One call loads one locale, because that is what Docusaurus's own loader
 * does; publishing several locales means calling this once for each.
 */
export async function loadModel(options: LoadModelOptions): Promise<SiteModel> {
  const warn = options.warn ?? (() => {});
  const server = loadDocusaurusServer(options.siteDir, warn);

  // Docusaurus's own CLI always runs from the site directory, and plugins rely
  // on it: a typedoc entry point of `../client/src/index.ts`, for instance, is
  // resolved against the working directory rather than the site. Loading from
  // anywhere else makes those plugins look in the wrong place.
  const previousCwd = process.cwd();
  process.chdir(options.siteDir);

  // Docusaurus only drops drafts and applies production behaviour when
  // NODE_ENV says so, and publishing is a production act. Without this a draft
  // reaches the site, which is precisely what marking it a draft asked to
  // avoid.
  const previousNodeEnv = process.env['NODE_ENV'];
  process.env['NODE_ENV'] = 'production';

  try {
    const site = await server.loadSite({
      siteDir: options.siteDir,
      locale: options.locale,
      config: options.configPath,
    });
    return toSiteModel(site, options);
  } finally {
    process.chdir(previousCwd);
    if (previousNodeEnv === undefined) delete process.env['NODE_ENV'];
    else process.env['NODE_ENV'] = previousNodeEnv;
  }
}
