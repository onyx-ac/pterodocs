/** What a run intends to do, and what it did. */

import type { Issue } from '../util/issues';

/** One thing a run did, or would do. */
export interface Action {
  /** What kind of change this is. */
  op:
    | 'create-root'
    | 'create'
    | 'update'
    | 'unchanged'
    | 'prune'
    | 'upload-media'
    | 'reuse-media';
  /** Full path within the published tree, for every operation. */
  path: string;
  /** Target id, once it is known. */
  id?: number | null;
  /** Fields that differ, for an update. */
  changed?: string[];
  /** Source file, when the action belongs to a document. */
  file?: string | null;
  /** Locale this action belongs to. */
  locale?: string;
  /** Version this action belongs to. */
  versionName?: string;
  /** Whether a removal was actually carried out. */
  applied?: boolean;
}

/** The record of a run. */
export interface Plan {
  /** When the run started. */
  generatedAt: string;
  /** Versions involved, for reproducing a report. */
  versions: { pterodocs: string; docusaurus: string | null; node: string };
  /** True when nothing was written. */
  dryRun: boolean;
  /** True when nothing was even read from the target. */
  offline: boolean;
  /** The target site, when there is one. */
  site: string | null;
  /** Where the documentation was published. */
  rootPath: string;
  /** Locales published. */
  locales: string[];
  /** Versions published. */
  versionNames: string[];
  /** Everything the run did, or would do. */
  actions: Action[];
  /** Everything worth telling the user. */
  issues: Issue[];
  /** How many of each operation. */
  summary: Record<string, number>;
  /** How many requests were made. */
  requests: number;
  /** How many files still need uploading; non-zero only on a dry run. */
  mediaPending: number;
  /** Set when writing the artefacts itself failed. */
  artifactError: string | null;
}

/** Count the actions by operation. */
export function summarise(actions: Action[]): Record<string, number> {
  const summary: Record<string, number> = {};
  for (const action of actions) summary[action.op] = (summary[action.op] ?? 0) + 1;
  return summary;
}
