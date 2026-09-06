/** Summaries used for excerpts, SEO descriptions and index listings. */

/**
 * Shorten text to at most `max` characters, breaking on a word.
 *
 * @param text The full text.
 * @param max Longest result, before the ellipsis.
 */
export function excerptFrom(text: string, max = 160): string {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  const kept = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${kept.replace(/[\s,;:.]+$/, '')}…`;
}
