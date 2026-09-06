/**
 * Gutenberg block serialisation.
 *
 * WordPress stores post content as HTML annotated with block comments, and the
 * editor re-parses that markup and compares it with what the block's own save
 * function would produce. Everything here therefore follows core's output
 * closely: the attribute encoding, the class names and the whitespace.
 */

/** Attributes a block carries in its opening comment. */
export type BlockAttributes = Record<string, unknown>;

/**
 * Encode block attributes the way WordPress encodes them, so the editor sees
 * markup it would have written itself.
 */
export function serializeAttrs(attributes: BlockAttributes): string {
  return JSON.stringify(attributes)
    .replace(/--/g, '\\u002d\\u002d')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\\"/g, '\\u0022');
}

/**
 * Wrap inner markup in a block comment pair.
 *
 * @param name Block name without the `core/` prefix.
 * @param attributes Omitted from the output when empty.
 * @param inner The block's stored markup.
 */
export function serializeBlock(
  name: string,
  attributes: BlockAttributes | undefined,
  inner: string,
): string {
  const attrs =
    attributes && Object.keys(attributes).length > 0 ? ` ${serializeAttrs(attributes)}` : '';
  return `<!-- wp:${name}${attrs} -->\n${inner}\n<!-- /wp:${name} -->`;
}

/**
 * A dynamic block: it renders on the server and stores no inner markup.
 */
export function serializeVoidBlock(name: string, attributes?: BlockAttributes): string {
  const attrs =
    attributes && Object.keys(attributes).length > 0 ? ` ${serializeAttrs(attributes)}` : '';
  return `<!-- wp:${name}${attrs} /-->`;
}

/** Join sibling blocks the way WordPress does. */
export function joinBlocks(blocks: Array<string | undefined | null>): string {
  return blocks.filter((block): block is string => typeof block === 'string' && block !== '').join('\n\n');
}

/**
 * Escape text destined for a `<code>` element.
 *
 * `[` becomes an entity because WordPress expands shortcodes inside code as
 * happily as anywhere else, and documentation is full of bracketed samples.
 */
export function escapeCode(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\[/g, '&#91;');
}

/** Escape text for use in an HTML text node or attribute value. */
export function escapeText(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\[/g, '&#91;');
}
