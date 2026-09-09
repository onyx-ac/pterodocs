/**
 * Renders the markdown fixtures.
 *
 * Shared by the golden test and by `scripts/write-fixtures.ts`, so the file
 * that checks the output and the file that writes it cannot drift apart.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderDoc, type RenderedDoc } from '../../src/render/index';
import { createTheme } from '../../src/render/theme';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Fixtures that have a golden file, and the options they render with. */
export const FIXTURES = ['sample', 'fixes', 'sample.mdx'] as const;

/** Render one fixture the way the golden was produced. */
export function renderFixture(name: (typeof FIXTURES)[number]): RenderedDoc {
  const file = name.endsWith('.mdx') ? name : `${name}.md`;
  const markdown = fs.readFileSync(path.join(here, file), 'utf8');
  return renderDoc({
    markdown,
    file,
    permalink: `/docstack/docs/${name}`,
    // The DocStack prefix, so the output can be compared with the tool this
    // package was extracted from — which did not highlight, so neither does
    // this. These goldens exist to prove that parity has not moved; what
    // highlighting emits is covered by its own tests.
    theme: createTheme({ classPrefix: 'docstack', highlight: false }),
    resolveLink: (href) =>
      href === './other.md' ? { href: '/docstack/docs/other/', path: 'other' } : { href },
  });
}

/** Path of a fixture's golden file. */
export function goldenPath(name: (typeof FIXTURES)[number]): string {
  return path.join(here, `${name.replace(/\.mdx$/, '.mdx')}.expected.html`);
}
