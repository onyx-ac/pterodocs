/**
 * Structured diagnostics.
 *
 * Everything a run wants to tell the user goes through here rather than into
 * free-form strings, so the CLI can group them, `--json` can emit them, and
 * `--strict` can decide whether they should fail the run.
 */

/** How much a reader should care. */
export type Severity = 'info' | 'warning' | 'error';

const ORDER: Record<Severity, number> = { info: 0, warning: 1, error: 2 };

/** One thing worth telling the user about. */
export interface Issue {
  /** Stable identifier, e.g. `mdx-unknown-component`. Never localised. */
  code: string;
  /** How much a reader should care. */
  severity: Severity;
  /** One sentence, in English, naming what happened. */
  message: string;
  /** Source file the issue came from, relative to the site directory. */
  file?: string | undefined;
  /** One-based line within `file`. */
  line?: number | undefined;
  /** One-based column within `line`. */
  column?: number | undefined;
  /** Document id, when the issue belongs to a document. */
  docId?: string | undefined;
  /** Page path within the target tree, when the issue belongs to a page. */
  path?: string | undefined;
}

/** Accumulates issues during a run. */
export class IssueCollector {
  readonly issues: Issue[] = [];

  /** Record an issue. */
  add(issue: Issue): void {
    this.issues.push(issue);
  }

  /** Record an issue that inherits a document's file and id. */
  addFor(
    doc: { id: string; sourceRelativePath?: string } | undefined,
    issue: Omit<Issue, 'docId' | 'file'> & { file?: string },
  ): void {
    this.add({
      ...issue,
      docId: doc?.id,
      file: issue.file ?? doc?.sourceRelativePath,
    });
  }

  /** True when any issue is at least as severe as `severity`. */
  hasAtLeast(severity: Severity): boolean {
    return this.issues.some((issue) => ORDER[issue.severity] >= ORDER[severity]);
  }

  /** Issues at least as severe as `severity`. */
  atLeast(severity: Severity): Issue[] {
    return this.issues.filter((issue) => ORDER[issue.severity] >= ORDER[severity]);
  }

  /** How many issues carry each code, for a compact summary. */
  countByCode(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const issue of this.issues) counts[issue.code] = (counts[issue.code] ?? 0) + 1;
    return counts;
  }
}

/** Compare two severities; positive when `a` is more severe than `b`. */
export function compareSeverity(a: Severity, b: Severity): number {
  return ORDER[a] - ORDER[b];
}

/** Render an issue as one line, with its position when it has one. */
export function formatIssue(issue: Issue): string {
  const where = issue.file
    ? `${issue.file}${issue.line ? `:${issue.line}${issue.column ? `:${issue.column}` : ''}` : ''}: `
    : issue.path
      ? `${issue.path || '(root)'}: `
      : '';
  return `${where}${issue.message}`;
}
