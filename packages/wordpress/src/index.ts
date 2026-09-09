/** The WordPress target. */

import { renderNavigationStub } from '@pterodocs/core/render';
import type {
  EnsureRequest,
  EnsureResult,
  MediaRef,
  MediaUpload,
  RemotePage,
  RenderedPage,
  Target,
  TargetCapabilities,
  TargetSession,
} from '@pterodocs/core/target';
import { TargetError, titleCase } from '@pterodocs/core/util';
import { DEFAULT_RETRY, WpClient, type RetryPolicy } from './client';
import { loadMediaIndex, uploadMedia } from './media';
import {
  computePrune,
  createPage,
  diffPage,
  fetchPage,
  fetchPageIndex,
  findPage,
  trashPage,
  updatePage,
  type PageInput,
} from './pages';
import { hrefFor, splitOwnership, type WordpressUrlPolicy } from './url';

/** What WordPress can do. */
export const WORDPRESS_CAPABILITIES: TargetCapabilities = {
  // The navigation block lists children of a page id, so ids must exist first.
  needsIdsBeforeRender: true,
  supportsMedia: true,
  supportsPrune: true,
  supportsHierarchy: true,
  supportsExcerpt: true,
  supportsMeta: true,
  supportsTemplates: true,
  supportsDrafts: true,
};

/** Content a page holds between being created and being rendered. */
const PLACEHOLDER = '<!-- wp:paragraph -->\n<p>Publishing…</p>\n<!-- /wp:paragraph -->';

/** How to reach and shape a WordPress site. */
export interface WordpressTargetOptions {
  /** Site origin. */
  url: string;
  /** Username of the Application Password. */
  user: string;
  /** The Application Password. */
  appPassword: string;
  /** Where the tree hangs and how versions and locales are addressed. */
  policy: WordpressUrlPolicy;
  /** Status applied to every synced page. */
  status: 'publish' | 'draft' | 'private';
  /** Page template slug, or empty for the theme default. */
  template: string;
  /** Polylang language code. */
  lang: string;
  /** Prefix of the slug that identifies uploaded media. */
  mediaSlugPrefix: string;
  /** Send DELETE as POST with an override header. */
  methodOverride: boolean;
  /** Retry policy. */
  retry?: RetryPolicy;
}

/** Injected so the target can be exercised without a network. */
export interface WordpressTargetDeps {
  fetch?: typeof globalThis.fetch;
  sleep?: (ms: number) => Promise<void>;
  log?: (message: string) => void;
}

/** Create the WordPress target. */
export function createWordpressTarget(
  options: WordpressTargetOptions,
  deps: WordpressTargetDeps = {},
): Target {
  const log = deps.log ?? ((): void => {});
  const { stubSegments, rootSlug } = splitOwnership(options.policy);

  // The documentation root has no path of its own in the tree, so its slug is
  // the last segment of the configured path rather than anything the model
  // supplied.
  const slugFor = (page: { path: string; slug: string }): string =>
    page.path === '' ? rootSlug : page.slug;

  const makeClient = (locale: string): WpClient =>
    new WpClient({
      baseUrl: options.url,
      user: options.user,
      appPassword: options.appPassword,
      // A site with one language per subtree wants each subtree tagged.
      lang: options.lang || (options.policy.primaryLocale && locale !== options.policy.primaryLocale ? locale : ''),
      methodOverride: options.methodOverride,
      retry: options.retry ?? DEFAULT_RETRY,
      ...(deps.fetch ? { fetch: deps.fetch } : {}),
      ...(deps.sleep ? { sleep: deps.sleep } : {}),
      log,
    });

  return {
    name: 'wordpress',
    capabilities: WORDPRESS_CAPABILITIES,
    rootPath: hrefFor(options.policy, '', { versionName: '', locale: options.policy.primaryLocale ?? '' }),

    hrefFor(treePath, context) {
      return hrefFor(options.policy, treePath, context);
    },

    async open(context): Promise<TargetSession> {
      const client = makeClient(context.locale);
      const dryRun = context.dryRun;
      let index: RemotePage[] | undefined;

      return {
        async loadIndex(): Promise<RemotePage[]> {
          index ??= await fetchPageIndex(client);
          return index;
        },

        async ensureRootParent(): Promise<{
          id: number | null;
          created: { path: string; id: number | null }[];
        }> {
          const created: { path: string; id: number | null }[] = [];
          let parentId: number | null = 0;

          for (const slug of stubSegments) {
            if (parentId === null) {
              created.push({ path: `/${slug}/`, id: null });
              continue;
            }
            const existing = await findPage(client, parentId, slug, index, log);
            if (existing) {
              if (existing.status === 'trash') {
                throw new TargetError(
                  `The page "/${slug}/" is in the trash. Restore it, or delete it permanently, and run again.`,
                  { status: 409, method: 'GET', url: `/pages?slug=${slug}` },
                );
              }
              parentId = existing.id;
              continue;
            }
            if (dryRun) {
              created.push({ path: `/${slug}/`, id: null });
              parentId = null;
              continue;
            }
            // A page created only so the documentation has a parent: it lists
            // what is below it and claims nothing else.
            const page = await createPage(client, {
              title: titleCase(slug),
              slug,
              parent: parentId,
              status: 'publish',
              content: PLACEHOLDER,
            });
            await updatePage(client, page.id, { content: renderNavigationStub(page.id) });
            created.push({ path: `/${slug}/`, id: page.id });
            parentId = page.id;
          }
          return { id: parentId, created };
        },

        async ensurePage(request: EnsureRequest): Promise<EnsureResult> {
          const warnings: string[] = [];
          if (request.parentId === null) return { id: null, created: true, warnings };

          const slug = request.isRoot ? rootSlug : request.slug;
          const existing = await findPage(client, request.parentId, slug, index, log);
          if (existing) {
            if (existing.status === 'trash') {
              warnings.push(
                `${request.path || '(root)'} matches a page in the trash. It will be republished; restore or delete it permanently if that is not what you want.`,
              );
            }
            return { id: existing.id, created: false, warnings };
          }
          if (dryRun) return { id: null, created: true, warnings };

          // Created as a draft: a placeholder must never appear in navigation.
          const created = await createPage(client, {
            title: request.title,
            slug,
            parent: request.parentId,
            status: 'draft',
            menu_order: request.menuOrder,
            content: PLACEHOLDER,
          });
          return { id: created.id, created: true, warnings };
        },

        async fetchPage(id: number): Promise<RemotePage> {
          return fetchPage(client, id);
        },

        diffPage(remote: RemotePage, rendered: RenderedPage, parentId: number): string[] {
          return diffPage(remote, rendered, {
            parentId,
            status: options.status,
            template: options.template,
            isRoot: rendered.path === '',
            slug: slugFor(rendered),
          });
        },

        async writePage(id, page, parentId): Promise<{ warnings: string[] }> {
          const warnings: string[] = [];
          const body: PageInput = {
            title: page.title,
            content: page.content,
            excerpt: page.excerpt,
            parent: parentId,
            slug: slugFor(page),
            status: options.status,
            menu_order: page.menuOrder,
            template: options.template,
          };
          if (Object.keys(page.meta).length > 0) body.meta = page.meta;

          try {
            await updatePage(client, id, body);
          } catch (error) {
            // A locked-down site may reject the metadata or the template. The
            // page itself matters more than either, so try again without them.
            const status = (error as { status?: number }).status;
            if (status === 400 && (body.meta || body.template)) {
              delete body.meta;
              delete body.template;
              warnings.push(
                `${page.path || '(root)'}: WordPress refused the template or the metadata, so the page was published without them.`,
              );
              await updatePage(client, id, body);
            } else throw error;
          }
          return { warnings };
        },

        async writeMeta(id, meta): Promise<{ warnings: string[] }> {
          if (Object.keys(meta).length === 0) return { warnings: [] };
          if (dryRun) return { warnings: [] };

          try {
            await updatePage(client, id, { meta });
          } catch (error) {
            // Every key here is registered by the pterodocs plugin, so the
            // usual reason to be refused is that it is not installed. That is
            // a fact about the site, not a failure of the publish.
            const status = (error as { status?: number }).status;
            if (status === 400 || status === 403) {
              return {
                warnings: [
                  'WordPress refused the llms.txt metadata. The pterodocs plugin registers it, so this usually means it is not installed or not active.',
                ],
              };
            }
            throw error;
          }

          return { warnings: [] };
        },

        computePrune(pages, rootId, keepIds): RemotePage[] {
          return computePrune(pages, rootId, keepIds);
        },

        async removePage(page: RemotePage): Promise<void> {
          await trashPage(client, page.id);
        },

        async loadMediaIndex(): Promise<Map<string, MediaRef>> {
          return loadMediaIndex(client, options.mediaSlugPrefix);
        },

        async uploadMedia(upload: MediaUpload): Promise<MediaRef> {
          return uploadMedia(client, upload, options.mediaSlugPrefix);
        },

        requestCount(): number {
          return client.requestCount;
        },
      };
    },
  };
}

export { splitOwnership, hrefFor, prefixSegments } from './url';
export type { WordpressUrlPolicy } from './url';
export { WpClient, DEFAULT_RETRY } from './client';
export { detectPlugin } from './plugin';
export type { PluginStatus } from './plugin';
export type { RetryPolicy, WpClientOptions } from './client';
export { renderNavigationStub };
export { PLACEHOLDER };
