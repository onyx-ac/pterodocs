import type { Config } from '@docusaurus/types';

/**
 * A minimal but real Docusaurus site.
 *
 * It exists so one test loads pterodoc's model through Docusaurus itself,
 * which is the part of this tool that no captured fixture can prove.
 */
const config: Config = {
  title: 'Fixture Site',
  url: 'https://fixture.test',
  baseUrl: '/base/',
  onBrokenLinks: 'ignore',
  onBrokenMarkdownLinks: 'ignore',
  markdown: { format: 'detect' },
  i18n: { defaultLocale: 'en', locales: ['en'] },
  presets: [
    [
      'classic',
      {
        docs: { sidebarPath: './sidebars.ts', routeBasePath: 'documentation' },
        blog: false,
        pages: false,
        theme: {},
      },
    ],
  ],
};

export default config;
