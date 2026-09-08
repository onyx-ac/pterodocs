/**
 * Public API.
 *
 * Importing pterodoc as a library is supported for two things: authoring a
 * configuration with type checking, and driving a sync from your own script.
 *
 * The implementation lives in `@pterodoc/core`, `@pterodoc/docusaurus` and
 * `@pterodoc/wordpress`; this package is where they are wired together, and
 * this barrel is the surface that wiring exposes.
 */

export { EXIT, PterodocError, ConfigError, TargetError, UnsupportedContentError } from '@pterodoc/core';
export { VERSION } from '@pterodoc/core';
export { defineConfig } from '@pterodoc/core';
export type {
  PterodocConfig,
  SiteConfig,
  TargetConfig,
  RenderConfig,
  MdxConfig,
  MediaConfig,
  OutputConfig,
} from '@pterodoc/core';
export { loadConfig, resolveConfig } from '@pterodoc/core';
export type { ResolvedConfig, ConfigFlags } from '@pterodoc/core';
export { runSync } from '@pterodoc/core';
export type { RunResult, RunSyncDeps, Plan, Action } from '@pterodoc/core';
export { buildPageTree, createCaptureReader, createMemoryReader } from '@pterodoc/core/model';
export type { SiteModel, Doc, DocsVersion, PageNode, PageTree, SourceReader } from '@pterodoc/core/model';
export { loadModel, toSiteModel, createDocusaurusReader } from '@pterodoc/docusaurus';
export { createWordpressTarget } from '@pterodoc/wordpress';
export type { Target, TargetSession, RenderedPage, RemotePage } from '@pterodoc/core/target';
export { renderDoc, createTheme, composePage, DEFAULT_LAYOUT } from '@pterodoc/core/render';
export type { RenderedDoc, Theme, Strings, PageLayout } from '@pterodoc/core/render';
export { IssueCollector, formatIssue, compareSeverity } from '@pterodoc/core/util';
export type { Issue, Severity } from '@pterodoc/core/util';
export { resolveTarget } from './target';
