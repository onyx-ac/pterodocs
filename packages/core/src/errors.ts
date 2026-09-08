/**
 * The error types the CLI knows how to present, and the exit codes they map to.
 *
 * Codes 0, 1 and 2 keep the meaning the DocStack sync script established, so a
 * workflow that already branches on them does not change behaviour.
 */

export const EXIT = {
  /** Everything asked for was done. */
  ok: 0,
  /** The configuration or the command line was wrong; printed without a stack. */
  config: 1,
  /** The target refused a request. */
  target: 2,
  /** `--strict` was given and an issue reached the configured severity. */
  strict: 3,
  /** Something we did not anticipate; printed with a stack. */
  internal: 4,
} as const;

/** Base class for every error this tool raises deliberately. */
export class PterodocError extends Error {
  /** Exit code the CLI should use. */
  readonly exitCode: number;

  constructor(message: string, exitCode: number = EXIT.internal) {
    super(message);
    this.name = new.target.name;
    this.exitCode = exitCode;
  }
}

/** A user-fixable problem with the configuration, the flags or the environment. */
export class ConfigError extends PterodocError {
  constructor(message: string) {
    super(message, EXIT.config);
  }
}

/** The target rejected a request, or could not be reached. */
export class TargetError extends PterodocError {
  /** HTTP status, or 0 when the request never completed. */
  readonly status: number;
  /** Machine-readable code the target supplied, when it supplied one. */
  readonly code: string | undefined;
  /** HTTP method of the failed request. */
  readonly method: string;
  /** URL of the failed request. */
  readonly url: string;
  /** First part of the response body, for diagnosis. */
  readonly bodySnippet: string;

  constructor(
    message: string,
    details: {
      status: number;
      code?: string | undefined;
      method: string;
      url: string;
      bodySnippet?: string;
    },
  ) {
    super(message, EXIT.target);
    this.status = details.status;
    this.code = details.code;
    this.method = details.method;
    this.url = details.url;
    this.bodySnippet = details.bodySnippet ?? '';
  }
}

/** Content that this tool cannot represent in the target, when configured to fail on it. */
export class UnsupportedContentError extends PterodocError {
  constructor(message: string) {
    super(message, EXIT.strict);
  }
}
