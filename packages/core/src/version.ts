/** The tool's own version, stamped into the build. */

import fs from 'node:fs';

/**
 * Read the version.
 *
 * The build replaces the token, so a built artefact never touches the disk and
 * does not care how deeply it is nested. Running from source — tsx, the test
 * suite, an editor — there is no token, and the manifest sits exactly one
 * directory above this file.
 *
 * `typeof` on an undeclared identifier is the one expression that does not
 * throw, so the ambient declaration costs nothing at runtime.
 */
function readVersion(): string {
  if (typeof __PTERODOCS_VERSION__ === 'string') return __PTERODOCS_VERSION__;
  try {
    const manifest = new URL('../package.json', import.meta.url);
    const parsed = JSON.parse(fs.readFileSync(manifest, 'utf8')) as { version?: string };
    return parsed.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/** Semantic version of this package. */
export const VERSION = readVersion();

/** The User-Agent every outbound request identifies itself with. */
export const USER_AGENT = `pterodocs/${VERSION} (+https://github.com/onyx-ac/pterodocs)`;
