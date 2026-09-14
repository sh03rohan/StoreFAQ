/**
 * The blog's sitemap — on demand, so a new post is in it without a rebuild
 * (guide §A3, §B5). The static pages' sitemap comes from @astrojs/sitemap
 * at build time; sitemap-index.xml lists both.
 */
export const prerender = false;
import type { APIRoute } from 'astro';
import { getCategories, getPosts } from '../lib/wp';
import { routes } from '../lib/routes';

const esc = (s: string) => s.replace(/&/g, '&amp;');

export const GET: APIRoute = async ({ site }) => {
  const origin = site!.href.replace(/\/$/, '');
  const [posts, categories] = await Promise.all([getPosts({ perPage: 100 }), getCategories()]);
  const urls = [
    { loc: routes.blog(), lastmod: posts.items[0]?.modifiedIso },
    ...posts.items.map((p) => ({ loc: routes.post(p.slug), lastmod: p.modifiedIso })),
    ...categories.map((c) => ({ loc: routes.category(c.slug) })),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${esc(origin + u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
