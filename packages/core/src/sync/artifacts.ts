/**
 * What a run leaves behind.
 *
 * The rendered pages and the plan are how a change is reviewed before it is
 * published, and how a run that failed part way through is diagnosed.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { RenderedPage } from '../target/target';
import type { Plan } from './plan';

/** A page, with where it came from and where it is going. */
export interface ManifestEntry {
  path: string;
  title: string;
  slug: string;
  parent: string | null;
  menuOrder: number;
  locale: string;
  versionName: string;
  file: string | null;
  href: string;
}

/** Everything written to the output directory. */
export interface Artifacts {
  pages: { page: RenderedPage; locale: string; versionName: string }[];
  manifest: ManifestEntry[];
  media: { hash: string; file: string; url: string | null; uploaded: boolean }[];
  plan: Plan;
  /** The stylesheet the pages were rendered against. */
  stylesheet: string;
}

/** Where one page's rendered body is written. */
function pageFile(outDir: string, locale: string, versionName: string, treePath: string): string {
  const parts = [outDir, 'pages', locale, versionName];
  const name = treePath === '' ? 'index.html' : `${treePath}.html`;
  return path.join(...parts, name);
}

/**
 * Write the rendered pages, the manifest, the media map and the plan.
 *
 * Never called from a `finally`: a failure to write the artefacts must not
 * replace the error that actually stopped the run.
 */
export async function writeArtifacts(
  outDir: string,
  artifacts: Artifacts,
  options: { writePages: boolean },
): Promise<void> {
  await fs.mkdir(outDir, { recursive: true });

  // Written whether or not the pages carry it, because the alternative to
  // storing it on every page is pasting it into the site once — and that is a
  // great deal cheaper. A site with fifty pages stores fifty copies otherwise.
  await fs.writeFile(path.join(outDir, 'docs.css'), `${artifacts.stylesheet}
`, 'utf8');

  if (options.writePages) {
    await fs.rm(path.join(outDir, 'pages'), { recursive: true, force: true });
    for (const { page, locale, versionName } of artifacts.pages) {
      const file = pageFile(outDir, locale, versionName, page.path);
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, page.content, 'utf8');
    }
  }

  const write = async (name: string, value: unknown): Promise<void> => {
    await fs.writeFile(path.join(outDir, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  };

  await write('manifest.json', artifacts.manifest);
  await write('media.json', artifacts.media);
  await write('plan.json', artifacts.plan);
}
