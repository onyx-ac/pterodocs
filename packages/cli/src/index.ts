/**
 * Public API.
 *
 * Importing pterodocs as a library is supported for two things: authoring a
 * configuration with type checking, and driving a sync from your own script.
 *
 * The implementation lives in `@pterodocs/core`, `@pterodocs/docusaurus` and
 * `@pterodocs/wordpress`; this package is where they are wired together, and
 * this barrel is the surface that wiring exposes.
 */

export { EXIT, PterodocsError, ConfigError, TargetError, UnsupportedContentError } from '@pterodocs/core';
export { VERSION } from '@pterodocs/core';
export { defineConfig } from '@pterodocs/core';
export type {
  PterodocsConfig,
  SiteConfig,
  TargetConfig,
  RenderConfig,
  MdxConfig,
  MediaConfig,
  OutputConfig,
} from '@pterodocs/core';
export { loadConfig, resolveConfig } from '@pterodocs/core';
export type { ResolvedConfig, ConfigFlags } from '@pterodocs/core';
export { runSync } from '@pterodocs/core';
export type { RunResult, RunSyncDeps, Plan, Action } from '@pterodocs/core';
export { buildPageTree, createCaptureReader, createMemoryReader } from '@pterodocs/core/model';
export type { SiteModel, Doc, DocsVersion, PageNode, PageTree, SourceReader } from '@pterodocs/core/model';
export { loadModel, toSiteModel, createDocusaurusReader } from '@pterodocs/docusaurus';
export { createWordpressTarget } from '@pterodocs/wordpress';
export type { Target, TargetSession, RenderedPage, RemotePage } from '@pterodocs/core/target';
export { renderDoc, createTheme, composePage, DEFAULT_LAYOUT } from '@pterodocs/core/render';
export type { RenderedDoc, Theme, Strings, PageLayout } from '@pterodocs/core/render';
export { IssueCollector, formatIssue, compareSeverity } from '@pterodocs/core/util';
export type { Issue, Severity } from '@pterodocs/core/util';
export { resolveTarget } from './target';
