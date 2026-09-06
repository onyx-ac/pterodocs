/**
 * The Docusaurus plugin entry point.
 *
 * Optional: the CLI is the primary way to run a sync. This exists so a site
 * that would rather publish as part of its build can add pterodoc to its
 * plugins array instead of running a separate command.
 */

/** Options the plugin accepts in `docusaurus.config`. */
export interface PterodocPluginOptions {
  /** Path to the pterodoc config file; discovered from the site directory when unset. */
  config?: string;
  /** Publish at the end of `docusaurus build`. Off by default: a build should not surprise anyone. */
  runOnBuild?: boolean;
}

/** A minimal shape of the Docusaurus plugin contract, so this file needs no Docusaurus types. */
interface PluginLike {
  name: string;
  allContentLoaded?: (args: { allContent: unknown }) => Promise<void> | void;
  postBuild?: (props: unknown) => Promise<void> | void;
}

/**
 * Create the plugin.
 *
 * @param _context The Docusaurus load context.
 * @param _options Plugin options from `docusaurus.config`.
 */
export default function pterodocPlugin(
  _context: unknown,
  _options: PterodocPluginOptions = {},
): PluginLike {
  return {
    name: 'pterodoc',
  };
}
