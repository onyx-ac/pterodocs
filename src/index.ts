/**
 * Public API.
 *
 * Importing pterodoc as a library is supported for two things: authoring a
 * configuration with type checking, and driving a sync from your own script.
 */

export { EXIT, PterodocError, ConfigError, TargetError, UnsupportedContentError } from './errors';
export { VERSION } from './version';
export { defineConfig } from './config/types';
export type {
  PterodocConfig,
  SiteConfig,
  TargetConfig,
  RenderConfig,
  MdxConfig,
  MediaConfig,
  OutputConfig,
} from './config/types';
export { loadConfig, resolveConfig } from './config/load';
export type { ResolvedConfig, ConfigFlags } from './config/load';
export { runSync } from './sync/run';
export type { RunResult, RunSyncDeps } from './sync/run';
export type { Plan, Action } from './sync/plan';
export { loadModel, toSiteModel, buildPageTree } from './docusaurus/index';
export type { SiteModel, Doc, DocsVersion, PageNode, PageTree } from './docusaurus/index';
export { createDocusaurusReader, createCaptureReader, createMemoryReader } from './docusaurus/index';
export type { SourceReader } from './docusaurus/index';
export { createWordpressTarget } from './target/wordpress/index';
export type { Target, TargetSession, RenderedPage, RemotePage } from './target/target';
export { renderDoc, createTheme } from './render/index';
export type { RenderedDoc, Theme, Strings } from './render/index';
export { composePage, DEFAULT_LAYOUT } from './render/page';
export type { PageLayout } from './render/page';
export type { Issue, Severity } from './util/issues';
export { IssueCollector, formatIssue, compareSeverity } from './util/issues';
