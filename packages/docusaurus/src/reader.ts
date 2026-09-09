/**
 * Reading a model out of a real Docusaurus site.
 *
 * The reader interface and the sources that need no Docusaurus live in
 * `src/model`; this is the one that does.
 */

import { loadModel, toSiteModel, type LoadModelOptions } from './model';
import type { LoadedSite } from './server';
import { createMemoryReader, type SourceReader, type SiteModel } from '@pterodocs/core/model';

/** Read from a real Docusaurus site, one locale at a time. */
export function createDocusaurusReader(options: LoadModelOptions): SourceReader {
  let firstLocale: SiteModel | undefined;

  return {
    kind: 'docusaurus',
    async locales(): Promise<string[]> {
      firstLocale ??= await loadModel(options);
      return firstLocale.locales;
    },
    async read(locale?: string): Promise<SiteModel> {
      if (firstLocale && (locale === undefined || locale === firstLocale.locale)) {
        return firstLocale;
      }
      const model = await loadModel({ ...options, locale });
      firstLocale ??= model;
      return model;
    },
  };
}

/** Build a model from a site the caller has already loaded. */
export function readerFromLoadedSite(site: LoadedSite, options: LoadModelOptions): SourceReader {
  return createMemoryReader(toSiteModel(site, options));
}
