const {themes} = require('prism-react-renderer');
const site = require('./site.config');

const siteUrl = new URL(process.env.SITE_URL || 'http://localhost:3000/');
const repoUrl = 'https://github.com/' + site.githubRepo;

/** @type {import('@docusaurus/types').Config} */
module.exports = {
  title: 'Forge',
  tagline: 'An AI engineer that lives on your Android phone',
  favicon: 'img/logo.svg',
  url: siteUrl.origin,
  baseUrl: siteUrl.pathname.replace(/\/?$/, '/'),
  trailingSlash: false,
  onBrokenLinks: 'throw',
  markdown: {format: 'detect', hooks: {onBrokenMarkdownLinks: 'throw'}},
  i18n: {defaultLocale: 'en', locales: ['en']},
  customFields: {playStoreUrl: site.playStoreUrl, repoUrl},
  presets: [
    [
      'classic',
      {
        docs: {sidebarPath: require.resolve('./sidebars.js'), editUrl: undefined},
        blog: false,
        theme: {customCss: require.resolve('./src/css/custom.css')},
      },
    ],
  ],
  themeConfig: {
    image: 'img/shots/chat-result.jpg',
    colorMode: {defaultMode: 'dark', respectPrefersColorScheme: false},
    navbar: {
      title: 'FORGE',
      logo: {alt: 'Forge', src: 'img/logo.svg'},
      items: [
        {to: '/docs', label: 'Docs', position: 'left'},
        {to: '/changelog', label: 'Changelog', position: 'left'},
        {to: '/privacy', label: 'Privacy', position: 'left'},
        {href: site.playStoreUrl, label: 'Google Play', position: 'right'},
        {href: repoUrl, label: 'GitHub', position: 'right'},
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {title: 'Docs', items: [
          {label: 'Getting started', to: '/docs/getting-started'},
          {label: 'Models and providers', to: '/docs/models'},
          {label: 'Linux environment', to: '/docs/linux'},
          {label: 'Troubleshooting', to: '/docs/troubleshooting'},
        ]},
        {title: 'Project', items: [
          {label: 'GitHub', href: repoUrl},
          {label: 'Report an issue', href: repoUrl + '/issues'},
          {label: 'Changelog', to: '/changelog'},
          {label: 'Building and publishing', to: '/docs/publishing'},
        ]},
        {title: 'Legal', items: [
          {label: 'Privacy policy', to: '/privacy'},
          {label: 'Open source licenses', href: repoUrl + '/blob/main/third_party/PROOT-NOTICE.md'},
        ]},
      ],
      copyright: 'Forge is open source. Google Play and the Google Play logo are trademarks of Google LLC.',
    },
    prism: {theme: themes.github, darkTheme: themes.dracula, additionalLanguages: ['bash', 'properties']},
  },
};
