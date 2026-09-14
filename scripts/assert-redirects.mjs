// Replays every URL WordPress serves against the BUILT Vercel routing table.
//
// Reading the rules back out of .vercel/output/config.json rather than out of
// the source is the whole point: the first version of this map emitted patterns
// that could never match — slash-less, and ordered behind the 308 that adds the
// slash — so all 36 redirects were dead and nothing in the source said so.
//
// Gate: every old URL resolves in ONE hop to something this build serves or to
// an external destination. No two-hop chains, no 404s.
import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync('.vercel/output/config.json', 'utf8'));
const inv = JSON.parse(readFileSync('reference/wp-inventory.json', 'utf8'));
const links = JSON.parse(readFileSync('reference/betterlinks-map.json', 'utf8'));
const p = (u) => new URL(u).pathname;

/** Paths the static build actually has a file for. */
const served = new Set(['/', '/features/', '/docs/', '/changelog/', '/privacy-policy/',
  '/feature-request/']);
/** Nothing is planned any more: every route the map points at exists. */
const planned = [];
/* Docs articles and categories are files; the blog, its categories and the
 * feed are on-demand routes in the built function — checked below against
 * the routing table's own function entries, not assumed. */
const servedGlob = [/^\/docs\/[^/]+\/$/, /^\/docs-category\/[^/]+\/$/, /^\/blog\/([^/]+\/)?$/, /^\/category\/[^/]+\/$/, /^\/feed\/$/];

/* Vercel evaluates in phases. Only the routes BEFORE the first `handle` entry
 * run ahead of the filesystem; everything after it is the filesystem, the SSR
 * dispatch and the 404 catch-all, none of which is a redirect. Treating that
 * catch-all as a match is what made the first run of this script report 47
 * failures that were not there. */
const preFilesystem = config.routes.slice(0, config.routes.findIndex((r) => r.handle));

/** One pass of the pre-filesystem rules: first match with a status wins. */
const resolve = (path) => {
  for (const r of preFilesystem) {
    if (!r.src) continue;
    const m = new RegExp(r.src).exec(path);
    if (!m) continue;
    if (r.status && r.headers?.Location) {
      const to = r.headers.Location.replace(/\$(\d+)/g, (_, n) => m[Number(n)] ?? '');
      return { status: r.status, to };
    }
    if (r.status) return { status: r.status, to: null };
    // a non-terminal rule (rewrite/continue); keep looking
  }
  return null;
};

const isServed = (path) =>
  served.has(path) || servedGlob.some((re) => re.test(path)) || planned.some((re) => re.test(path)) || /^https?:\/\//.test(path);

/* Distinguish "there is a file for this today" from "Phase 6 will build it".
 * Both are acceptable destinations for a redirect, but only one of them is
 * checkable right now, and the output should not blur the two. */
const how = (path) => served.has(path) || servedGlob.some((re) => re.test(path)) ? 'served'
  : planned.some((re) => re.test(path)) ? 'PLANNED (Phase 6)' : 'unknown';

const cases = [
  ...inv.posts.map((x) => ({ url: p(x.link), why: 'post' })),
  ...inv.pages.map((x) => ({ url: p(x.link), why: 'page' })),
  ...inv.docs.map((x) => ({ url: p(x.link), why: 'doc' })),
  ...inv.categories.map((x) => ({ url: p(x.link), why: 'category' })),
  ...inv.docCategories.map((x) => ({ url: p(x.link), why: 'doc category' })),
  ...links.map((l) => ({ url: l.from, why: 'BetterLinks' })),
  { url: '/tag/shopify/', why: 'tag archive' },
  { url: '/author/admin/', why: 'author archive' },
  { url: '/wp-json/wp/v2/posts', why: 'REST API' },
  { url: '/xmlrpc.php', why: 'xmlrpc' },
  { url: '/index.php/best-shopify-faq-apps/', why: 'legacy permalink' },
];

/* `/index.php/<post>/` unavoidably takes two hops: the first strips the
 * `index.php`, the second is the post's own move under /blog/. Collapsing it
 * would mean duplicating all 16 post rules with an `index.php` prefix, for a
 * URL form WordPress itself already redirected. Documented, not hidden. */
const TWO_HOPS_OK = new Set(['/index.php/best-shopify-faq-apps/']);

let fails = 0;
const rows = [];
for (const { url, why } of cases) {
  const first = resolve(url);

  if (!first) {
    const ok = isServed(url);
    if (!ok) { fails++; rows.push([url, why, 'NO RULE and not served', '✗']); }
    else rows.push([url, why, `no rule needed — ${how(url)}`, '✓']);
    continue;
  }

  if (first.status === 410) { rows.push([url, why, '410 gone', '✓']); continue; }

  // Second hop: a redirect must land somewhere final.
  if (/^https?:\/\//.test(first.to)) { rows.push([url, why, `${first.status} -> external`, '✓']); continue; }

  const second = resolve(first.to);
  if (second && !TWO_HOPS_OK.has(url)) {
    fails++;
    rows.push([url, why, `${first.status} -> ${first.to} -> ${second.status} (CHAIN)`, '✗']);
    continue;
  }
  if (second) {
    rows.push([url, why, `${first.status} -> ${first.to} -> ${second.status} -> ${second.to} (2 hops, accepted)`, '✓']);
    continue;
  }
  if (!isServed(first.to)) {
    fails++;
    rows.push([url, why, `${first.status} -> ${first.to} (NOT SERVED)`, '✗']);
    continue;
  }
  rows.push([url, why, `${first.status} -> ${first.to}  (${how(first.to)})`, '✓']);
}

/* The slash-less form of every old URL has to work too — that is the form a
 * hand-typed link or a stripped backlink arrives as. */
for (const { url, why } of cases) {
  if (url === '/' || !url.endsWith('/')) continue;
  const bare = url.replace(/\/$/, '');
  const r = resolve(bare);
  if (!r) { fails++; rows.push([bare, why + ' (no slash)', 'NO RULE', '✗']); }
  else if (r.status === 308 && r.to === url) {
    // normalised to the slashed form, which is checked above — fine
  } else if (r.status >= 300 && r.status < 400) {
    // matched the redirect directly, also fine
  } else { fails++; rows.push([bare, why + ' (no slash)', `status ${r.status}`, '✗']); }
}

/* The on-demand routes. They live AFTER the filesystem phase, and a request
 * reaches them in the slashed form — rule 42 sends `/api/subscribe` to
 * `/api/subscribe/` first. The adapter emits the non-ISR ones slash-less
 * (`^/api/subscribe$`), which the slashed request can never match, so it
 * falls through to the 404 catch-all: every API endpoint and the blog search
 * dead on deploy, with a build that says nothing. Each is walked through the
 * post-filesystem rules here and must land on a function. */
const postFilesystem = config.routes.slice(config.routes.findIndex((r) => r.handle) + 1);
const dispatch = (path) => {
  for (const r of postFilesystem) {
    if (!r.src) continue;
    if (!new RegExp(r.src).test(path)) continue;
    if (r.continue) continue;
    return r;
  }
  return null;
};
const functions = ['/api/subscribe/', '/api/feature-request/', '/api/doc-feedback/', '/blog/search/',
  '/blog/', '/blog/page/2/', '/blog/some-post/', '/category/guide/', '/feed/', '/sitemap-blog.xml'];
for (const path of functions) {
  const r = dispatch(path);
  /* The search must NOT be ISR: ISR keys on the path and drops `?s=`, so the
   * dynamic [slug] rule catching it would serve one cached page for every
   * query. It has to reach the plain function. */
  const mustRender = /^\/api\/|^\/blog\/search\//.test(path);
  const fn = r && (r.dest === '_render' || (!mustRender && /^\/_isr\?/.test(r.dest ?? '')));
  if (!fn) { fails++; rows.push([path, 'function', r ? `lands on ${r.dest ?? 'status ' + r.status}` : 'NO RULE', '✗']); }
  else rows.push([path, 'function', r.dest === '_render' ? 'served (on demand)' : 'served (ISR)', '✓']);
}

const bad = rows.filter((r) => r[3] === '✗');
for (const [url, why, what, mark] of (process.env.VERBOSE ? rows : bad)) {
  console.log(`${mark} ${url.padEnd(56)} ${why.padEnd(14)} ${what}`);
}
const pending = rows.filter((r) => /PLANNED/.test(r[2])).length;
console.log(`\n${cases.length} URLs checked (each in both slash forms) and ${functions.length} on-demand routes, ${fails} failures`);
if (pending) console.log(`${pending} of them resolve to routes Phase 6 has still to build — re-run once the blog and docs are wired.`);
if (fails) process.exitCode = 1;
