/**
 * Heading identifiers.
 *
 * The anchors have to match the ones Docusaurus generated, or every in-page
 * link that survived the move would break. That is why `github-slugger` is
 * pinned to the major Docusaurus itself depends on.
 */

import GithubSlugger from 'github-slugger';
import { toString as mdastToString } from 'mdast-util-to-string';
import type { Heading, PhrasingContent, Text } from 'mdast';

/** A slugger scoped to one document, so repeated headings get `-1`, `-2` suffixes. */
export type Slugger = InstanceType<typeof GithubSlugger>;

/** Start a fresh slugger for a document. */
export function createSlugger(): Slugger {
  return new GithubSlugger();
}

/** A heading's identifier and the content that remains once the id syntax is removed. */
export interface HeadingId {
  /** The anchor for this heading. */
  id: string;
  /** The heading's children with any explicit `{#id}` stripped. */
  children: PhrasingContent[];
  /** Plain text of the heading, for a table of contents or a title. */
  text: string;
}

/**
 * Work out a heading's identifier.
 *
 * Docusaurus lets an explicit `{#id}` override the generated slug. Both paths
 * feed the same slugger so that a later duplicate is still disambiguated.
 *
 * @param heading The heading node.
 * @param slugger The document's slugger.
 * @param maintainCase Whether Docusaurus is configured to keep heading case.
 */
export function headingIdFor(heading: Heading, slugger: Slugger, maintainCase = false): HeadingId {
  const children = heading.children.map((child) => ({ ...child })) as PhrasingContent[];
  const last = children[children.length - 1];
  let explicit = '';

  if (last && last.type === 'text') {
    const text = last as Text;
    const match = /\s*\{#([^}]+)\}\s*$/.exec(text.value);
    if (match) {
      explicit = match[1]!.trim();
      text.value = text.value.slice(0, match.index).replace(/\s+$/, '');
      if (text.value === '') children.pop();
    }
  }

  const text = mdastToString({ type: 'root', children } as never);
  if (explicit) {
    // Register it so a later generated slug cannot collide with it.
    slugger.slug(explicit, true);
    return { id: explicit, children, text };
  }
  return { id: slugger.slug(text, maintainCase), children, text };
}
