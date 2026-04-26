import type * as Preset from '@docusaurus/preset-classic';
import type { Config } from '@docusaurus/types';
import { themes as prismThemes } from 'prism-react-renderer';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';

import { GITHUB_PAGES_URL_PATH } from './constants';

const defaultLocale = 'zh';

const config: Config = {
  title: 'Open Source Insight',
  tagline: 'Open Source Insight',
  favicon: 'img/logo/ant-opensource.png',
  url: 'https://antgroup.github.io',
  baseUrl: `${GITHUB_PAGES_URL_PATH}`,
  organizationName: 'antgroup',
  projectName: 'antoss-landscape',
  deploymentBranch: 'gh-pages',
  trailingSlash: false,
  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale,
    locales: ['zh'],
    localeConfigs: {
      en: {
        htmlLang: "en-GB",
      },
      // You can omit a locale (e.g. fr) if you don't need to override the defaults
      fa: {
        direction: "rtl",
      },
    },
  },

  customFields: {
    ossBaseUrl: 'https://oss.open-digger.cn/',
    pullNumber: process.env.PULL_NUM,
    imagePath: process.env.PULL_NUM ? `/pull_${process.env.PULL_NUM}/img/` : '/img/',
    dashscopeApiKey: process.env.DASHSCOPE_API_KEY || '',
  },

  presets: [
    [
      'classic',
      ({
        docs: false,
        blog: {
          showReadingTime: true,
          blogSidebarTitle: 'Recent Posts',
          remarkPlugins: [remarkMath],
          rehypePlugins: [rehypeKatex],
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      }) satisfies Preset.Options,
    ],
  ],

  stylesheets: [
    {
      href: 'https://cdn.jsdelivr.net/npm/katex@0.13.24/dist/katex.min.css',
      type: 'text/css',
      integrity:
        'sha384-odtC+0UGzzFL/6PNoE8rX/SPcQDXBJ+uRepguP4QkPCm2LBxH3FA3y+fKSiJ+AmM',
      crossorigin: 'anonymous',
    },
    {
      href: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600&display=swap',
      type: 'text/css',
    },
    'src/css/custom.css',
  ],

  plugins: [
    // [
    //   require.resolve("@easyops-cn/docusaurus-search-local"),
    //   {
    //     indexDocs: false,
    //     indexBlog: true,
    //   },
    // ],
    require.resolve("docusaurus-plugin-image-zoom"),
  ],

  themes: ['@docusaurus/theme-mermaid'],
  markdown: {
    mermaid: true,
  },

  themeConfig:
    ({
      colorMode: {
        defaultMode: 'light',
        disableSwitch: true,
        respectPrefersColorScheme: false,
      },
      algolia: null,
      image: 'img/logo/ant-opensource.png',
      navbar: {
        title: 'Open Source Insight',
        logo: {
          alt: 'Logo',
          src: 'img/logo/ant-opensource.png',
          href: '/',
        },
        items: [
          {
            to: '/',
            label: 'Dashboards',
            position: 'left',
          },
          {
            href: 'https://antoss-landscape.my.canva.site/',
            label: 'LLM Landscape',
            position: 'left',
          },
        ],
      },
      docs: {
        sidebar: {
          hideable: true,
        }
      },
      zoom: {
        selector: '.markdown :not(em) > img',
        config: {
          background: {
            light: 'rgb(255, 255, 255)',
          }
        }
      },
      footer: {
        style: 'light',
        links: [
          {
            title: 'Resources',
            items: [
              {
                label: 'Blog',
                to: '/blog',
              },
              {
                label: 'Interactive Landscape',
                to: '/interactive-landscape',
              },
            ],
          },
          {
            title: 'Community',
            items: [
              {
                label: 'GitHub',
                href: 'https://github.com/X-lab2017/llm-oss-landscape',
              },
              {
                label: 'OpenDigger',
                href: 'https://open-digger.cn',
              },
              {
                label: 'OpenRank',
                href: 'https://open-digger.cn/en/docs/user_docs/metrics/openrank',
              },
            ],
          },
          {
            title: 'More',
            items: [
              {
                label: 'Canva Report',
                href: 'https://antoss-landscape.my.canva.site/',
              },
              {
                label: 'Ant Open Source',
                href: 'https://antgroup.github.io',
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} X-lab. Built with Docusaurus.`,
      },
      prism: {
        theme: prismThemes.github,
      },
    }) satisfies Preset.ThemeConfig,
};

export default config;
