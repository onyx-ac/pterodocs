/**
 * Removing documentation pterodoc published.
 *
 * Not the same job as pruning, and deliberately not the same code path.
 *
 * Pruning happens during a sync. It knows what the documentation should contain
 * and removes what is left over, so it needs the model, and it only ever looks
 * inside the tree currently being published.
 *
 * Purging is the opposite question: take away what pterodoc put at this path.
 * It needs no model at all — which is the point, because the usual reason to
 * purge is that the documentation has moved somewhere else and the old location
 * is no longer part of any run. Asking Docusaurus to describe a site in order to
 * delete pages from a place that site no longer publishes to would be absurd,
 * and slow.
 *
 * Nothing is removed that pterodoc cannot recognise as its own, and nothing is
 * removed unless asked: the default is to report.
 */

import { isGeneratedPage } from '../render/page';
import type { RemotePage, TargetSession } from '../target/target';

/** What a purge would do, or did. */
export interface PurgeReport {
  /** The tree's root page, when there is one at that path. */
  root?: RemotePage;
  /** Pages pterodoc recognises as its own, deepest first. */
  removed: RemotePage[];
  /** Pages inside the tree that pterodoc did not write, and so did not touch. */
  kept: RemotePage[];
  /** Whether the removals were actually applied. */
  applied: boolean;
}

/** What to purge, and whether to mean it. */
export interface PurgeOptions {
  /** Path segments of the tree's root page, from the site root. */
  segments: string[];
  /** The class prefix the pages were published with. */
  classPrefix: string;
  /** Remove them, rather than only reporting. */
  apply: boolean;
  /** Called for each page as it goes. */
  log?: (message: string) => void;
}

/**
 * Find a page by walking a path from the site root.
 *
 * @param index Every page on the site.
 * @param segments Slugs, outermost first.
 * @returns The page at that path, or undefined.
 */
export function findByPath(index: RemotePage[], segments: string[]): RemotePage | undefined {
  let parent = 0;
  let found: RemotePage | undefined;

  for (const slug of segments) {
    found = index.find((page) => page.parent === parent && page.slug === slug);
    if (!found) return undefined;
    parent = found.id;
  }

  return found;
}

/**
 * Remove the documentation at one path.
 *
 * @param session An open session on the target.
 * @param options Which tree, and whether to apply.
 */
export async function purgeTree(
  session: TargetSession,
  options: PurgeOptions,
): Promise<PurgeReport> {
  const log = options.log ?? ((): void => {});
  const index = await session.loadIndex();
  const root = findByPath(index, options.segments);

  if (!root) {
    return { removed: [], kept: [], applied: false };
  }

  // Everything below the root, deepest first, then the root itself: a parent is
  // never removed before its children.
  const below = session.computePrune(index, root.id, new Set<number>());
  const candidates = [...below, root];

  const removed: RemotePage[] = [];
  const kept: RemotePage[] = [];

  for (const page of candidates) {
    // The index carries no content, so each candidate has to be read before it
    // can be judged. Worth the requests: the alternative is deleting on faith.
    const full = await session.fetchPage(page.id);
    const content = full.content ?? '';

    if (!isGeneratedPage(content, options.classPrefix)) {
      kept.push(full);
      log(`kept ${page.link} — not written by pterodoc`);
      continue;
    }

    removed.push(full);

    if (options.apply) {
      await session.removePage(page);
      log(`trashed ${page.link}`);
    }
  }

  return { root, removed, kept, applied: options.apply };
}
