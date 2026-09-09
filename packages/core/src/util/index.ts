/**
 * Shared helpers with no domain knowledge, and the errors every layer throws.
 *
 * Nothing here imports another layer, which is what makes it safe for all of
 * them to import it.
 */

export { EXIT, PterodocsError, ConfigError, TargetError, UnsupportedContentError } from '../errors';
export { VERSION, USER_AGENT } from '../version';
export { contentHash } from './hash';
export { compareSeverity, formatIssue, IssueCollector } from './issues';
export type { Issue, Severity } from './issues';
export { mimeTypeFor, isBlockedByDefault } from './mime';
export {
  joinPath,
  relativeToPrefix,
  resolveAliasedPath,
  segments,
  slugify,
  titleCase,
  toPosix,
  toSlugSegments,
} from './paths';
