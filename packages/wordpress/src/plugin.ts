/**
 * Finding out whether the pterodocs WordPress plugin is installed.
 *
 * The plugin registers one option and exposes it over REST, so asking for the
 * site's settings answers both questions at once: whether it is there, and what
 * it is configured with. That second half matters, because the plugin styles a
 * site by class prefix and a prefix that disagrees with the one pterodocs writes
 * is a setup that looks broken for no visible reason.
 */

import { TargetError } from '@pterodocs/core/util';
import type { WpClient } from './client';

/** What the site said about the plugin. */
export interface PluginStatus {
  /** Whether the plugin answered. */
  installed: boolean;
  /**
   * Why the answer is not known.
   *
   * Set when the site could not be asked — usually because the credentials
   * belong to someone without `manage_options` — rather than when the plugin is
   * known to be absent.
   */
  unknown?: string;
  /** The class prefix the plugin is styling, when it is installed. */
  classPrefix?: string;
}

/** The shape of the site settings this reads. */
interface SiteSettings {
  pterodocs_settings?: { classPrefix?: string };
}

/**
 * Ask a site whether the plugin is installed.
 *
 * Never throws: an unreachable or unauthorised site is a thing to report in a
 * diagnostic, not a reason to fail one.
 *
 * @param client A client for the site.
 */
export async function detectPlugin(client: WpClient): Promise<PluginStatus> {
  try {
    const { data } = await client.request<SiteSettings>('GET', '/settings');
    const settings = data.pterodocs_settings;

    if (!settings) return { installed: false };

    return {
      installed: true,
      ...(settings.classPrefix ? { classPrefix: settings.classPrefix } : {}),
    };
  } catch (error) {
    const status = error instanceof TargetError ? error.status : undefined;

    if (status === 401 || status === 403) {
      return {
        installed: false,
        unknown: 'these credentials may not read the site settings, so the plugin could not be checked',
      };
    }

    return {
      installed: false,
      unknown: error instanceof Error ? error.message : 'the site could not be asked',
    };
  }
}
