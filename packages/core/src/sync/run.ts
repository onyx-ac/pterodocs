/**
 * The reconciler.
 *
 * Two phases, because WordPress's navigation block needs a page id before any
 * body can reference it: first make sure every page exists, then render every
 * body against the real ids and write only what differs.
 */

import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { VERSION } from '../version';
import { IssueCollector, type Issue } from '../util/issues';
import { contentHash } from '../util/hash';
import { mimeTypeFor } from '../util/mime';
import { titleCase } from '../util/paths';
import { buildPageTree, type PageNode, type PageTree } from '../model/tree';
import type { Doc, DocsVersion, SiteModel } from '../model/types';
import type { SourceReader } from '../model/reader';
import { renderDoc, excerptFor } from '../render/index';
import { composePage, isGeneratedPage, renderVersionBanner, type PageLayout } from '../render/page';
import { createTheme, type Theme } from '../render/theme';
import { stylesheetFor } from '../render/stylesheet';
import { collectImages, resolveImage } from '../render/images';
import type { LinkResolver } from '../render/links';
import type { MediaRef, RenderedPage, Target, TargetSession } from '../target/target';
import type { ResolvedConfig } from '../config/load';
import { summarise, type Action, type Plan } from './plan';
import { writeArtifacts, type Artifacts, type ManifestEntry } from './artifacts';

/** What a run needs beyond its configuration. */
export interface RunSyncDeps {
  /** Where the site model comes from. */
  reader: SourceReader;
  /**
   * Where pages are published.
   *
   * Always supplied, even for a run that publishes nothing: the target owns
   * URL policy, so rendering needs it to know what a page's address will be.
   */
  target?: Target | undefined;
  /** Render only: build no session and contact nothing. */
  renderOnly?: boolean | undefined;
  /** Progress worth seeing under `--verbose`. */
  log?: (message: string) => void;
}

/** What a run produced. */
export interface RunResult {
  plan: Plan;
  artifacts: Artifacts;
}

/** One page, ready to be compared and written. */
interface PreparedPage {
  node: PageNode;
  page: RenderedPage;
  locale: string;
  versionName: string;
}

/** Run the sync. */
export async function runSync(config: ResolvedConfig, deps: RunSyncDeps): Promise<RunResult> {
  const log = deps.log ?? ((): void => {});
  const issues = new IssueCollector();
  const actions: Action[] = [];
  const prepared: PreparedPage[] = [];
  const mediaRecords: Artifacts['media'] = [];
  let requests = 0;
  let mediaPending = 0;
  let docusaurusVersion: string | null = null;

  const locales = await selectLocales(config, deps.reader);

  for (const locale of locales) {
    const model = await deps.reader.read(locale);
    docusaurusVersion ??= model.docusaurusVersion;

    const theme = createTheme({
      classPrefix: config.classPrefix,
      blocks: config.blocks,
      styles: config.styles,
      highlight: config.highlight,
      strings: { ...config.strings, ...config.localeStrings[model.locale] },
    });

    const session =
      deps.target && !deps.renderOnly && !config.offline
        ? await deps.target.open({ locale: model.locale, dryRun: config.dryRun })
        : undefined;

    for (const instance of model.instances) {
      for (const version of instance.versions) {
        const result = await syncVersion({
          config,
          model,
          instance: { admonitionKeywords: instance.admonitionKeywords },
          version,
          theme,
          target: deps.target,
          session,
          issues,
          log,
        });
        actions.push(...result.actions);
        prepared.push(...result.prepared);
        mediaRecords.push(...result.media);
        mediaPending += result.mediaPending;
      }
    }

    if (session) requests += session.requestCount();
  }

  const rootPath = deps.target?.rootPath ?? '/';
  const plan: Plan = {
    generatedAt: new Date().toISOString(),
    versions: { pterodoc: VERSION, docusaurus: docusaurusVersion, node: process.version },
    dryRun: config.dryRun,
    offline: config.offline,
    site: config.targetUrl || null,
    rootPath,
    locales,
    versionNames: [...new Set(prepared.map((entry) => entry.versionName))],
    actions,
    issues: issues.issues,
    summary: summarise(actions),
    requests,
    mediaPending,
    artifactError: null,
  };

  const artifacts: Artifacts = {
    stylesheet: stylesheetFor(
      createTheme({ classPrefix: config.classPrefix, styles: config.styles, highlight: config.highlight }),
      { navWidth: config.layout.navWidth },
    ),
    pages: prepared.map(({ page, locale, versionName }) => ({ page, locale, versionName })),
    manifest: prepared.map(({ node, page, locale, versionName }) => ({
      path: page.path,
      title: page.title,
      slug: page.slug,
      parent: node.parent ? node.parent.path : null,
      menuOrder: page.menuOrder,
      locale,
      versionName,
      file: page.file ?? null,
      href: deps.target ? deps.target.hrefFor(page.path, { versionName, locale }) : page.path,
    })) satisfies ManifestEntry[],
    media: mediaRecords,
    plan,
  };

  try {
    await writeArtifacts(config.outDir, artifacts, { writePages: config.writePages });
  } catch (error) {
    plan.artifactError = error instanceof Error ? error.message : String(error);
  }

  return { plan, artifacts };
}

/** Which locales to publish. */
async function selectLocales(config: ResolvedConfig, reader: SourceReader): Promise<string[]> {
  if (Array.isArray(config.locales)) return config.locales;
  if (config.locales === 'all') return reader.locales();
  const model = await reader.read();
  return [model.defaultLocale ?? model.locale];
}

/** Everything one version's sync needs. */
interface SyncVersionInput {
  config: ResolvedConfig;
  model: SiteModel;
  instance: { admonitionKeywords: string[] };
  version: DocsVersion;
  theme: Theme;
  target: Target | undefined;
  session: TargetSession | undefined;
  issues: IssueCollector;
  log: (message: string) => void;
}

/** Publish one version of one docs instance. */
async function syncVersion(input: SyncVersionInput): Promise<{
  actions: Action[];
  prepared: PreparedPage[];
  media: Artifacts['media'];
  mediaPending: number;
}> {
  const { config, model, version, theme, target, session, issues, log } = input;
  const actions: Action[] = [];
  const locale = model.locale;

  const tree = buildPageTree({
    version,
    sidebars: config.sidebars,
    rootTitle: config.docsTitle,
    includeUnlisted: config.includeUnlisted,
    includeOrphans: config.includeOrphans,
    issues,
  });

  const context = { versionName: version.name, locale };
  const href = (treePath: string): string =>
    target ? target.hrefFor(treePath, context) : `/${treePath}`;

  // Phase 0 and 1: make sure the pages exist, so their ids are known.
  const ids = new Map<string, number | null>();
  const created = new Set<string>();
  let rootParentId: number | null = null;

  if (session) {
    await session.loadIndex();
    const root = await session.ensureRootParent();
    rootParentId = root.id;
    for (const entry of root.created) {
      actions.push({ op: 'create-root', path: entry.path, id: entry.id, locale });
    }
  }

  const inScope = (treePath: string): boolean =>
    !config.only || treePath === config.only || treePath.startsWith(`${config.only}/`);
  const isNeeded = (treePath: string): boolean =>
    inScope(treePath) || treePath === '' || config.only.startsWith(`${treePath}/`);

  const nodes = [tree.root, ...tree.chain];
  for (const node of nodes) {
    if (!isNeeded(node.path)) continue;
    const parentId = node.parent ? (ids.get(node.parent.path) ?? null) : rootParentId;

    if (!session) {
      ids.set(node.path, null);
      continue;
    }

    const result = await session.ensurePage({
      path: node.path,
      slug: node.slug,
      parentId,
      title: node.title,
      menuOrder: node.menuOrder,
      isRoot: node.path === '',
    });
    for (const warning of result.warnings) {
      issues.add({ code: 'target-warning', severity: 'warning', message: warning, path: node.path });
    }
    ids.set(node.path, result.id);
    if (result.created) {
      created.add(node.path);
      actions.push({
        op: 'create',
        path: node.path,
        id: result.id,
        locale,
        versionName: version.name,
        file: node.doc?.sourceRelativePath ?? null,
      });
      if (result.id !== null) log(`created ${node.path || '(root)'} (id ${result.id})`);
    }
  }

  // Media: resolve every referenced file, upload what is new, and remember
  // where each one ended up so the renderer can point at it.
  const media = new Map<string, { id: number; url: string }>();
  const mediaRecords: Artifacts['media'] = [];
  let mediaPending = 0;

  if (config.uploadMedia) {
    const result = await syncMedia({ config, model, version, tree, session, issues });
    for (const [url, ref] of result.byUrl) media.set(url, ref);
    mediaRecords.push(...result.records);
    mediaPending = result.pending;
    actions.push(...result.actions);
  }

  // Phase 2: render against the real ids, and write what differs.
  const navRootId = ids.get('') ?? null;
  const prepared: PreparedPage[] = [];
  const banner =
    version.banner && !version.isLast
      ? renderVersionBanner(theme, version.label, version.banner)
      : undefined;

  for (const node of nodes) {
    const page = renderPageFor({
      node,
      tree,
      config,
      model,
      version,
      theme,
      href,
      navRootId,
      admonitionKeywords: input.instance.admonitionKeywords,
      media,
      issues,
      ...(banner ? { banner } : {}),
    });
    prepared.push({ node, page, locale, versionName: version.name });

    const id = ids.get(node.path);
    if (!session || id === null || id === undefined) continue;
    if (!inScope(node.path) && !created.has(node.path)) continue;

    const parentId = node.parent ? (ids.get(node.parent.path) ?? 0) : (rootParentId ?? 0);
    const remote = await session.fetchPage(id);
    const changed = session.diffPage(remote, page, parentId ?? 0);

    if (changed.length === 0) {
      actions.push({
        op: 'unchanged',
        path: node.path,
        id,
        locale,
        versionName: version.name,
        file: page.file ?? null,
      });
      continue;
    }

    actions.push({
      op: 'update',
      path: node.path,
      id,
      changed,
      locale,
      versionName: version.name,
      file: page.file ?? null,
    });
    if (config.dryRun) continue;

    const { warnings } = await session.writePage(id, page, parentId ?? 0);
    for (const warning of warnings) {
      issues.add({ code: 'target-warning', severity: 'warning', message: warning, path: node.path });
    }
    log(`updated ${node.path || '(root)'} (${changed.join(', ')})`);
  }

  // Anything under this version's root that no document accounts for.
  if (session && navRootId !== null) {
    if (config.only) {
      issues.add({
        code: 'prune-skipped',
        severity: 'info',
        message: 'Pruning was skipped because --only limited the run.',
      });
    } else {
      const index = await session.loadIndex();
      const keep = new Set<number>();
      for (const id of ids.values()) if (typeof id === 'number') keep.add(id);
      for (const page of session.computePrune(index, navRootId, keep)) {
        // Position inside the tree is not ownership. Somebody may have added a
        // page under the documentation root, and trashing it because this run
        // did not account for it would be pterodoc deleting someone else's work.
        const full = await session.fetchPage(page.id);
        if (!isGeneratedPage(full.content ?? '', config.classPrefix)) {
          issues.add({
            code: 'prune-skipped-foreign',
            severity: 'info',
            message: `${page.link} sits under the documentation root but was not written by pterodoc, so it was left alone.`,
          });
          continue;
        }

        actions.push({
          op: 'prune',
          path: page.slug,
          id: page.id,
          locale,
          versionName: version.name,
          applied: config.prune && !config.dryRun,
        });
        if (config.prune && !config.dryRun) {
          await session.removePage(page);
          log(`trashed ${page.link}`);
        }
      }
    }
  }

  return { actions, prepared, media: mediaRecords, mediaPending };
}

/** Render one page, body and all. */
function renderPageFor(input: {
  node: PageNode;
  tree: PageTree;
  config: ResolvedConfig;
  model: SiteModel;
  version: DocsVersion;
  theme: Theme;
  href: (treePath: string) => string;
  navRootId: number | null;
  admonitionKeywords: string[];
  media: Map<string, { id: number; url: string }>;
  issues: IssueCollector;
  banner?: string;
}): RenderedPage {
  const { node, tree, config, model, theme, issues } = input;
  const doc = node.doc;

  let body = '';
  let links = new Set<string>();
  let firstParagraph = '';

  if (doc) {
    const markdown = readDocument(doc, issues);
    if (markdown !== undefined) {
      const rendered = renderDoc({
        markdown,
        file: doc.sourceRelativePath,
        permalink: doc.permalink,
        format: doc.format,
        theme,
        admonitionKeywords: input.admonitionKeywords,
        maintainCase: model.maintainCase,
        dedupeTitle: config.dedupeTitle,
        onUnknownJsx: config.mdxOnUnknown,
        media: input.media,
        issues,
        resolveLink: makeLinkResolver(doc, tree, config, model, input.href),
      });
      body = rendered.body;
      links = rendered.links;
      firstParagraph = rendered.firstParagraph;
    }
  }

  const content = composePage({
    node,
    body,
    links,
    href: input.href,
    lookup: (treePath) => tree.byPath.get(treePath),
    theme,
    layout: config.layout satisfies PageLayout,
    navRootId: input.navRootId,
    ...(input.banner ? { banner: input.banner } : {}),
  });

  const excerpt = excerptFor(doc?.description ?? '', firstParagraph, config.excerptLength);
  const meta: Record<string, string> = {};
  if (config.metaDescriptionKey && excerpt) meta[config.metaDescriptionKey] = excerpt;

  return {
    path: node.path,
    slug: node.slug,
    title: node.title,
    content,
    excerpt,
    menuOrder: node.menuOrder,
    meta,
    file: doc?.sourceRelativePath,
    versionName: node.versionName,
  };
}

/** Read a document's source, reporting rather than throwing when it is gone. */
function readDocument(doc: Doc, issues: IssueCollector): string | undefined {
  try {
    return readFileSync(doc.sourceAbsolutePath, 'utf8');
  } catch (error) {
    issues.addFor(doc, {
      code: 'source-unreadable',
      severity: 'error',
      message: `Could not read ${doc.sourceRelativePath}: ${(error as Error).message}`,
    });
    return undefined;
  }
}

/** Decide where each link in a document should point. */
function makeLinkResolver(
  doc: Doc,
  tree: PageTree,
  config: ResolvedConfig,
  model: SiteModel,
  href: (treePath: string) => string,
): LinkResolver {
  const siteUrl = (config.siteUrl || model.url).replace(/\/+$/, '');
  const baseUrl = model.baseUrl.replace(/\/+$/, '');

  /**
   * A root-relative markdown link is relative to the site, not to the server.
   * Docusaurus's router prepends the base URL, so a link written as
   * `/docs/api/` on a site served from `/project/` really means
   * `/project/docs/api/`.
   */
  const withBaseUrl = (urlPath: string): string =>
    !baseUrl || urlPath === baseUrl || urlPath.startsWith(`${baseUrl}/`)
      ? urlPath
      : `${baseUrl}${urlPath}`;

  return (rawHref: string): ReturnType<LinkResolver> => {
    if (!rawHref || rawHref.startsWith('#')) return { href: rawHref };
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(rawHref) || rawHref.startsWith('//')) {
      return { href: rawHref };
    }

    const hashIndex = rawHref.indexOf('#');
    const hash = hashIndex === -1 ? '' : rawHref.slice(hashIndex);
    const target = hashIndex === -1 ? rawHref : rawHref.slice(0, hashIndex);

    const node = target.startsWith('/')
      ? findByUrl(tree, withBaseUrl(target))
      : findBySourcePath(tree, doc, target);

    if (node) return { href: `${href(node.path)}${hash}`, path: node.path };
    if (config.unpublishedLinks === 'drop') return { href: null };

    // Nothing here publishes it, so point at the documentation site, using the
    // URL Docusaurus itself would serve.
    const urlPath = target.startsWith('/')
      ? withBaseUrl(path.posix.normalize(target))
      : path.posix.normalize(path.posix.join(doc.permalink, '..', target.replace(/\.mdx?$/, '')));
    return { href: `${siteUrl}${urlPath}${hash}` };
  };
}

/** A page whose document is served at this URL. */
function findByUrl(tree: PageTree, target: string): PageNode | undefined {
  const urlPath = path.posix.normalize(target).replace(/\.mdx?$/, '');
  return tree.byPermalink.get(urlPath) ?? tree.byPermalink.get(`${urlPath}/`);
}

/**
 * A page whose source file a relative link points at.
 *
 * Relative links are resolved against the file, which is how Docusaurus
 * resolves them. Resolving against the URL instead would break every document
 * whose front matter gives it a slug of its own.
 */
function findBySourcePath(tree: PageTree, from: Doc, target: string): PageNode | undefined {
  const base = path.posix.dirname(from.sourceRelativePath);
  const resolved = path.posix.normalize(path.posix.join(base, target));
  const withoutExtension = resolved.replace(/\.mdx?$/, '');

  const candidates = [
    resolved,
    `${withoutExtension}.md`,
    `${withoutExtension}.mdx`,
    `${withoutExtension}/index.md`,
    `${withoutExtension}/index.mdx`,
    `${withoutExtension}/README.md`,
  ];
  for (const candidate of candidates) {
    const node = tree.bySourcePath.get(candidate);
    if (node) return node;
  }
  return undefined;
}

/** Resolve, upload and record every file the documents reference. */
async function syncMedia(input: {
  config: ResolvedConfig;
  model: SiteModel;
  version: DocsVersion;
  tree: PageTree;
  session: TargetSession | undefined;
  issues: IssueCollector;
}): Promise<{
  byUrl: Map<string, { id: number; url: string }>;
  records: Artifacts['media'];
  actions: Action[];
  pending: number;
}> {
  const { config, model, version, tree, session, issues } = input;
  const byUrl = new Map<string, { id: number; url: string }>();
  const records: Artifacts['media'] = [];
  const actions: Action[] = [];
  let pending = 0;

  const remote: Map<string, MediaRef> = session ? await session.loadMediaIndex() : new Map();
  const uploadedThisRun = new Map<string, MediaRef>();

  for (const node of [tree.root, ...tree.chain]) {
    const doc = node.doc;
    if (!doc) continue;

    let markdown: string;
    try {
      markdown = await fs.readFile(doc.sourceAbsolutePath, 'utf8');
    } catch {
      continue;
    }

    for (const image of collectImages(markdown, doc.format)) {
      if (byUrl.has(image.url)) continue;

      const resolved = resolveImage(image.url, {
        sourceAbsolutePath: doc.sourceAbsolutePath,
        contentPath: version.contentPath,
        contentPathLocalized: version.contentPathLocalized,
        staticDirs: model.staticDirs,
        baseUrl: model.baseUrl,
        siteDir: model.siteDir,
      });

      if (resolved.kind === 'external') continue;

      if (resolved.kind === 'missing') {
        if (config.mediaOnMissing !== 'ignore') {
          issues.addFor(doc, {
            code: 'asset-missing',
            severity: config.mediaOnMissing,
            message: `The file "${image.url}" was not found, so the reference was left as written.`,
          });
        }
        continue;
      }

      const bytes = await fs.readFile(resolved.file);
      const hash = contentHash(bytes);
      const known = uploadedThisRun.get(hash) ?? remote.get(hash);

      if (known) {
        byUrl.set(image.url, { id: known.id, url: known.url });
        records.push({ hash, file: resolved.file, url: known.url, uploaded: false });
        actions.push({ op: 'reuse-media', path: node.path, id: known.id, file: resolved.file });
        continue;
      }

      if (!session || config.dryRun) {
        pending += 1;
        records.push({ hash, file: resolved.file, url: null, uploaded: false });
        actions.push({ op: 'upload-media', path: node.path, id: null, file: resolved.file });
        continue;
      }

      const filename = path.basename(resolved.file);
      const mime = mimeTypeFor(filename);
      if (!mime) {
        issues.addFor(doc, {
          code: 'asset-unknown-type',
          severity: 'warning',
          message: `Not uploading "${image.url}": its file type is not one WordPress accepts.`,
        });
        continue;
      }

      const uploaded = await session.uploadMedia({
        bytes,
        filename,
        hash,
        mime,
        alt: image.alt,
        title: image.title ?? titleCase(path.parse(filename).name),
      });
      uploadedThisRun.set(hash, uploaded);
      byUrl.set(image.url, { id: uploaded.id, url: uploaded.url });
      records.push({ hash, file: resolved.file, url: uploaded.url, uploaded: true });
      actions.push({ op: 'upload-media', path: node.path, id: uploaded.id, file: resolved.file });
    }
  }

  return { byUrl, records, actions, pending };
}

/** Issues, for callers that want them without the plan. */
export type { Issue };
