/**
 * The Docusaurus plugin.
 *
 * Optional: the command line is the usual way to publish. This exists for a
 * site that would rather publish as part of its build, and it costs nothing
 * extra, because a build has already loaded everything the model needs.
 */

import { toSiteModel } from '../docusaurus/model';
import type { LoadedSite } from '../docusaurus/server';
import { createMemoryReader } from '../docusaurus/reader';
import { loadConfig } from '../config/load';
import { createWordpressTarget } from '../target/wordpress/index';
import { runSync } from '../sync/run';

/** Options the plugin accepts in `docusaurus.config`. */
export interface PterodocPluginOptions {
  /** Path to the pterodoc config; discovered beside the site when unset. */
  config?: string;
  /**
   * Publish at the end of `docusaurus build`.
   *
   * Off by default: building a site should not also change another one.
   */
  runOnBuild?: boolean;
  /** Plan and render without writing, even when `runOnBuild` is set. */
  dryRun?: boolean;
}

/** The part of the Docusaurus plugin contract this uses. */
interface PluginLike {
  name: string;
  postBuild?: (props: LoadedSite['props']) => Promise<void>;
}

/** The part of the Docusaurus context this reads. */
interface ContextLike {
  siteDir: string;
}

/**
 * Create the plugin.
 *
 * @param context The Docusaurus load context.
 * @param options Plugin options from `docusaurus.config`.
 */
export default function pterodocPlugin(
  context: ContextLike,
  options: PterodocPluginOptions = {},
): PluginLike {
  return {
    name: 'pterodoc',

    async postBuild(props): Promise<void> {
      if (options.runOnBuild !== true) return;

      const config = await loadConfig({
        siteDir: context.siteDir,
        config: options.config,
        dryRun: options.dryRun,
      });

      // The build has already run every plugin's content lifecycle, so the
      // model is right here; there is nothing to load a second time.
      const model = toSiteModel({ props }, {
        siteDir: props.siteDir,
        instances: config.instances,
        versions: config.versions,
        includeDrafts: config.includeDrafts,
      });

      const target = createWordpressTarget({
        url: config.targetUrl,
        user: config.user,
        appPassword: config.appPassword,
        policy: { rootSegments: config.rootSegments, baseSegments: config.baseSegments },
        status: config.status,
        template: config.template,
        lang: config.lang,
        mediaSlugPrefix: config.mediaSlugPrefix,
        methodOverride: config.methodOverride,
        retry: config.retry,
      });

      const { plan } = await runSync(config, {
        reader: createMemoryReader(model),
        target,
        renderOnly: config.offline,
      });

      const counts = Object.entries(plan.summary)
        .map(([op, count]) => `${count} ${op}`)
        .join(', ');
      process.stdout.write(`[pterodoc] ${counts || 'nothing to do'}\n`);
      for (const issue of plan.issues.filter((entry) => entry.severity !== 'info')) {
        process.stdout.write(`[pterodoc] ${issue.severity}: ${issue.message}\n`);
      }
    },
  };
}
