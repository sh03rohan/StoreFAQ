// Runs the §B1 sanitiser over every real document and fails on anything that
// survives it.
//
// The guide's own KILL_CLASS let `is-style-stripes`, `has-fixed-layout`,
// `aligncenter` and five `thinkrank-*` classes through — and every one of them
// would ALSO have passed assert-clean.sh, which greps for a shorter list. So
// this checks the sanitiser's output directly, against the real corpus, rather
// than trusting either regex.
import { cleanWpHtml } from '../src/lib/wp-html.ts';

const API = 'https://storefaq.io/wp-json/wp/v2';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const get = async (path) => {
  for (let i = 0; i < 3; i++) {
    const res = await fetch(`${API}/${path}`, { headers: { 'user-agent': 'storefaq-migration/1.0' } });
    if (res.ok) return res.json();
    await sleep(2000 * (i + 1));
  }
  throw new Error(`giving up on ${path}`);
};

/* Anything that must never appear in sanitised output. Deliberately wider than
 * the gate's grep — this is the place to be strict. */
const FORBIDDEN = [
  [/class="[^"]*\bwp-/, 'wp- class'],
  [/class="[^"]*\beb-/, 'eb- class'],
  [/class="[^"]*\bis-layout-/, 'is-layout- class'],
  [/class="[^"]*\bis-style-/, 'is-style- class'],
  [/class="[^"]*\bhas-fixed-layout/, 'has-fixed-layout'],
  [/class="[^"]*\balign(wide|full|center|left|right)\b/, 'align* class'],
  [/class="[^"]*\bthinkrank/, 'thinkrank class'],
  [/class="[^"]*\bbetterdocs/, 'betterdocs class'],
  [/class="[^"]*\bff-|fluentform/, 'fluentform class'],
  [/\sstyle="/, 'inline style'],
  [/data-(block|eb|widget|element|settings)/, 'builder data attribute'],
  [/<(script|style|noscript)\b/, 'script/style/noscript'],
  [/cms\.storefaq\.io/, 'CMS hostname'],
  // node-html-parser serialises an empty attribute bare, so `alt` counts.
  [/<img(?![^>]*\balt\b)/, 'img with no alt attribute at all'],
];

/* Pages are NOT sanitiser input. §B1 says static pages are rebuilt from
 * scratch as components — which they were — and only post and doc bodies flow
 * through here. Running the sanitiser over page-builder pages tests the wrong
 * thing and reports failures that mean nothing. */
const SANITISED_TYPES = ['docs', 'posts'];

const corpora = [];
for (const type of SANITISED_TYPES) {
  let page = 1;
  for (;;) {
    const batch = await get(`${type}?per_page=100&page=${page}&_fields=slug,content`);
    corpora.push(...batch.map((x) => ({ type, slug: x.slug, html: x.content.rendered })));
    if (batch.length < 100) break;
    page++;
    await sleep(800);
  }
  await sleep(1000);
}

let fails = 0, biggest = { slug: '', len: 0 };
for (const { type, slug, html } of corpora) {
  const out = cleanWpHtml(html);
  if (out.length > biggest.len) biggest = { slug: `${type}/${slug}`, len: out.length };
  const hits = FORBIDDEN.filter(([re]) => re.test(out)).map(([, name]) => name);
  if (hits.length) {
    fails++;
    console.log(`✗ ${type}/${slug}`);
    for (const h of hits) {
      const re = FORBIDDEN.find(([, n]) => n === h)[0];
      console.log(`    ${h}: ${(out.match(re) ?? [''])[0].slice(0, 80)}`);
    }
  }
}

/* An empty alt on a content screenshot is a real accessibility gap in the
 * source, not something to fix silently — reported, not failed. */
let emptyAlt = 0;
for (const { type, slug, html } of corpora) {
  const n = [...cleanWpHtml(html).matchAll(/<img[^>]*\balt(?![^\s>]*=[^\s>])/g)].length;
  if (n) { emptyAlt += n; console.log(`  note: ${type}/${slug} has ${n} image(s) with an empty alt`); }
}

console.log(`\n${corpora.length} documents sanitised, ${fails} with surviving WordPress markup.`);
if (emptyAlt) console.log(`${emptyAlt} images carry an empty alt — the source has no alt text for them (§B7).`);
console.log(`longest output: ${biggest.slug} (${biggest.len} chars) — style .prose against this one (§B1).`);
if (fails) process.exitCode = 1;
