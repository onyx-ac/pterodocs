/**
 * Phrasing content to HTML.
 *
 * The whole run of nodes is converted in one pass, so `mdast-util-to-hast`
 * keeps whatever state it needs, and the conversion happens inside a synthetic
 * paragraph so it does not separate the children with newlines the way it does
 * for a root.
 */

import { toHast } from 'mdast-util-to-hast';
import { toHtml } from 'hast-util-to-html';
import type { PhrasingContent } from 'mdast';
import type { Element, Node as HastNode, Parent as HastParent, RootContent, Text } from 'hast';

/**
 * Escape shortcode brackets inside text, leaving tags and attributes alone.
 *
 * Done on the tree rather than on the serialised string: a `>` inside an
 * attribute value would fool any regex that tries to find tag boundaries.
 * A `raw` node carries the entity through serialisation unescaped.
 */
export function escapeShortcodesInHast(nodes: RootContent[]): RootContent[] {
  const out: RootContent[] = [];
  for (const node of nodes) {
    if (node.type === 'text' && (node as Text).value.includes('[')) {
      const parts = (node as Text).value.split('[');
      parts.forEach((part, index) => {
        if (index > 0) out.push({ type: 'raw', value: '&#91;' } as unknown as RootContent);
        if (part !== '') out.push({ type: 'text', value: part } as Text);
      });
      continue;
    }
    if ('children' in node && Array.isArray((node as HastParent).children)) {
      (node as HastParent).children = escapeShortcodesInHast(
        (node as HastParent).children as RootContent[],
      );
    }
    out.push(node);
  }
  return out;
}

/** Convert phrasing content to the hast nodes that back it. */
export function toInlineHast(nodes: PhrasingContent[]): RootContent[] {
  const paragraph = toHast(
    { type: 'paragraph', children: nodes },
    { allowDangerousHtml: true },
  ) as Element | undefined;
  const children = (paragraph?.children ?? []) as RootContent[];
  return escapeShortcodesInHast(children);
}

/** Serialise hast nodes to HTML. */
export function hastToHtml(nodes: RootContent[] | HastNode): string {
  const tree = Array.isArray(nodes) ? { type: 'root' as const, children: nodes } : nodes;
  return toHtml(tree as never, { allowDangerousHtml: true });
}

/** Render phrasing content to HTML. */
export function renderInline(nodes: PhrasingContent[]): string {
  return hastToHtml(toInlineHast(nodes));
}
