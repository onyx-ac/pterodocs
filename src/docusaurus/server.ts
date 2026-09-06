/**
 * Loading Docusaurus's own site loader.
 *
 * `loadSite` runs every plugin's content lifecycle and hands back the resolved
 * site, which is the whole reason this tool does not re-derive sidebars,
 * versions or permalinks. It lives at a path Docusaurus does not advertise, so
 * the import is guarded and fails with something a reader can act on.
 */

import path from 'node:path';
import { createRequire } from 'node:module';
import { ConfigError } from '../errors';

/** Docusaurus versions this tool has been checked against. */
export const SUPPORTED_RANGE = { min: 3, maxExclusive: 4 };

/** Paths tried, in order, when looking for the site loader. */
const CANDIDATES = ['lib/server/site.js', 'server.js', 'lib/server/index.js'];

/** What `loadSite` gives back, narrowed to the parts we read. */
export interface LoadedSite {
  props: {
    siteDir: string;
    siteConfig: Record<string, unknown>;
    siteConfigPath: string;
    baseUrl: string;
    outDir: string;
    generatedFilesDir: string;
    i18n: {
      defaultLocale: string;
      locales: string[];
      currentLocale: string;
      localeConfigs: Record<string, { htmlLang?: string; direction?: string }>;
    };
    siteMetadata: { docusaurusVersion: string };
    plugins: Array<{
      name: string;
      options: Record<string, unknown>;
      content: unknown;
    }>;
  };
}

/** Options `loadSite` accepts. */
export interface LoadSiteParams {
  siteDir: string;
  locale?: string | undefined;
  config?: string | undefined;
  outDir?: string | undefined;
}

/** The shape of the Docusaurus module we depend on. */
export interface DocusaurusServer {
  /** Run the content lifecycle and return the resolved site. */
  loadSite(params: LoadSiteParams): Promise<LoadedSite>;
  /** The Docusaurus version that was loaded. */
  version: string;
}

/**
 * Find and load Docusaurus's site loader, resolving it from the site rather
 * than from pterodoc so a hoisted or a nested install both work.
 *
 * @param siteDir Absolute path of the Docusaurus site directory.
 * @param warn Called with a message when the version is outside the tested range.
 */
export function loadDocusaurusServer(
  siteDir: string,
  warn: (message: string) => void = () => {},
): DocusaurusServer {
  const requireFromSite = createRequire(path.join(siteDir, 'noop.js'));

  let corePackagePath: string;
  try {
    corePackagePath = requireFromSite.resolve('@docusaurus/core/package.json');
  } catch {
    throw new ConfigError(
      `Could not find @docusaurus/core from ${siteDir}. pterodoc reads a Docusaurus site using Docusaurus itself, so it has to run inside the site's own project. Use --site-dir to point at it, or --model to render from a captured model instead.`,
    );
  }

  const corePackage = requireFromSite(corePackagePath) as { version?: string };
  const version = corePackage.version ?? '0.0.0';
  const major = Number.parseInt(version.split('.')[0] ?? '0', 10);
  if (major < SUPPORTED_RANGE.min || major >= SUPPORTED_RANGE.maxExclusive) {
    warn(
      `This is Docusaurus ${version}; pterodoc has been checked against ${SUPPORTED_RANGE.min}.x. Continuing, but the site model may not load.`,
    );
  }

  const coreDir = path.dirname(corePackagePath);
  const tried: string[] = [];
  for (const candidate of CANDIDATES) {
    const candidatePath = path.join(coreDir, candidate);
    tried.push(candidatePath);
    try {
      const loaded = requireFromSite(candidatePath) as { loadSite?: unknown };
      if (typeof loaded.loadSite === 'function') {
        return { loadSite: loaded.loadSite as DocusaurusServer['loadSite'], version };
      }
    } catch {
      // Try the next candidate.
    }
  }

  throw new ConfigError(
    `Docusaurus ${version} is installed but its site loader was not where pterodoc expected it.\n` +
      `Tried:\n${tried.map((entry) => `  ${entry}`).join('\n')}\n` +
      'This usually means a Docusaurus release moved it. Capture a model on a working version with `pterodoc capture`, then render from it with `--model`, and please report the version.',
  );
}
