/** The tool's own version, read once from its package manifest. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Walk up from this module until a `pterodoc` manifest turns up.
 *
 * Walking rather than assuming a fixed depth keeps this correct whether the
 * module is running from `src/` under tsx, from `lib/`, or from a shared chunk
 * one directory deeper.
 */
function readVersion(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = path.join(dir, 'package.json');
    try {
      const parsed = JSON.parse(fs.readFileSync(candidate, 'utf8')) as { name?: string; version?: string };
      if (parsed.name === 'pterodoc' && parsed.version) return parsed.version;
    } catch {
      // Not this directory; keep walking.
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return '0.0.0';
}

/** Semantic version of this package. */
export const VERSION = readVersion();

/** The User-Agent every outbound request identifies itself with. */
export const USER_AGENT = `pterodoc/${VERSION} (+https://github.com/onyx-ac/pterodoc)`;
