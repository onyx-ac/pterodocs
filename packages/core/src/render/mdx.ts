/**
 * Lowering MDX into something a Gutenberg page can hold.
 *
 * MDX is JavaScript, and a WordPress page is not. What can be translated is
 * translated by the component table; the rest is reported with its position
 * rather than dropped, because a page that quietly loses a third of its
 * content is worse than one that tells you it did.
 */

import { visit } from 'unist-util-visit';
import type { Root, RootContent } from 'mdast';
import type { IssueCollector, Severity } from '../util/issues';

/** What lowering learned on the way through. */
export interface MdxLoweringResult {
  /** Bindings from `import X from './y.png'`, so `src={X}` can be resolved. */
  imports: Map<string, string>;
}

/** How to treat content that cannot be translated. */
export type UnknownPolicy = 'report' | 'placeholder' | 'error';

/** Elements that are plain HTML and can be carried through as written. */
const HTML_ELEMENTS = new Set([
  'a', 'abbr', 'b', 'br', 'code', 'div', 'em', 'figcaption', 'figure', 'h1', 'h2', 'h3',
  'h4', 'h5', 'h6', 'hr', 'i', 'img', 'kbd', 'li', 'mark', 'ol', 'p', 'pre', 's', 'samp',
  'small', 'span', 'strong', 'sub', 'sup', 'table', 'tbody', 'td', 'th', 'thead', 'tr',
  'u', 'ul', 'var',
]);

/** Components the renderer knows how to turn into blocks. */
export const KNOWN_COMPONENTS = new Set([
  'Tabs',
  'TabItem',
  'Details',
  'details',
  'summary',
  'CodeBlock',
  'Admonition',
]);

/** A node with a position we can quote from the source. */
interface Positioned {
  type: string;
  position?: { start: { line: number; column: number; offset?: number }; end: { offset?: number } };
}

/** The original text a node was parsed from. */
function sourceOf(node: Positioned, source: string): string {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  return start !== undefined && end !== undefined ? source.slice(start, end) : '';
}

/** Read the import specifiers out of an ESM block, without evaluating it. */
function readImports(value: string, into: Map<string, string>): void {
  const pattern = /import\s+([A-Za-z_$][\w$]*)\s+from\s+['"]([^'"]+)['"]/g;
  for (const match of value.matchAll(pattern)) into.set(match[1]!, match[2]!);
}

/** True for an expression that holds nothing but a comment. */
function isCommentOnly(node: { value?: string; data?: { estree?: { body?: unknown[]; comments?: unknown[] } } }): boolean {
  const estree = node.data?.estree;
  if (estree) return (estree.body?.length ?? 0) === 0 && (estree.comments?.length ?? 0) > 0;
  return /^\s*\/[/*]/.test(node.value ?? '');
}

/**
 * Replace MDX-only nodes so nothing downstream has to know about them.
 *
 * @param root The document, modified in place.
 * @param ctx Where to report, and what to do about the untranslatable.
 */
export function lowerMdx(
  root: Root,
  ctx: {
    source: string;
    file?: string | undefined;
    issues: IssueCollector;
    onUnknown: UnknownPolicy;
  },
): MdxLoweringResult {
  const imports = new Map<string, string>();
  const severity: Severity = ctx.onUnknown === 'error' ? 'error' : 'warning';

  const report = (node: Positioned, message: string, code: string): RootContent | undefined => {
    ctx.issues.add({
      code,
      severity,
      message,
      file: ctx.file,
      line: node.position?.start.line,
      column: node.position?.start.column,
    });
    if (ctx.onUnknown !== 'placeholder') return undefined;
    return { type: 'html', value: `<!-- pterodoc: ${message} -->` } as RootContent;
  };

  const replacements: { parent: { children: RootContent[] }; index: number; with: RootContent | undefined }[] = [];

  visit(root, (node, index, parent) => {
    if (!parent || index === undefined) return;
    const typed = node as Positioned;

    switch (typed.type) {
      case 'mdxjsEsm': {
        readImports((node as { value?: string }).value ?? '', imports);
        replacements.push({ parent: parent as never, index, with: undefined });
        return;
      }

      case 'mdxFlowExpression':
      case 'mdxTextExpression': {
        const expression = node as { value?: string };
        if (isCommentOnly(expression)) {
          replacements.push({ parent: parent as never, index, with: undefined });
          return;
        }
        replacements.push({
          parent: parent as never,
          index,
          with: report(
            typed,
            `An MDX expression ({${(expression.value ?? '').trim().slice(0, 40)}}) has no fixed value outside the site, so it was left out.`,
            'mdx-expression',
          ),
        });
        return;
      }

      case 'mdxJsxTextElement': {
        const element = node as { name?: string | null; children?: RootContent[] };
        const name = element.name ?? '';
        if (name && HTML_ELEMENTS.has(name)) {
          // Plain HTML: keep exactly what the author wrote.
          replacements.push({
            parent: parent as never,
            index,
            with: { type: 'html', value: sourceOf(typed, ctx.source) } as RootContent,
          });
          return;
        }
        if (name === '') {
          // A fragment: keep the children, drop the wrapper.
          return;
        }
        replacements.push({
          parent: parent as never,
          index,
          with: report(
            typed,
            `<${name}> is a React component, which a page cannot run, so it was left out.`,
            'mdx-unknown-component',
          ),
        });
        return;
      }

      default:
        return;
    }
  });

  // Applied afterwards so the walk is not disturbed by its own edits.
  for (const replacement of replacements.reverse()) {
    if (replacement.with) replacement.parent.children.splice(replacement.index, 1, replacement.with);
    else replacement.parent.children.splice(replacement.index, 1);
  }

  return { imports };
}

/** True for an element name pterodoc can translate into blocks. */
export function isTranslatable(name: string): boolean {
  return KNOWN_COMPONENTS.has(name) || HTML_ELEMENTS.has(name);
}

export { HTML_ELEMENTS };
