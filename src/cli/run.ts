/**
 * Command line entry point.
 *
 * The only place that catches: every other module raises and lets this decide
 * how it is presented and which exit code it becomes.
 */

import { EXIT, ConfigError, PterodocError, TargetError } from '../errors';
import { VERSION } from '../version';

/**
 * Run the CLI.
 *
 * @param argv Arguments after the executable and script name.
 * @returns The process exit code.
 */
export async function main(argv: string[]): Promise<number> {
  try {
    if (argv.includes('--version') || argv.includes('-v')) {
      process.stdout.write(`${VERSION}\n`);
      return EXIT.ok;
    }
    process.stdout.write(`pterodoc ${VERSION}\n`);
    return EXIT.ok;
  } catch (error) {
    return report(error);
  }
}

/** Present an error the way its type deserves, and return its exit code. */
function report(error: unknown): number {
  if (error instanceof ConfigError) {
    process.stderr.write(`\n${error.message}\n`);
    return error.exitCode;
  }
  if (error instanceof TargetError) {
    process.stderr.write(`\nThe target refused a request: ${error.message}\n`);
    if (error.bodySnippet) process.stderr.write(`  body: ${error.bodySnippet}\n`);
    return error.exitCode;
  }
  if (error instanceof PterodocError) {
    process.stderr.write(`\n${error.message}\n`);
    return error.exitCode;
  }
  process.stderr.write(`\n${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
  return EXIT.internal;
}
