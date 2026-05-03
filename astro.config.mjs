// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import challenges from './src/data/challenges.json' with { type: 'json' };

// Inferred from the GitHub remote - set as a custom domain later if you want.
const SITE = 'https://wainejr.github.io';
const BASE = '/acelerado-desafios';

// Build the "Desafios" sidebar group from the discovered challenges. Each
// challenge becomes a collapsible subgroup containing its enunciado,
// optional comece-aqui primer, exemplos and referência (whatever exists).
// Subgroups default collapsed, but Starlight auto-expands the one matching
// the current route.
const desafiosGroup = {
  label: 'Desafios',
  collapsed: false, // parent always open
  items: challenges.map((c) => {
    const items = [
      { label: 'Enunciado', slug: `desafios/${c.slug}` },
    ];
    if (c.hasComeceAqui) {
      items.push({ label: 'Comece aqui', slug: `desafios/${c.slug}/comece-aqui` });
    }
    if (c.hasExample) {
      items.push({ label: 'Exemplos', slug: `desafios/${c.slug}/example` });
    }
    if (c.hasReference) {
      items.push({ label: 'Referência', slug: `desafios/${c.slug}/reference` });
    }
    return {
      // Mirror the title as it appears in the root README's challenge table.
      // The month is already shown in the parent "Desafios" group context.
      label: c.shortTitle,
      collapsed: true, // only auto-opens when current page is inside
      items,
    };
  }),
};

export default defineConfig({
  site: SITE,
  base: BASE,
  trailingSlash: 'ignore',
  integrations: [
    starlight({
      title: 'acelerado-desafios',
      description:
        'Desafios mensais de performance da Comunidade do Desempenho.',
      defaultLocale: 'root',
      locales: {
        root: { label: 'Português (Brasil)', lang: 'pt-BR' },
      },
      social: [
        { icon: 'github',    label: 'GitHub do projeto', href: 'https://github.com/wainejr/acelerado-desafios' },
        { icon: 'discord',   label: 'Discord da comunidade', href: 'https://discord.gg/NNuzYsNPjV' },
        { icon: 'youtube',   label: 'YouTube',  href: 'https://www.youtube.com/@waine_jr' },
        { icon: 'instagram', label: 'Instagram', href: 'https://www.instagram.com/waine_jr/' },
      ],
      customCss: ['./src/styles/terminal.css'],
      logo: { src: './src/assets/logo.svg', replacesTitle: false },
      sidebar: [
        { label: 'Início', link: '/' },
        { label: 'Submissão', link: '/submission/' },
        desafiosGroup,
      ],
      components: {
        // Inject the metric strip on doc pages that opt in via frontmatter.
        PageTitle: './src/components/overrides/PageTitle.astro',
        // Custom terminal-themed footer with community links.
        Footer: './src/components/overrides/Footer.astro',
        // Lock to dark theme: no toggle, no system preference, no storage.
        ThemeProvider: './src/components/overrides/ThemeProvider.astro',
        ThemeSelect: './src/components/overrides/ThemeSelect.astro',
      },
      lastUpdated: false,
      pagination: false,
      tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
      expressiveCode: {
        themes: ['github-dark'],
        styleOverrides: {
          borderColor: 'rgba(214, 216, 222, 0.22)',
          borderRadius: '2px',
          codeFontFamily: "'JetBrains Mono', ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace",
          codeFontSize: '13px',
          codeLineHeight: '1.55',
          codePaddingBlock: '0.95rem',
          codePaddingInline: '1.15rem',
          codeBackground: '#0c0e13',
          frames: {
            shadowColor: 'transparent',
            editorActiveTabIndicatorTopColor: '#7cff5a',
            editorActiveTabBackground: '#11141b',
            editorTabBarBackground: '#0a0c11',
            editorTabBarBorderBottomColor: 'rgba(214, 216, 222, 0.10)',
            terminalBackground: '#0c0e13',
            terminalTitlebarBackground: '#0a0c11',
            terminalTitlebarBorderBottomColor: 'rgba(124, 255, 90, 0.18)',
            terminalTitlebarDotsForeground: 'transparent',
            terminalTitlebarDotsOpacity: '0',
            tooltipSuccessBackground: '#7cff5a',
            tooltipSuccessForeground: '#000',
          },
          uiFontFamily: "'JetBrains Mono', ui-monospace, monospace",
        },
      },
    }),
  ],
});
