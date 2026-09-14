/**
 * /feed/ — the site feed, the same path WordPress served it at (guide §A3).
 * On demand, so it carries a post the moment it is published; ISR holds it
 * like the pages. Bodies are the sanitised ones, with absolute URLs.
 */
export const prerender = false;
import type { APIRoute } from 'astro';
import { getPostsWithContent } from '../../lib/wp';
import { routes } from '../../lib/routes';
import { rss, feedHeaders } from '../../lib/rss';

export const GET: APIRoute = async ({ site }) => {
  const origin = site!.href.replace(/\/$/, '');
  const absolute = (html: string) => html.replace(/(src|href)="\//g, `$1="${origin}/`);
  const posts = await getPostsWithContent(10);
  const body = rss({
    title: 'storefaq.io',
    self: `${origin}${routes.feed()}`,
    site: origin,
    items: posts.map((p) => ({
      title: p.title,
      link: `${origin}${routes.post(p.slug)}`,
      date: p.dateIso,
      author: p.author.name,
      categories: [...p.categories.map((c) => c.name), ...p.tags],
      description: p.excerpt,
      content: absolute(p.content),
      guid: `${origin}/?p=${p.id}`,
    })),
  });
  return new Response(body, { headers: feedHeaders });
};
