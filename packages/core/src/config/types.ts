/**
 * The configuration a site writes, and the resolved shape the tool reads.
 *
 * Credentials never appear here: the config names the environment variables
 * that hold them, so a config file is safe to commit.
 */

import type { Severity } from '../util/issues';
import type { PageLayout } from '../render/page';
import type { Strings } from '../render/theme';

/** Which documents to publish. */
export interface SiteConfig {
  /** Docusaurus site directory. Relative paths resolve against the config file. */
  dir?: string;
  /** Explicit `docusaurus.config.*` path. */
  config?: string;
  /** Docs plugin instances to publish, or 'all'. */
  instances?: string[] | 'all';
  /** Sidebars to publish. A document no kept sidebar reaches is not published. */
  sidebars?: string[] | 'all';
  /** Versions to publish: 'last', 'all', or explicit names. */
  versions?: string[] | 'all' | 'last';
  /** Locales to publish: 'default', 'all', or explicit codes. */
  locales?: string[] | 'all' | 'default';
  /** Publish documents Docusaurus marks as drafts. */
  includeDrafts?: boolean;
  /** Publish documents Docusaurus marks as unlisted. */
  includeUnlisted?: boolean;
  /** Publish documents that belong to no sidebar. */
  includeOrphans?: boolean;
}

/** Where to publish. */
export interface TargetConfig {
  /** The only implementation today. */
  type?: 'wordpress';
  /** Site origin. Usually supplied by the environment instead. */
  url?: string;
  /** Which environment variables hold the credentials. */
  auth?: { userEnv?: string; passwordEnv?: string };
  /** Path the documentation tree hangs from. */
  root?: string;
  /** Segment below the root holding the docs; '' publishes under the root. */
  base?: string;
  /** Title of the documentation root when no document claims it. */
  title?: string;
  /** Status applied to every synced page. */
  status?: 'publish' | 'draft' | 'private';
  /** Page template slug. */
  template?: string;
  /** Polylang language code. */
  lang?: string;
  /** Map a rendered field onto a target metadata key. */
  meta?: { description?: string };
  /** Send DELETE as POST with an override header. */
  methodOverride?: boolean;
  /** How hard to retry a busy site. */
  retry?: { attempts?: number; baseDelayMs?: number; maxDelayMs?: number };
}

/** How pages are rendered. */
export interface RenderConfig {
  /** Prefix on every generated class name. */
  classPrefix?: string;
  /**
   * Which block vocabulary to emit.
   *
   * `core` is the default and emits core blocks only. `plugin` additionally
   * carries instructions the pterodoc WordPress plugin understands — chiefly
   * highlighted line ranges, which core blocks cannot express at all — in block
   * comments rather than in markup, so WordPress stores the same content either
   * way. Set it once the plugin is installed; `pterodoc doctor` says whether it
   * is.
   */
  blocks?: 'core' | 'plugin';
  /** Drop a leading H1 that repeats the page title. */
  dedupeTitle?: boolean;
  /** Where links to unpublished documents point: the site, or nowhere. */
  unpublishedLinks?: 'site' | 'drop';
  /** Overrides the documentation site URL used by `unpublishedLinks: 'site'`. */
  siteUrl?: string;
  /** Longest excerpt, in characters. */
  excerptLength?: number;
  /** Human strings, overriding the defaults. */
  strings?: Partial<Strings>;
  /** Per-locale string overrides. */
  localeStrings?: Record<string, Partial<Strings>>;
}

/** How MDX is handled. */
export interface MdxConfig {
  /** What to do about JSX with no translation. */
  onUnknown?: 'report' | 'placeholder' | 'error';
}

/** How assets are handled. */
export interface MediaConfig {
  /** Upload local files to the target. */
  upload?: boolean;
  /** Also upload files that already point at another origin. */
  uploadRemote?: boolean;
  /** What to do when a referenced file is missing. */
  onMissing?: Severity | 'ignore';
  /** Prefix of the media slug that carries the content hash. */
  slugPrefix?: string;
}

/** Where the run writes what it did. */
export interface OutputConfig {
  /** Directory for rendered pages, the manifest and the plan. */
  dir?: string;
  /** Write each rendered page body as a file. */
  pages?: boolean;
}

/** A pterodoc configuration file. */
export interface PterodocConfig {
  site?: SiteConfig;
  target?: TargetConfig;
  layout?: Partial<PageLayout>;
  render?: RenderConfig;
  mdx?: MdxConfig;
  media?: MediaConfig;
  output?: OutputConfig;
  /** With `--strict`, an issue at this severity or above fails the run. */
  strict?: Severity;
}

/**
 * Identity function that types a configuration file.
 *
 * @param config The configuration.
 */
export function defineConfig(config: PterodocConfig): PterodocConfig {
  return config;
}
