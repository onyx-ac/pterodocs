/**
 * Public API.
 *
 * Importing pterodoc as a library is supported for two things: authoring a
 * configuration with type checking, and driving a sync from your own script.
 */

export { EXIT, PterodocError, ConfigError, TargetError, UnsupportedContentError } from './errors';
export { VERSION } from './version';
export type { Issue, Severity } from './util/issues';
export { IssueCollector, formatIssue, compareSeverity } from './util/issues';
export { contentHash } from './util/hash';
export { mimeTypeFor, isBlockedByDefault } from './util/mime';
export {
  resolveAliasedPath,
  toPosix,
  segments,
  toSlugSegments,
  slugify,
  titleCase,
  relativeToPrefix,
  joinPath,
} from './util/paths';
