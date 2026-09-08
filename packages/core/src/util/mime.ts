/**
 * Extension to media type.
 *
 * A twenty-entry table rather than a dependency: these are the types a
 * documentation site actually embeds, and WordPress rejects most others.
 */

const TYPES: Record<string, string> = {
  '.apng': 'image/apng',
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogv': 'video/ogg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.json': 'application/json',
  '.txt': 'text/plain',
};

/** The media type for a file name, or undefined when we do not recognise it. */
export function mimeTypeFor(fileName: string): string | undefined {
  const dot = fileName.lastIndexOf('.');
  if (dot === -1) return undefined;
  return TYPES[fileName.slice(dot).toLowerCase()];
}

/**
 * True for types WordPress refuses by default.
 *
 * SVG is the one that surprises people: it is blocked unless a plugin allows
 * it, because an SVG can carry script.
 */
export function isBlockedByDefault(mime: string): boolean {
  return mime === 'image/svg+xml';
}
