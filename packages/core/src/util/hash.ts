/** Content hashing, used to give an uploaded asset a stable identity. */

import { createHash } from 'node:crypto';

/**
 * A short content hash.
 *
 * Sixteen hex characters of SHA-256: long enough that a collision across one
 * site's assets is not a practical concern, short enough to sit inside a
 * WordPress slug without dominating it.
 */
export function contentHash(bytes: Uint8Array | string): string {
  return createHash('sha256').update(bytes).digest('hex').slice(0, 16);
}
