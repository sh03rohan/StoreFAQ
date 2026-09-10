// Pulls each page's <head> SEO facts out of the captures into src/data/seo.ts.
//
// These are what rank. Writing my own titles and descriptions instead — which
// is what the first pass of Phase 5 did — silently replaced the live ones on
// every page, and no pixel diff can see it. Generated, so the source of every
// string is the capture.
//
// Three pages carry a WordPress placeholder rather than authored copy. Those
// are overridden here, deliberately and visibly (§B7).
import { readFileSync, writeFileSync } from 'node:fs';
import { parse } from 'node-html-parser';

const PAGES = [
  ['/',                 'home'],
  ['/features/',        'features'],
  ['/docs/',            'docs'],
  ['/changelog/',       'changelog'],
  ['/privacy-policy/',  'privacy-policy'],
  ['/feature-request/', 'feature-request'],
];

/* The original's own copy is an auto-generated placeholder on these three: a
 * WordPress default, or the first 160 characters of the body truncated
 * mid-sentence. Replaced, and the original is kept alongside so the change is
 * auditable rather than invisible. */
const OVERRIDES = {
  '/docs/': {
    title: 'StoreFAQ Docs: Setup Guides and Feature Walkthroughs',
    description: 'Set up StoreFAQ and get the most out of it — installation, FAQ groups, AI-generated questions, layouts and FAQ schema, step by step.',
    why: 'the original is the WordPress default "Add new doc from here"',
  },
  '/privacy-policy/': {
    title: 'Privacy Policy - StoreFAQ',
    description: 'What StoreFAQ collects when you install and use the app for your Shopify store, how it is used, and the rights you have over it.',
    why: 'the original is the first 160 characters of the body, cut mid-sentence',
  },
  '/feature-request/': {
    title: 'Feature Request - StoreFAQ',
    description: 'Cannot find your favourite feature in StoreFAQ? Tell us what you would like us to build next.',
    why: 'the original is the first 160 characters of the body, cut mid-sentence',
  },
};

/** Width/height + mime from a PNG or JPEG header. Returns null if unreadable. */
const imageSize = (file) => {
  let buf;
  try { buf = readFileSync(file); } catch { return null; }
  if (buf.length > 24 && buf.toString('hex', 0, 8) === '89504e470d0a1a0a') {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), type: 'image/png' };
  }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      // SOF0..SOF15, excluding the DHT/JPG/DAC markers at C4, C8, CC
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7), type: 'image/jpeg' };
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  return null;
};

const entries = [];
for (const [route, file] of PAGES) {
  const head = parse(readFileSync(`reference/html/${file}.html`, 'utf8')).querySelector('head');
  const meta = (sel, attr = 'content') => head.querySelector(sel)?.getAttribute(attr) ?? null;

  const original = {
    title: head.querySelector('title').text.trim(),
    description: meta('meta[name=description]'),
  };
  const ogImage = meta('meta[property="og:image"]');
  const keywords = meta('meta[name=keywords]');
  const ogImageAlt = meta('meta[property="og:image:alt"]');
  /* A page can advertise more than one feed: /docs/ carries the site's AND its
   * own. Taking the first silently dropped the specific one. */
  const feeds = head.querySelectorAll('link[rel=alternate]')
    .filter((l) => l.getAttribute('type') === 'application/rss+xml')
    .map((l) => ({ title: l.getAttribute('title') ?? '', href: new URL(l.getAttribute('href')).pathname }));

  /* Social cards render faster and more reliably when the dimensions are
   * declared. The original only states them on the home page, so they are read
   * off the mirrored files instead — a PNG/JPEG header parse, rather than a
   * dependency for twelve bytes. */
  const dims = ogImage ? imageSize(`public/social/${ogImage.split('/').pop()}`) : null;

  /* The WebPage / CollectionPage node, minus anything that points back at
   * WordPress. `potentialAction` is dropped with it — it advertises
   * `/?s={term}`, a search endpoint this build does not have, and pointing
   * crawlers at a 404 is worse than saying nothing. */
  let schema = null;
  for (const s of head.querySelectorAll('script')) {
    if (s.getAttribute('type') !== 'application/ld+json') continue;
    let j; try { j = JSON.parse(s.rawText); } catch { continue; }
    for (const node of (j['@graph'] ?? [j])) {
      if (node['@type'] === 'WebPage' || node['@type'] === 'CollectionPage') {
        schema = { type: node['@type'], name: node.name,
          datePublished: node.datePublished ?? null, dateModified: node.dateModified ?? null,
          image: node.image ?? null };
      }
    }
  }

  const o = OVERRIDES[route];
  entries.push({ route, ...original, ogImage, dims, keywords, ogImageAlt, feeds, schema, override: o ?? null });
}

const q = (v) => v === null || v === undefined ? 'null' : JSON.stringify(v);
const body = entries.map((e) => {
  const lines = [`  {`, `    route: ${q(e.route)},`];
  if (e.override) {
    lines.push(`    /* §B7: ${e.override.why}.`);
    lines.push(`     * Original title:       ${e.title}`);
    lines.push(`     * Original description: ${e.description}`);
    lines.push(`     */`);
    lines.push(`    title: ${q(e.override.title)},`);
    lines.push(`    description: ${q(e.override.description)},`);
    lines.push(`    replacedPlaceholder: true,`);
  } else {
    lines.push(`    title: ${q(e.title)},`);
    lines.push(`    description: ${q(e.description)},`);
  }
  lines.push(`    ogImage: ${q(e.ogImage)},`);
  lines.push(e.dims
    ? `    ogImageSize: { width: ${e.dims.width}, height: ${e.dims.height}, type: ${q(e.dims.type)} },`
    : `    ogImageSize: null,`);
  if (e.keywords) lines.push(`    keywords: ${q(e.keywords)},`);
  if (e.ogImageAlt) lines.push(`    ogImageAlt: ${q(e.ogImageAlt)},`);
  lines.push(`    feeds: [${e.feeds.map((f) => `{ title: ${q(f.title)}, href: ${q(f.href)} }`).join(', ')}],`);
  lines.push(e.schema
    ? `    schema: { type: ${q(e.schema.type)}, name: ${q(e.schema.name)}, datePublished: ${q(e.schema.datePublished)}, dateModified: ${q(e.schema.dateModified)}, image: ${q(e.schema.image)} },`
    : `    schema: null,`);
  lines.push(`  },`);
  return lines.join('\n');
}).join('\n');

writeFileSync('src/data/seo.ts', `/**
 * Per-route <head> facts, generated by scripts/extract-seo.mjs from the
 * captured pages.
 *
 * These are what rank, and no pixel diff can see them — the first pass of
 * Phase 5 replaced every one of them with copy I wrote, which would have
 * changed the title and description of every page on the site at launch.
 *
 * \`ogImage\` is the original's URL; the file itself is mirrored into
 * /social/ so nothing is hotlinked from WordPress. Three routes carry an
 * override: the original is a WordPress placeholder, and the string it
 * replaces is kept in the comment above it.
 */
export interface PageSchema {
  type: 'WebPage' | 'CollectionPage';
  name: string;
  datePublished: string | null;
  dateModified: string | null;
  image: string | null;
}

export interface OgImageSize {
  width: number;
  height: number;
  type: string;
}

export interface PageSeo {
  route: string;
  title: string;
  description: string;
  ogImage: string | null;
  ogImageSize: OgImageSize | null;
  /** The original's own keywords meta, where the page has one. */
  keywords?: string;
  ogImageAlt?: string;
  /** Feeds the page advertises. /docs/ carries the site's and its own. */
  feeds: { title: string; href: string }[];
  schema: PageSchema | null;
  replacedPlaceholder?: boolean;
}

export const pageSeo: PageSeo[] = [
${body}
];

export const seoFor = (route: string): PageSeo | undefined =>
  pageSeo.find((p) => p.route === route);
`);

/* Every /social/ path the generated file will emit must actually be a file.
 * The home page's schema image was a different upload from its og:image, and
 * pointing structured data at a 404 is worse than omitting it. */
const referenced = new Set();
for (const e of entries) {
  if (e.ogImage) referenced.add(e.ogImage.split('/').pop());
  if (e.schema?.image) referenced.add(e.schema.image.split('/').pop());
}
const absent = [...referenced].filter((f) => { try { readFileSync(`public/social/${f}`); return false; } catch { return true; } });

console.log(`${entries.length} routes -> src/data/seo.ts`);
for (const e of entries) {
  console.log(`  ${e.route.padEnd(20)} ${e.override ? 'OVERRIDDEN ' : 'as authored'}  schema=${(e.schema?.type ?? 'none').padEnd(14)} og=${(e.dims ? e.dims.width + 'x' + e.dims.height : 'none').padEnd(9)} keywords=${e.keywords ? 'yes' : 'no'}`);
}

if (absent.length) {
  console.log('\nERROR: referenced but not mirrored into public/social/:');
  for (const f of absent) console.log('  ' + f);
  console.log('Download them, then re-run.');
  process.exitCode = 1;
} else {
  console.log(`\nall ${referenced.size} referenced social images present in public/social/`);
}
