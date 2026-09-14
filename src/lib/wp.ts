/**
 * Guide Phase 6 — the WordPress REST client for the blog.
 *
 * Read at request time (the blog routes are `prerender = false`), so a post
 * published in WordPress is on the site without a rebuild; Vercel ISR holds
 * the rendered page and the CMS purges it on publish (§B6, in the mu-plugin).
 *
 * `WP_URL` is the CMS origin. It defaults to the live site because that is
 * where the content actually is today — the public REST API is open there —
 * and the moment `cms.storefaq.io` exists it is one environment variable.
 *
 * Everything that leaves this module is already clean: bodies through
 * `cleanWpHtml` (§B1), uploads rewritten to `/media/` (the same URL space the
 * mirrored docs images live in — a Vercel rewrite proxies whatever is not on
 * disk), and old root-level post links pointed straight at `/blog/<slug>/`
 * so no reader pays the 301.
 */
import { cleanWpHtml } from './wp-html';
import { routes } from './routes';
import { redirects } from './redirects';

export const WP_URL = (import.meta.env.WP_URL ?? 'https://storefaq.io').replace(/\/$/, '');
const API = `${WP_URL}/wp-json/wp/v2`;

export interface PostImage {
  src: string;
  alt: string;
  width: number;
  height: number;
}

export interface PostCategory {
  id: number;
  slug: string;
  name: string;
}

export interface PostAuthor {
  slug: string;
  name: string;
  avatar?: string;
}

export interface PostSummary {
  id: number;
  slug: string;
  title: string;
  date: string;          // "April 21, 2026"
  dateIso: string;       // "2026-04-21T12:36:05+00:00"
  modifiedIso: string;
  excerpt: string;       // plain text
  image?: PostImage;
  categories: PostCategory[];
  tags: string[];
  author: PostAuthor;
}

export interface Post extends PostSummary {
  content: string;       // sanitised HTML
  seo?: { title?: string; description?: string; ogImage?: string };
}

export interface Page<T> {
  items: T[];
  total: number;
  totalPages: number;
  page: number;
}

export const POSTS_PER_PAGE = 12;

/* ---------- fetch ---------- */

interface Raw {
  id: number;
  slug: string;
  date: string;
  date_gmt: string;
  modified_gmt: string;
  title: { rendered: string };
  excerpt: { rendered: string };
  content?: { rendered: string };
  author: number;
  categories: number[];
  seo?: Post['seo'];
  _embedded?: {
    author?: { slug: string; name: string; avatar_urls?: Record<string, string> }[];
    'wp:featuredmedia'?: {
      source_url: string; alt_text?: string;
      media_details?: { width?: number; height?: number };
    }[];
    'wp:term'?: { id: number; slug: string; name: string; taxonomy: string }[][];
  };
}

async function api<T>(path: string, params: Record<string, string | number | undefined>): Promise<{ data: T; total: number; totalPages: number }> {
  const url = new URL(`${API}/${path}`);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new WpError(`WordPress ${res.status} for ${url.pathname}`, res.status);
  return {
    data: (await res.json()) as T,
    total: Number(res.headers.get('x-wp-total') ?? 0),
    totalPages: Number(res.headers.get('x-wp-totalpages') ?? 0),
  };
}

export class WpError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

/* ---------- mapping ---------- */

const decode = (s: string) => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
  .replace(/&hellip;/g, '…').replace(/&ndash;/g, '–').replace(/&mdash;/g, '—')
  .replace(/&lsquo;/g, '‘').replace(/&rsquo;/g, '’').replace(/&ldquo;/g, '“').replace(/&rdquo;/g, '”');

const text = (html: string) => decode(html.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();

/** "2026-04-21T12:36:05" (site-local, the REST `date`) -> "April 21, 2026". */
const longDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
};

const gmt = (s: string) => s.replace(/(\.\d+)?$/, '') + '+00:00';

/** Uploads (on either host) -> /media/, the mirror's URL space. */
export const mediaPath = (url: string) =>
  url.replace(/^https?:\/\/(?:cms\.)?storefaq\.io\/wp-content\/uploads\//, '/media/');

/** Old root-level post URLs -> /blog/<slug>/ (the A1 restructure). */
const legacy = new Map(redirects.filter((r) => r.status === 301).map((r) => [r.from, r.to]));
const relink = (html: string) => html.replace(/href="(\/[^"#?]*\/)([^"]*)"/g, (whole, path, rest) =>
  legacy.has(path) ? `href="${legacy.get(path)}${rest}"` : whole);

function summary(r: Raw): PostSummary {
  const media = r._embedded?.['wp:featuredmedia']?.[0];
  const author = r._embedded?.author?.[0];
  const terms = (r._embedded?.['wp:term'] ?? []).flat();
  const cats = terms.filter((t) => t.taxonomy === 'category');
  return {
    id: r.id,
    slug: r.slug,
    title: text(r.title.rendered),
    date: longDate(r.date),
    dateIso: gmt(r.date_gmt),
    modifiedIso: gmt(r.modified_gmt),
    excerpt: text(r.excerpt.rendered).replace(/\s*\[…\]$/, '…'),
    image: media?.source_url ? {
      src: mediaPath(media.source_url),
      alt: media.alt_text ?? '',
      width: media.media_details?.width ?? 1280,
      height: media.media_details?.height ?? 720,
    } : undefined,
    categories: cats.map(({ id, slug, name }) => ({ id, slug, name: decode(name) })),
    tags: terms.filter((t) => t.taxonomy === 'post_tag').map((t) => decode(t.name)),
    author: { slug: author?.slug ?? 'storefaq', name: author?.name ?? 'StoreFAQ', avatar: author?.avatar_urls?.['96'] },
  };
}

function full(r: Raw): Post {
  const raw = r.content?.rendered ?? '';
  const content = relink(mediaPath(cleanWpHtml(raw)).replace(/https?:\/\/(?:cms\.)?storefaq\.io\/wp-content\/uploads\//g, '/media/'));
  return { ...summary(r), content, seo: r.seo };
}

/* ---------- queries ---------- */

export interface ListQuery {
  page?: number;
  perPage?: number;
  category?: number;
  search?: string;
}

/** The latest posts WITH their bodies — for the feed. */
export async function getPostsWithContent(n = 10): Promise<Post[]> {
  const { data } = await api<Raw[]>('posts', { per_page: n, _embed: 'author,wp:featuredmedia,wp:term' });
  return data.map(full);
}

export async function getPosts(q: ListQuery = {}): Promise<Page<PostSummary>> {
  const page = q.page ?? 1;
  let res;
  try {
    res = await api<Raw[]>('posts', {
    page, per_page: q.perPage ?? POSTS_PER_PAGE, categories: q.category, search: q.search,
    _embed: 'author,wp:featuredmedia,wp:term',
    _fields: 'id,slug,date,date_gmt,modified_gmt,title,excerpt,author,categories,featured_media,_links,_embedded',
    });
  } catch (e) {
    // WordPress answers 400 (`rest_post_invalid_page_number`) for a page past
    // the end. That is an empty page, which the route turns into a 404.
    if (e instanceof WpError && e.status === 400 && page > 1) return { items: [], total: 0, totalPages: 0, page };
    throw e;
  }
  const { data, total, totalPages } = res;
  return { items: data.map(summary), total, totalPages, page };
}

export async function getPost(slug: string): Promise<Post | null> {
  const { data } = await api<Raw[]>('posts', { slug, _embed: 'author,wp:featuredmedia,wp:term' });
  return data[0] ? full(data[0]) : null;
}

export async function getCategories(): Promise<PostCategory[]> {
  const { data } = await api<{ id: number; slug: string; name: string; count: number }[]>('categories', {
    per_page: 100, hide_empty: 'true', orderby: 'name', _fields: 'id,slug,name,count',
  });
  return data.filter((c) => c.slug !== 'uncategorized').map(({ id, slug, name }) => ({ id, slug, name: decode(name) }));
}

export async function getCategory(slug: string): Promise<PostCategory | null> {
  const { data } = await api<{ id: number; slug: string; name: string }[]>('categories', { slug, _fields: 'id,slug,name' });
  return data[0] ? { id: data[0].id, slug: data[0].slug, name: decode(data[0].name) } : null;
}

/** The three the original's sidebar and "Recent Posts" grid show. */
export const getRecent = (n = 3, exclude?: number) =>
  getPosts({ perPage: n + (exclude ? 1 : 0) }).then((p) => p.items.filter((x) => x.id !== exclude).slice(0, n));

/**
 * Post Views Counter exposes counts publicly; the original's "Popular" tab is
 * the top three by that number. The endpoint takes a list of ids but answers
 * with their SUM, so it is one request per post — cheap, and the page is held
 * by ISR anyway. If the plugin is gone the tab falls back to recency rather
 * than failing the page.
 */
export async function getPopular(n = 3): Promise<PostSummary[]> {
  const all = await getPosts({ perPage: 100 });
  try {
    const views = await Promise.all(all.items.map(async (p) => {
      const res = await fetch(`${WP_URL}/wp-json/post-views-counter/get-post-views/${p.id}`);
      return res.ok ? Number(await res.json()) || 0 : 0;
    }));
    return all.items.map((p, i) => [p, views[i]] as const).sort((a, b) => b[1] - a[1]).slice(0, n).map(([p]) => p);
  } catch {
    return all.items.slice(0, n);
  }
}

export const postUrl = (p: { slug: string }) => routes.post(p.slug);
