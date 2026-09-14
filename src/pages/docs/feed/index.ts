/**
 * /docs/feed/ — the docs feed WordPress advertised on /docs/. The docs live
 * in the repo now, so this is built with the site.
 */
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { routes } from '../../../lib/routes';
import { rss, feedHeaders } from '../../../lib/rss';

export const GET: APIRoute = async ({ site }) => {
  const origin = site!.href.replace(/\/$/, '');
  const docs = (await getCollection('docs'))
    .sort((a, b) => (a.data.published < b.data.published ? 1 : -1))
    .slice(0, 10);
  const body = rss({
    title: 'Docs – storefaq.io',
    self: `${origin}${routes.docs()}feed/`,
    site: origin,
    items: docs.map((d) => ({
      title: d.data.title,
      link: `${origin}${routes.doc(d.data.slug)}`,
      date: d.data.published,
      categories: [d.data.categoryName],
      description: d.data.excerpt,
    })),
  });
  return new Response(body, { headers: feedHeaders });
};
