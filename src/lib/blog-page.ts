/**
 * The three listing routes — /blog/, /blog/page/N/, /category/<slug>/ — plus
 * a search, share this. It turns a request into the data BlogListing renders,
 * or a Response when the request is not a page: an out-of-range page number
 * is a 404, and `?s=` is a search whose results carry `noindex`.
 */
import type { AstroGlobal } from 'astro';
import { getCategories, getCategory, getPosts, type Page, type PostCategory, type PostSummary } from './wp';
import { routes } from './routes';

export interface Listing {
  page: Page<PostSummary>;
  categories: PostCategory[];
  active?: PostCategory;
  search?: string;
  pageUrl: (n: number) => string;
  /** <title> and description for the head. */
  title: string;
  description?: string;
  robots?: string;
  canonical: string;
}

export async function loadListing(astro: AstroGlobal, opts: { pageNumber?: number; categorySlug?: string }): Promise<Listing | Response> {
  const search = astro.url.searchParams.get('s')?.trim() || undefined;
  const pageNumber = opts.pageNumber ?? (search ? Math.max(1, Number(astro.url.searchParams.get('page')) || 1) : 1);

  const [categories, active] = await Promise.all([
    getCategories(),
    opts.categorySlug ? getCategory(opts.categorySlug) : Promise.resolve(undefined),
  ]);
  if (opts.categorySlug && !active) return new Response(null, { status: 404 });

  const page = await getPosts({ page: pageNumber, category: active?.id, search });
  // WordPress answers 400 for a page past the end; a listing with nothing on
  // it that is not page one is a 404 either way.
  if (pageNumber > 1 && page.items.length === 0) return new Response(null, { status: 404 });

  const base = active ? routes.category(active.slug) : routes.blog();
  const pageUrl = (n: number) => {
    if (search) return `${routes.blogSearch()}?s=${encodeURIComponent(search)}${n > 1 ? `&page=${n}` : ''}`;
    return n <= 1 ? base : active ? `${base}page/${n}/` : routes.blogPage(n);
  };

  const site = astro.site!;
  const canonical = new URL(pageUrl(pageNumber).split('?')[0], site).href;
  const title = search ? `Search results for “${search}” | storefaq.io`
    : active ? `${active.name} Archives | storefaq.io`
    : undefined as unknown as string;   // /blog/ takes its title from seo.ts
  const pagedTitle = title && pageNumber > 1 ? `${title.replace(' | storefaq.io', '')} - Page ${pageNumber} | storefaq.io` : title;

  return {
    page, categories, active: active ?? undefined, search, pageUrl, canonical,
    title: pagedTitle,
    description: active ? `StoreFAQ blog posts filed under ${active.name}.` : undefined,
    robots: search ? 'noindex, follow' : undefined,
  };
}
