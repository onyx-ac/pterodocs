/**
 * Where a site model comes from.
 *
 * The rest of the tool takes a reader rather than calling a source directly,
 * which is what lets it be tested against a captured model, driven by a build,
 * or pointed at a real site. The interface lives here, with the model it
 * produces; each source implements it in its own package.
 */

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

/**
 * Read from a model already in hand, which is what a build-time plugin does.
 *
 * @param model The model to serve.
 */
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
