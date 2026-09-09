/**
 * What the user sees.
 *
 * GitHub Actions gets annotations it can surface on the run; a terminal gets
 * something readable.
 */

import { formatIssue, type Issue, type Severity } from '@pterodocs/core/util';
import type { Plan } from '@pterodocs/core';

/** How output is presented. */
export interface Reporter {
  info(message: string): void;
  detail(message: string): void;
  issue(issue: Issue): void;
  summary(plan: Plan): void;
}

/** Build a reporter. */
export function createReporter(options: {
  verbose?: boolean;
  quiet?: boolean;
  json?: boolean;
  env?: NodeJS.ProcessEnv;
}): Reporter {
  const env = options.env ?? process.env;
  const inActions = Boolean(env['GITHUB_ACTIONS']);
  const quiet = options.quiet === true || options.json === true;

  const annotate = (severity: Severity): string =>
    severity === 'error' ? 'error' : severity === 'warning' ? 'warning' : 'notice';

  return {
    info(message: string): void {
      if (!quiet) process.stdout.write(`${message}\n`);
    },
    detail(message: string): void {
      if (options.verbose && !quiet) process.stdout.write(`  ${message}\n`);
    },
    issue(issue: Issue): void {
      const text = formatIssue(issue);
      if (inActions) {
        process.stderr.write(`::${annotate(issue.severity)} title=${issue.code}::${text}\n`);
        return;
      }
      if (issue.severity === 'info' && !options.verbose) return;
      if (quiet && issue.severity !== 'error') return;
      process.stderr.write(`  ${issue.severity === 'error' ? '✗' : '!'} ${text}\n`);
    },
    summary(plan: Plan): void {
      if (options.json) {
        process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
        return;
      }
      const order = ['create-root', 'create', 'update', 'unchanged', 'prune', 'upload-media', 'reuse-media'];
      const parts = order
        .filter((op) => plan.summary[op])
        .map((op) => `${plan.summary[op]} ${op.replace('-', ' ')}`);
      process.stdout.write(`\n${parts.join(', ') || 'nothing to do'}`);
      if (plan.requests) process.stdout.write(` · ${plan.requests} requests`);
      process.stdout.write('\n');
    },
  };
}
