/**
 * RSS 2.0, the shape WordPress emits — content:encoded, dc:creator, a
 * category per term — so anything already subscribed to /feed/ keeps
 * parsing it. Written by hand: it is forty lines, and the one thing a feed
 * must get right is escaping.
 */
export interface FeedItem {
  title: string;
  link: string;
  date: string;          // ISO
  author?: string;
  categories?: string[];
  description?: string;  // plain text
  content?: string;      // HTML
  guid?: string;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const cdata = (s: string) => `<![CDATA[${s.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;
const rfc822 = (iso: string) => new Date(iso).toUTCString().replace('GMT', '+0000');

export function rss(opts: { title: string; self: string; site: string; description?: string; items: FeedItem[] }): string {
  const last = opts.items[0]?.date ? rfc822(opts.items[0].date) : rfc822(new Date().toISOString());
  const items = opts.items.map((i) => `    <item>
      <title>${esc(i.title)}</title>
      <link>${esc(i.link)}</link>
      ${i.author ? `<dc:creator>${cdata(i.author)}</dc:creator>` : ''}
      <pubDate>${rfc822(i.date)}</pubDate>
      ${(i.categories ?? []).map((c) => `<category>${cdata(c)}</category>`).join('\n      ')}
      <guid isPermaLink="${i.guid ? 'false' : 'true'}">${esc(i.guid ?? i.link)}</guid>
      ${i.description ? `<description>${cdata(i.description)}</description>` : ''}
      ${i.content ? `<content:encoded>${cdata(i.content)}</content:encoded>` : ''}
    </item>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(opts.title)}</title>
    <atom:link href="${esc(opts.self)}" rel="self" type="application/rss+xml" />
    <link>${esc(opts.site)}</link>
    <description>${esc(opts.description ?? '')}</description>
    <lastBuildDate>${last}</lastBuildDate>
    <language>en-US</language>
${items}
  </channel>
</rss>
`;
}

export const feedHeaders = { 'Content-Type': 'application/rss+xml; charset=utf-8' };
