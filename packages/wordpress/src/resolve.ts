/**
 * Checking that a published page can actually be reached.
 *
 * WordPress resolves a path through its rewrite rules before it ever looks for
 * a page, and any plugin may add a rule that claims one. A rewrite endpoint is
 * the common case: registering `transactions` with `EP_PAGES` creates a rule
 * shaped `(.?.+?)/transactions(/(.*))?/?$` which sends the request to the
 * *parent* page with an endpoint variable attached. Every page anywhere on the
 * site whose slug is `transactions` then becomes unreachable.
 *
 * Nothing about publishing detects that. The write succeeds, the page exists,
 * WordPress reports a link for it — and the link answers 200 with a different
 * page's content. Only asking the front end settles it.
 *
 * The page a request actually reached is read from the `page-id-N` class that
 * `body_class()` puts on the body. It is not part of any contract, so a theme
 * that omits it means the check answers `unknown` — which is why the answer has
 * three values rather than two.
 */

import type { WordpressTargetDeps } from './index';

/** What a request for a page's own URL turned out to reach. */
export interface Resolution {
  /** `ok` served the page, `shadowed` served a different one, `unknown` could not tell. */
  verdict: 'ok' | 'shadowed' | 'unknown';
  /** The page that answered instead, when one could be identified. */
  servedId?: number | undefined;
}

/** `body_class()` writes this for a singular page, and themes almost all call it. */
const PAGE_ID = /\bpage-id-(\d+)\b/;

/**
 * Ask the site which page a URL reaches.
 *
 * Unauthenticated on purpose: the question is what a reader gets, and a reader
 * is not signed in. That also means it can only answer for a page the public
 * can see — a draft or a private page is skipped by the caller.
 *
 * @param id The page that should answer.
 * @param url Its own absolute URL.
 * @param deps Where `fetch` comes from.
 * @returns What answered, or that it could not be told.
 */
export async function verifyResolution(
  id: number,
  url: string,
  deps: WordpressTargetDeps,
): Promise<Resolution> {
  const fetcher = deps.fetch ?? fetch;

  let html: string;
  try {
    const response = await fetcher(url, { redirect: 'follow' });
    if (!response.ok) return { verdict: 'unknown' };
    html = await response.text();
  } catch {
    // The check is a courtesy. A site that cannot be read from the outside —
    // behind basic auth, or simply offline — is not a reason to fail a publish.
    return { verdict: 'unknown' };
  }

  const found = PAGE_ID.exec(html);
  if (!found) return { verdict: 'unknown' };

  const servedId = Number(found[1]);
  return servedId === id ? { verdict: 'ok' } : { verdict: 'shadowed', servedId };
}
