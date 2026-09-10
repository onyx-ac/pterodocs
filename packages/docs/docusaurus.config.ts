import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

/**
 * pterodocs's own documentation.
 *
 * Published to WordPress by pterodocs, which is the point: the tool's
 * documentation is the tool's own first user, and anything awkward about
 * publishing a Docusaurus site here is felt before anybody else feels it.
 *
 * `url` and `baseUrl` describe where this is served *on WordPress*, because
 * that is where it is published. pterodocs reads both from here rather than
 * repeating them in its own configuration.
 */
const config: Config = {
  title: 'pterodocs',
  tagline: 'Publish a Docusaurus site to WordPress as core Gutenberg blocks.',

  url: 'https://onyx.ac',
  baseUrl: '/products/pterodocs/docs/',
  favicon: 'img/favicon.svg',

  organizationName: 'onyx-ac',
  projectName: 'pterodocs',

  onBrokenLinks: 'warn',
  onBrokenAnchors: 'warn',

  markdown: { format: 'detect' },

  i18n: { defaultLocale: 'en', locales: ['en'] },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: '/',
          editUrl: 'https://github.com/onyx-ac/pterodocs/tree/main/packages/docs/',
        },
        // Phase 2 turns this on: the release notes become a WordPress custom
        // post type. Until then there is nothing to publish.
        blog: false,
        pages: false,
        theme: { customCss: './src/css/custom.css' },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    navbar: {
      title: 'pterodocs',
      items: [
        { type: 'docSidebar', sidebarId: 'docs', position: 'left', label: 'Documentation' },
        { href: 'https://github.com/onyx-ac/pterodocs', label: 'GitHub', position: 'right' },
      ],
    },
    footer: {
      style: 'dark',
      copyright: `CC-BY-SA-4.0. Built with Docusaurus, published with pterodocs.`,
    },
    prism: {
      additionalLanguages: ['bash', 'json', 'php', 'ini'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
