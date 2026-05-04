// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import challenges from './src/data/challenges.json' with { type: 'json' };

// Inferred from the GitHub remote - set as a custom domain later if you want.
const SITE = 'https://wainejr.github.io';
const BASE = '/acelerado-desafios';

// Each challenge is a top-level collapsible group containing its
// subpages (Problema, optional Comece aqui, Exemplos, Referência).
// A non-interactive "Desafios" row sits above them as a section
// separator. Starlight auto-opens the group matching the current route.
const challengeGroups = challenges.map((c) => {
  const items = [
    { label: 'Problema', slug: `desafios/${c.slug}` },
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
    label: `${c.month} - ${c.shortTitle}`,
    collapsed: true,
    items,
  };
});

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
      favicon: '/favicon.svg',
      customCss: ['./src/styles/terminal.css'],
      // Inline critical sidebar-separator rules in <head> so the
      // "Desafios" row never flashes its default link styling before
      // the bundled customCss link is parsed.
      head: [
        {
          tag: 'style',
          content:
            '.sidebar a[data-separator],' +
            '.sidebar-pane a[data-separator]{' +
            'pointer-events:none;cursor:default;' +
            'font-size:15px!important;font-weight:700!important;' +
            'text-transform:uppercase;letter-spacing:0.14em;' +
            'color:#f4f5f7!important;margin-top:1.1rem;' +
            'background:transparent!important;border-inline-start:0!important}' +
            '.sidebar a[data-separator]::before,' +
            '.sidebar-pane a[data-separator]::before{' +
            'content:"##";color:#7cff5a;padding-right:0.5em;font-weight:400}' +
            // Top-level challenge groups: click navigates (see script
            // below), so hide the toggle caret since it's misleading.
            '.sidebar ul.top-level>li>details>summary .caret,' +
            '.sidebar-pane ul.top-level>li>details>summary .caret{display:none!important}',
        },
        {
          // Intercept clicks on top-level challenge summaries: navigate
          // to the first child link (the Problema page) instead of just
          // toggling the <details>. Starlight auto-expands the matching
          // group on the new page, so the subpages become visible
          // automatically. Delegated on document so it survives any
          // sidebar re-render.
          tag: 'script',
          content:
            '(function(){document.addEventListener("click",function(e){' +
            'var s=e.target.closest(".sidebar details>summary,.sidebar-pane details>summary");' +
            'if(!s)return;' +
            'var li=s.parentElement&&s.parentElement.parentElement;' +
            'if(!li||!li.parentElement||!li.parentElement.classList.contains("top-level"))return;' +
            'var a=s.parentElement.querySelector("ul a[href]");' +
            'if(!a)return;' +
            'e.preventDefault();' +
            'if(a.href!==window.location.href)window.location.href=a.href;' +
            '});})();',
        },
        {
          // Force every <details> ancestor of the current page link to
          // be open. Starlight auto-expands on first render, but the
          // state can drift (manual toggle, view transitions, browser
          // restoration). Re-running on DOMContentLoaded and on Astro
          // page transitions keeps the tree consistent with the URL.
          tag: 'script',
          content:
            '(function(){function sync(){' +
            'var c=document.querySelector(".sidebar [aria-current=\\"page\\"],.sidebar-pane [aria-current=\\"page\\"]");' +
            'if(!c)return;' +
            'for(var n=c.parentElement;n;n=n.parentElement){' +
            'if(n.tagName==="DETAILS")n.open=true;' +
            '}}' +
            'document.addEventListener("DOMContentLoaded",sync);' +
            'document.addEventListener("astro:page-load",sync);' +
            'sync();' +
            '})();',
        },
      ],
      logo: { src: './src/assets/logo.svg', replacesTitle: false },
      sidebar: [
        { label: 'Início', link: '/' },
        { label: 'Submissão', link: '/submission/' },
        // Section separator - rendered as a link by Starlight, but
        // [data-separator] in CSS strips its interactivity and styles
        // it as a fixed section header.
        {
          label: 'Desafios',
          link: '#',
          attrs: { 'data-separator': 'true', tabindex: '-1', 'aria-hidden': 'true' },
        },
        ...challengeGroups,
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
