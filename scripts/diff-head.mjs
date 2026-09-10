// Compares the <head> of every built page against the original.
//
// The pixel diffs say nothing about this half of the page, and it is the half
// search engines read. Reports per page: what the original has that this build
// does not, and vice versa.
import { readFileSync } from 'node:fs';
import { parse } from 'node-html-parser';

const PAGES = [
  ['home',           'reference/html/home.html',           'dist/client/index.html'],
  ['features',       'reference/html/features.html',       'dist/client/features/index.html'],
  ['docs',           'reference/html/docs.html',           'dist/client/docs/index.html'],
  ['changelog',      'reference/html/changelog.html',      'dist/client/changelog/index.html'],
  ['privacy-policy', 'reference/html/privacy-policy.html', 'dist/client/privacy-policy/index.html'],
  ['feature-request','reference/html/feature-request.html','dist/client/feature-request/index.html'],
];

/** The head facts that matter, as a flat map, so two pages can be compared. */
const facts = (file) => {
  const root = parse(readFileSync(file, 'utf8'));
  const head = root.querySelector('head');
  const out = new Map();

  const title = head.querySelector('title');
  if (title) out.set('title', title.text.trim());

  for (const m of head.querySelectorAll('meta')) {
    const key = m.getAttribute('name') ?? m.getAttribute('property') ?? m.getAttribute('http-equiv');
    if (!key || key === 'viewport' || key === 'generator') continue;
    out.set(`meta:${key}`, (m.getAttribute('content') ?? '').trim());
  }

  for (const l of head.querySelectorAll('link')) {
    const rel = l.getAttribute('rel');
    if (!rel || /stylesheet|preload|preconnect|dns-prefetch|icon|apple-touch|pingback|EditURI|wlwmanifest|https:\/\/api\.w\.org/.test(rel)) continue;
    /* A page can carry more than one alternate of the same type — /docs/ has
     * both the site feed and its own — so the title is part of the key. Without
     * it the second silently overwrote the first. */
    const key = rel === 'alternate'
      ? `link:alternate:${l.getAttribute('type') ?? ''}:${l.getAttribute('title') ?? ''}`
      : `link:${rel}`;
    out.set(key, (l.getAttribute('href') ?? '').trim());
  }

  const types = [];
  for (const s of head.querySelectorAll('script')) {
    if (s.getAttribute('type') !== 'application/ld+json') continue;
    try {
      const j = JSON.parse(s.rawText);
      for (const node of (j['@graph'] ?? [j])) types.push(node['@type']);
    } catch { types.push('UNPARSEABLE'); }
  }
  if (types.length) out.set('ld+json', types.flat().sort().join(', '));

  return out;
};

const norm = (v) => v.replace(/^https?:\/\/storefaq\.io/, '').replace(/\s+/g, ' ').trim();

/* WordPress plumbing. Dropping it is the point — §B1 keeps WP paths out of the
 * output entirely — so it is listed here rather than reported forever. */
/* Matched by PREFIX, because the alternate keys carry the link's title too —
 * a page can advertise two feeds and exact keys collapsed them into one. */
const DROPPED = [
  'link:alternate:application/json',        // the REST record for the page
  'link:alternate:application/json+oembed',
  'link:alternate:text/xml+oembed',
  'link:shortlink',                         // /?p=91
  'meta:msapplication-TileImage',           // a Windows tile from the WP favicon plugin
];
const isDropped = (k) => DROPPED.some((d) => k === d || k.startsWith(d + ':'));

/* The social image is mirrored into /social/ instead of being hotlinked out of
 * the WordPress uploads directory. Same picture, different origin. */
const MOVED = new Set(['meta:og:image', 'meta:og:image:secure_url', 'meta:twitter:image']);
const sameImage = (a, c) => a.split('/').pop() === c.split('/').pop();

/* §B7: the original's copy on these routes is a WordPress placeholder — see
 * the comments in src/data/seo.ts, which quote what each one replaced. */
const PLACEHOLDER_ROUTES = new Set(['docs', 'privacy-policy', 'feature-request']);
const COPY = new Set(['title', 'meta:description', 'meta:og:title', 'meta:og:description',
  'meta:twitter:title', 'meta:twitter:description']);

let missing = 0;
for (const [name, refFile, mineFile] of PAGES) {
  let r, m;
  try { r = facts(refFile); m = facts(mineFile); }
  catch (e) { console.log(`\n${name}: SKIPPED — ${e.message}`); continue; }

  const keys = [...new Set([...r.keys(), ...m.keys()])].sort();
  const rows = [], accounted = [];
  for (const k of keys) {
    const a = r.get(k), c = m.get(k);
    if (a === undefined) { accounted.push(`${k} (added here)`); continue; }
    if (c === undefined) {
      if (isDropped(k)) { accounted.push(`${k} (WordPress plumbing, dropped)`); continue; }
      rows.push(['-', k, `MISSING here — original has: ${String(a).slice(0, 70)}`]); missing++; continue;
    }
    if (norm(a) === norm(c)) continue;
    if (MOVED.has(k) && sameImage(a, c)) { accounted.push(`${k} (same file, mirrored to /social/)`); continue; }
    if (COPY.has(k) && PLACEHOLDER_ROUTES.has(name)) { accounted.push(`${k} (§B7 placeholder replaced)`); continue; }
    rows.push(['~', k, `ref  ${String(a).slice(0, 66)}\n            mine ${String(c).slice(0, 66)}`]);
    missing++;   // a value that DIFFERS is a difference too — counting only
                 // absent keys made this report 0 while printing 1.
  }
  console.log(`\n=== ${name} ===  ${rows.length ? rows.length + ' UNEXPLAINED' : 'no unexplained differences'}`
    + (accounted.length ? `, ${accounted.length} accounted for` : ''));
  for (const [mark, k, what] of rows) console.log(` ${mark} ${k.padEnd(24)} ${what}`);
  if (process.env.VERBOSE) for (const a of accounted) console.log(`   · ${a}`);
}
console.log(`\n${missing} unexplained head differences.`);
console.log('Run with VERBOSE=1 to list what is accounted for and why.');
if (missing) process.exitCode = 1;
