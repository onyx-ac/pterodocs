/**
 * WordPress pages: finding them, comparing them, writing them, removing them.
 *
 * A page's identity is its parent and its slug, which is what makes a re-run
 * rewrite only what actually differs.
 */

import { TargetError } from '@pterodocs/core/util';
import type { RemotePage, RenderedPage } from '@pterodocs/core/target';
import { FULL_PAGE_FIELDS, PAGE_FIELDS, type WpClient } from './client';

/** WordPress's own page shape, narrowed to what is read. */
interface WpPage {
  id: number;
  parent: number;
  slug: string;
  status: string;
  link: string;
  title?: { raw?: string; rendered?: string };
  content?: { raw?: string };
  excerpt?: { raw?: string };
  menu_order: number;
  template: string;
  meta?: Record<string, unknown>;
}

/** Convert a WordPress page into the shape the reconciler compares. */
export function toRemotePage(page: WpPage): RemotePage {
  return {
    id: page.id,
    parent: page.parent,
    slug: page.slug,
    status: page.status,
    link: page.link,
    title: page.title?.raw ?? page.title?.rendered ?? '',
    ...(page.content?.raw !== undefined ? { content: page.content.raw } : {}),
    ...(page.excerpt?.raw !== undefined ? { excerpt: page.excerpt.raw } : {}),
    menuOrder: page.menu_order,
    template: page.template,
    meta: page.meta,
  };
}

/** Fetch every page on the site. */
export async function fetchPageIndex(client: WpClient): Promise<RemotePage[]> {
  const pages = await client.listAll<WpPage>('/pages', {
    status: 'any',
    context: 'edit',
    _fields: PAGE_FIELDS,
  });
  return pages.map(toRemotePage);
}

/** Fetch one page with the fields needed to compare it. */
export async function fetchPage(client: WpClient, id: number): Promise<RemotePage> {
  const { data } = await client.request<WpPage>('GET', `/pages/${id}`, {
    query: { context: 'edit', _fields: FULL_PAGE_FIELDS },
  });
  return toRemotePage(data);
}

/**
 * Find a page by its position in the tree.
 *
 * The index is searched when one was supplied, because a whole-site index is
 * one request where per-page lookups are hundreds.
 */
export async function findPage(
  client: WpClient,
  parent: number,
  slug: string,
  index?: RemotePage[],
  log: (message: string) => void = () => {},
): Promise<RemotePage | undefined> {
  let candidates: RemotePage[];
  if (index) {
    candidates = index.filter((page) => page.parent === parent && page.slug === slug);
  } else {
    const { data } = await client.request<WpPage[]>('GET', '/pages', {
      query: { parent, slug, status: 'any', context: 'edit', per_page: 100, _fields: PAGE_FIELDS },
    });
    candidates = (Array.isArray(data) ? data : []).map(toRemotePage);
  }
  if (candidates.length > 1) {
    log(`${candidates.length} pages share parent ${parent} and slug "${slug}"; using id ${candidates[0]!.id}.`);
  }
  return candidates[0];
}

/** Body sent when creating or updating a page. */
export interface PageInput {
  title?: string;
  content?: string;
  excerpt?: string;
  parent?: number;
  slug?: string;
  status?: string;
  menu_order?: number;
  template?: string;
  meta?: Record<string, unknown>;
}

/** Create a page, checking that WordPress honoured the slug we asked for. */
export async function createPage(client: WpClient, input: PageInput): Promise<RemotePage> {
  const { data } = await client.request<WpPage>('POST', '/pages', { body: input });
  if (input.slug && data.slug !== input.slug) {
    throw new TargetError(
      `WordPress stored the new page as "${data.slug}" rather than "${input.slug}". Another page, possibly one in the trash, already holds that slug. The page it created is id ${data.id}.`,
      { status: 200, method: 'POST', url: '/pages' },
    );
  }
  return toRemotePage(data);
}

/** Update a page. */
export async function updatePage(
  client: WpClient,
  id: number,
  input: PageInput,
): Promise<RemotePage> {
  const { data } = await client.request<WpPage>('POST', `/pages/${id}`, { body: input });
  return toRemotePage(data);
}

/**
 * Move a page to the trash.
 *
 * Never a permanent delete: recovering from a mistaken prune should not
 * require a database backup.
 */
export async function trashPage(client: WpClient, id: number): Promise<void> {
  await client.request('DELETE', `/pages/${id}`);
}

/** Normalise a value for comparison, so whitespace alone is not a difference. */
const normalise = (value: unknown): string =>
  String(value ?? '').replace(/\r\n/g, '\n').trim();

/**
 * Which fields of an existing page differ from the rendered one.
 *
 * @param remote The page as WordPress holds it.
 * @param rendered The page as pterodocs would publish it.
 * @param context The expected parent, slug, status and template.
 */
export function diffPage(
  remote: RemotePage,
  rendered: RenderedPage,
  context: { parentId: number; status: string; template: string; isRoot: boolean; slug: string },
): string[] {
  const changed: string[] = [];
  if (normalise(remote.title) !== normalise(rendered.title)) changed.push('title');
  if (normalise(remote.content) !== normalise(rendered.content)) changed.push('content');
  if (normalise(remote.excerpt) !== normalise(rendered.excerpt)) changed.push('excerpt');
  if (remote.status !== context.status) changed.push('status');
  if (!context.isRoot && remote.menuOrder !== rendered.menuOrder) changed.push('menu_order');
  if ((remote.template ?? '') !== context.template) changed.push('template');
  if (remote.parent !== context.parentId) changed.push('parent');
  if (remote.slug !== context.slug) changed.push('slug');

  // Metadata is only compared where the site actually exposes the field, so a
  // site without the SEO plugin does not report a difference on every run.
  for (const [key, value] of Object.entries(rendered.meta)) {
    if (remote.meta && key in remote.meta && normalise(remote.meta[key]) !== normalise(value)) {
      changed.push(`meta.${key}`);
    }
  }
  return changed;
}

/**
 * Pages below a root that no rendered page accounts for.
 *
 * Deepest first, so a parent is never trashed before its children.
 */
export function computePrune(
  index: RemotePage[],
  rootId: number,
  keepIds: Set<number>,
): RemotePage[] {
  const childrenOf = new Map<number, RemotePage[]>();
  for (const page of index) {
    const siblings = childrenOf.get(page.parent);
    if (siblings) siblings.push(page);
    else childrenOf.set(page.parent, [page]);
  }

  const owned: { page: RemotePage; depth: number }[] = [];
  const walk = (parentId: number, depth: number): void => {
    for (const page of childrenOf.get(parentId) ?? []) {
      owned.push({ page, depth });
      walk(page.id, depth + 1);
    }
  };
  walk(rootId, 0);

  return owned
    .filter(({ page }) => !keepIds.has(page.id))
    .sort((a, b) => b.depth - a.depth)
    .map(({ page }) => page);
}
