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
    'src/css/custom.css',
  ],

  plugins: [
    [
      require.resolve("@easyops-cn/docusaurus-search-local"),
      {
        indexDocs: false,
        indexBlog: true,
      },
    ],
    require.resolve("docusaurus-plugin-image-zoom"),
  ],

  themes: ['@docusaurus/theme-mermaid'],
  markdown: {
    mermaid: true,
  },

  themeConfig:
    ({
      image: 'img/logo/ant-opensource.png',
      navbar: {
        title: '',
        logo: {
          alt: 'Logo',
          src: 'img/logo/ant-opensource.png',
          href: '/index',
        },
        hideOnScroll: true,
        items: [
          {
            to: '/index',
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
            dark: 'rgb(50, 50, 50)'
          }
        }
      },
      // footer: {
      //   style: 'dark',
      //   copyright: `Copyright © ${new Date().getFullYear()} X-lab<br>
      //     <a href="https://beian.miit.gov.cn/" target="_blank">浙ICP备18048778号-4</a>`,
      // },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
      },
    }) satisfies Preset.ThemeConfig,
};

export default config;
