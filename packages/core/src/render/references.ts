/**
 * Reference-style links and images.
 *
 * `[text][ref]` with a `[ref]: ./target.md` definition elsewhere only works if
 * something joins the two. Doing it here, as a pre-pass over the whole
 * document, means the rest of the renderer never sees a reference node and the
 * definitions never reach the page as visible text.
 */

import { visit } from 'unist-util-visit';
import type { Definition, Image, Link, Root, RootContent } from 'mdast';

/**
 * Turn resolvable references into ordinary links and images, and remove the
 * definitions that backed them.
 *
 * An unresolvable reference is left alone: CommonMark says it renders as the
 * literal text that was typed, which is what the HTML conversion then does.
 *
 * @param root The document, modified in place.
 */
export function resolveReferences(root: Root): void {
  const definitions = new Map<string, Definition>();
  visit(root, 'definition', (node: Definition) => {
    if (!definitions.has(node.identifier)) definitions.set(node.identifier, node);
  });

  visit(root, (node, index, parent) => {
    if (!parent || index === undefined) return;
    if (node.type !== 'linkReference' && node.type !== 'imageReference') return;

    // A reference with no definition never reaches here: CommonMark says it is
    // not a link at all, so the parser has already turned it into plain text.
    const definition = definitions.get(node.identifier);
    if (!definition) return;

    const replacement: Link | Image =
      node.type === 'linkReference'
        ? {
            type: 'link',
            url: definition.url,
            ...(definition.title != null ? { title: definition.title } : {}),
            children: node.children,
            ...(node.position ? { position: node.position } : {}),
          }
        : {
            type: 'image',
            url: definition.url,
            ...(definition.title != null ? { title: definition.title } : {}),
            alt: node.alt ?? '',
            ...(node.position ? { position: node.position } : {}),
          };

    (parent.children as RootContent[])[index] = replacement;
  });

  // Definitions carry no visible content; leaving them in would print them.
  removeDefinitions(root);
}

/** Drop every definition node, at any depth. */
function removeDefinitions(root: Root): void {
  const prune = (node: { children?: RootContent[] }): void => {
    if (!Array.isArray(node.children)) return;
    node.children = node.children.filter((child) => child.type !== 'definition');
    for (const child of node.children) prune(child as { children?: RootContent[] });
  };
  prune(root as unknown as { children?: RootContent[] });
}
