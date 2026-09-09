/**
 * The two files an LLM reads instead of the site.
 *
 * `llms.txt` is an index — the title, a summary, and every published page as a
 * link — and `llms-full.txt` is the same index with the whole of each document
 * inlined. Both are described at https://llmstxt.org.
 *
 * Assembled here rather than reused from a Docusaurus plugin, for three
 * reasons that are all about the files describing the site they are served
 * from:
 *
 * - The links have to be the target's URLs. A build-time plugin writes the
 *   Docusaurus site's own, and an index whose every link points somewhere else
 *   is worse than no index.
 * - The selection has to be what was published. pterodocs publishes the
 *   sidebars, locales and versions the configuration names, which is not the
 *   same set as any other plugin's idea of "the docs" — it may include pages
 *   they exclude and exclude pages they include.
 * - It has to work without a build. `pterodocs sync` reads the loaded site
 *   model and never looks at `build/`, which on most runs does not exist.
 *
 * This module is deliberately given plain data rather than the page tree: it
 * describes what a run published, and a run publishes pages, not nodes.
 */

/**
 * Where the target keeps the index.
 *
 * A WordPress name in a package that knows no target, for the same reason
 * `metaDescriptionKey` is one: the key is a contract with the pterodocs
 * WordPress plugin, which registers it and serves what it finds there. A
 * second target would bring its own.
 */
export const LLMS_META_INDEX = '_pterodocs_llms_index';

/** Where the target keeps the full text. */
export const LLMS_META_FULL = '_pterodocs_llms_full';

/** One published page, as the two files need to see it. */
export interface LlmsPage {
  /** Path relative to the documentation root; '' is the root itself. */
  path: string;
  /** Title as published. */
  title: string;
  /** One-line description, or empty when the document had none. */
  description: string;
  /** The page's URL on the target. */
  href: string;
  /** The document as markdown; absent for a page with no source document. */
  markdown?: string | undefined;
}

/** Everything the two files are built from. */
export interface LlmsInput {
  /** Site title, which becomes the heading. */
  title: string;
  /** Site description, which becomes the summary. */
  description: string;
  /** Every published page, in sidebar order, the documentation root first. */
  pages: LlmsPage[];
}

/**
 * How deep a page sits below the documentation root.
 *
 * @param path A tree path.
 * @returns 0 for the root, 1 for its children, and so on.
 */
function depthOf(path: string): number {
  return path === '' ? 0 : path.split('/').length;
}

/**
 * One page as a list item.
 *
 * @param page The page.
 * @param indent How many levels to indent it by.
 */
function itemFor(page: LlmsPage, indent: number): string {
  const description = page.description ? `: ${page.description}` : '';
  return `${'  '.repeat(Math.max(0, indent))}- [${page.title}](${page.href})${description}`;
}

/** The heading and summary both files open with. */
function preamble(input: LlmsInput): string[] {
  const lines = [`# ${input.title}`, ''];
  if (input.description) lines.push(`> ${input.description}`, '');
  return lines;
}

/**
 * Build `llms.txt`: the index.
 *
 * Sections come from the documentation's own top level, so the grouping an
 * LLM sees is the grouping a reader sees in the sidebar. Below that the list
 * nests, because a flat list of fifty links throws away the one thing this
 * tool knows and a crawler does not.
 *
 * @param input The published pages and the site's own title.
 * @returns The file's contents, ending in a newline.
 */
export function renderLlmsIndex(input: LlmsInput): string {
  const lines = preamble(input);

  // The documentation's own front page goes above the sections rather than
  // inside one: it is the "start here" link, it belongs to no branch, and
  // giving it a section of its own would mean a heading that repeats the
  // title immediately above it.
  const root = input.pages.find((page) => page.path === '');
  if (root) lines.push(itemFor(root, 0), '');

  // Group every page under the top-level page it descends from. Insertion
  // order is sidebar order, and Map preserves it.
  const sections = new Map<string, LlmsPage[]>();
  for (const page of input.pages) {
    if (page.path === '') continue;
    const branch = page.path.split('/')[0] as string;
    const pages = sections.get(branch);
    if (pages) pages.push(page);
    else sections.set(branch, [page]);
  }

  for (const pages of sections.values()) {
    // The branch's own page comes first in sidebar order, so its title names
    // the section. A category with no page of its own falls back to its slug.
    const head = pages[0] as LlmsPage;
    const label = depthOf(head.path) === 1 ? head.title : (head.path.split('/')[0] as string);

    // Indent relative to the shallowest page in the section, so a category
    // with no page of its own still starts its list at the margin instead of
    // opening with an item nested under nothing.
    const base = Math.min(...pages.map((page) => depthOf(page.path)));

    lines.push(`## ${label}`, '');
    for (const page of pages) lines.push(itemFor(page, depthOf(page.path) - base));
    lines.push('');
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

/**
 * Build `llms-full.txt`: the index, with every document inlined.
 *
 * Pages are separated by a rule and titled at the top level, so a reader —
 * human or otherwise — can tell where one document ends and the next begins.
 * A page with no source document, such as a generated category index,
 * contributes its title and its link and nothing else, which is all there is
 * to say about it.
 *
 * @param input The published pages, with `markdown` filled in.
 * @returns The file's contents, ending in a newline.
 */
export function renderLlmsFull(input: LlmsInput): string {
  const lines = preamble(input);

  for (const page of input.pages) {
    lines.push('---', '', `# ${page.title}`, '', `Source: ${page.href}`, '');
    if (page.description) lines.push(`> ${page.description}`, '');
    const body = page.markdown?.trim();
    if (body) lines.push(body, '');
  }

  return `${lines.join('\n').trimEnd()}\n`;
}
