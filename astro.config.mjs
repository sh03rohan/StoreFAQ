// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://storefaq.io',
  // Guide §A2: not optional. Every existing WP URL ends in a slash;
  // without this every backlink costs a 301 hop.
  trailingSlash: 'always',
  build: { format: 'directory' },
  output: 'static',
  adapter: vercel(),
  integrations: [
    mdx(),
    // Static routes only. Blog + categories are SSR and get their own
    // endpoint (guide §B5) so new posts appear without a rebuild.
    sitemap({
      filter: (page) => !/\/(blog|category)\//.test(page),
    }),
  ],
  vite: { plugins: [tailwindcss()] },
});
