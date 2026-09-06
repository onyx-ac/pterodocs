/**
 * Where a site model comes from.
 *
 * The rest of the tool takes a reader rather than calling Docusaurus itself,
 * which is what lets it be tested against a captured model, driven by the
 * Docusaurus plugin, or pointed at a real site.
 */

import { loadModel, toSiteModel, type LoadModelOptions } from './model';
import { readCapture } from './capture';
import type { LoadedSite } from './server';
import type { SiteModel } from './types';

/** Supplies one site model per locale. */
export interface SourceReader {
  /** How this reader found the model, for the plan and for messages. */
  readonly kind: 'docusaurus' | 'captured' | 'memory';
  /** Locales this reader can produce, in the order they should be published. */
  locales(): Promise<string[]>;
  /** The model for one locale. */
  read(locale?: string): Promise<SiteModel>;
}

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

/** Read from a model captured earlier. */
export function createCaptureReader(file: string): SourceReader {
  let cached: SiteModel | undefined;
  const load = async (): Promise<SiteModel> => {
    cached ??= await readCapture(file);
    return cached;
  };
  return {
    kind: 'captured',
    async locales(): Promise<string[]> {
      return [(await load()).locale];
    },
    async read(): Promise<SiteModel> {
      return load();
    },
  };
}

/** Read from a model already in hand, which is what the plugin does. */
export function createMemoryReader(model: SiteModel): SourceReader {
  return {
    kind: 'memory',
    async locales(): Promise<string[]> {
      return [model.locale];
    },
    async read(): Promise<SiteModel> {
      return model;
    },
  };
}

/** Build a model from a site the caller has already loaded. */
export function readerFromLoadedSite(site: LoadedSite, options: LoadModelOptions): SourceReader {
  return createMemoryReader(toSiteModel(site, options));
}
