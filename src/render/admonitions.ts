/**
 * Docusaurus admonitions.
 *
 * `:::note` and its siblings are container directives. WordPress has no
 * equivalent block, so each becomes a group with stable classes a theme can
 * style, opened by a bold label the way Docusaurus renders one.
 */

import type { ContainerDirective } from 'mdast-util-directive';
import type { RootContent } from 'mdast';
import { toString as mdastToString } from 'mdast-util-to-string';
import { joinBlocks, serializeBlock } from './blocks';
import { renderInline } from './inline';
import type { Theme } from './theme';

/**
 * The keywords Docusaurus recognises when a site configures none.
 *
 * Taken from the docs plugin's own defaults rather than guessed: a site that
 * writes `:::success` gets an admonition on Docusaurus and must get one here.
 */
export const DEFAULT_ADMONITION_KEYWORDS = [
  'secondary',
  'info',
  'success',
  'danger',
  'note',
  'tip',
  'warning',
  'important',
  'caution',
] as const;

/**
 * Render an admonition.
 *
 * @param node The container directive.
 * @param theme Class names and strings.
 * @param renderChild How to render each block inside the admonition.
 */
export function renderAdmonition(
  node: ContainerDirective,
  theme: Theme,
  renderChild: (child: RootContent) => string,
): string {
  const type = String(node.name ?? '').toLowerCase();
  const children = [...(node.children as RootContent[])];

  let label = type.charAt(0).toUpperCase() + type.slice(1);
  const first = children[0] as { data?: { directiveLabel?: boolean } } | undefined;
  if (first?.data?.directiveLabel) {
    label = mdastToString(children[0] as never);
    children.shift();
  }

  const base = theme.cls('admonition');
  const className = `${base} ${base}-${type}`;
  const titleClass = theme.cls('admonition-title');

  const inner = joinBlocks([
    serializeBlock(
      'paragraph',
      { className: titleClass },
      `<p class="${titleClass}"><strong>${renderInline([{ type: 'text', value: label }])}</strong></p>`,
    ),
    ...children.map(renderChild),
  ]);

  return serializeBlock(
    'group',
    { className },
    `<div class="wp-block-group ${className}">${inner}</div>`,
  );
}
