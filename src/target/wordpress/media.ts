/**
 * The WordPress media library.
 *
 * A file's identity is the hash of its contents, carried in the media slug.
 * Keeping the identity on the server rather than in a local cache is what lets
 * a fresh checkout, or a CI runner that has never seen the site, avoid
 * uploading everything again.
 */

import { TargetError } from '../../errors';
import { isBlockedByDefault } from '../../util/mime';
import type { MediaRef, MediaUpload } from '../target';
import type { WpClient } from './client';

/** WordPress's media shape, narrowed to what is read. */
interface WpMedia {
  id: number;
  slug: string;
  source_url: string;
  mime_type: string;
}

/** The slug that identifies a file uploaded by pterodoc. */
export function mediaSlug(prefix: string, hash: string): string {
  return `${prefix}-${hash}`;
}

/** Read the hash back out of a slug, when the slug is one of ours. */
export function hashFromSlug(prefix: string, slug: string): string | undefined {
  const marker = `${prefix}-`;
  if (!slug.startsWith(marker)) return undefined;
  const hash = slug.slice(marker.length);
  return /^[0-9a-f]{16}$/.test(hash) ? hash : undefined;
}

/**
 * Everything pterodoc has already uploaded to this site, by content hash.
 */
export async function loadMediaIndex(
  client: WpClient,
  prefix: string,
): Promise<Map<string, MediaRef>> {
  const found = await client.listAll<WpMedia>('/media', {
    search: `${prefix}-`,
    _fields: 'id,slug,source_url,mime_type',
  });

  const byHash = new Map<string, MediaRef>();
  for (const item of found) {
    const hash = hashFromSlug(prefix, item.slug);
    if (!hash || byHash.has(hash)) continue;
    byHash.set(hash, {
      id: item.id,
      hash,
      url: item.source_url,
      filename: item.slug,
      mime: item.mime_type,
    });
  }
  return byHash;
}

/**
 * Upload one file.
 *
 * WordPress derives a slug from the filename on create, so the identifying
 * slug has to be set in a second request.
 */
export async function uploadMedia(
  client: WpClient,
  upload: MediaUpload,
  prefix: string,
): Promise<MediaRef> {
  const slug = mediaSlug(prefix, upload.hash);
  const form = new FormData();
  const bytes = upload.bytes;
  const view = new Uint8Array(bytes.byteLength);
  view.set(bytes);
  form.append('file', new File([view], upload.filename, { type: upload.mime }));
  if (upload.title) form.append('title', upload.title);
  if (upload.alt) form.append('alt_text', upload.alt);

  let created: WpMedia;
  try {
    ({ data: created } = await client.request<WpMedia>('POST', '/media', { form }));
  } catch (error) {
    if (error instanceof TargetError && error.status === 400 && isBlockedByDefault(upload.mime)) {
      throw new TargetError(
        `${upload.filename} was refused. WordPress blocks ${upload.mime} uploads unless a plugin allows them, because such a file can carry script.`,
        { status: error.status, code: error.code, method: error.method, url: error.url },
      );
    }
    throw error;
  }

  const { data: updated } = await client.request<WpMedia>('POST', `/media/${created.id}`, {
    body: { slug, ...(upload.title ? { title: upload.title } : {}), ...(upload.alt ? { alt_text: upload.alt } : {}) },
  });

  return {
    id: updated.id,
    hash: upload.hash,
    url: updated.source_url || created.source_url,
    filename: upload.filename,
    mime: updated.mime_type || upload.mime,
  };
}
