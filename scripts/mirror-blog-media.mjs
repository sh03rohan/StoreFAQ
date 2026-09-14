// Mirror the blog's images — every post's featured image and every upload its
// body references — into public/media/, the same tree the docs' mirror uses.
//
// The blog is rendered on demand, so nothing mirrors its images at build
// time; they are served through the /media/ rewrite, which proxies from
// WordPress whatever is not on disk. On the first deploy the first row of
// /blog/ came up broken: the proxied fetches for the eager images failed at
// the origin under the burst (it rate-limits — every diff script here has
// met it) and the failures were cached. Run this after publishing, and the
// proxy only ever sees a post newer than the last run.
//
// Idempotent and paced, like download-media.mjs. Nothing is rewritten: the
// pages already emit /media/ paths.
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

const WP = (process.env.WP_URL ?? 'https://storefaq.io').replace(/\/$/, '');
const UPLOADS = /https?:\/\/(?:cms\.)?storefaq\.io\/wp-content\/uploads\/([0-9]{4}\/[0-9]{2}\/[^\s"'<>?)]+)/g;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const res = await fetch(`${WP}/wp-json/wp/v2/posts?per_page=100&_embed=wp:featuredmedia&_fields=id,slug,content,_links,_embedded`);
if (!res.ok) { console.error(`WordPress ${res.status}`); process.exit(1); }
const posts = await res.json();

const wanted = new Set();
for (const p of posts) {
  const media = p._embedded?.['wp:featuredmedia']?.[0]?.source_url;
  if (media) for (const m of media.matchAll(UPLOADS)) wanted.add(m[1]);
  for (const m of (p.content?.rendered ?? '').matchAll(UPLOADS)) wanted.add(m[1]);
}

let fetched = 0, present = 0, failed = 0;
for (const path of wanted) {
  const dest = join('public/media', path);
  if (existsSync(dest)) { present++; continue; }
  mkdirSync(dirname(dest), { recursive: true });
  let ok = false;
  for (let attempt = 0; attempt < 3 && !ok; attempt++) {
    try {
      const r = await fetch(`${WP}/wp-content/uploads/${path}`, { headers: { 'user-agent': 'storefaq-migration/1.0' } });
      if (!r.ok) throw new Error(String(r.status));
      writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
      ok = true; fetched++;
    } catch (e) { if (attempt === 2) { failed++; console.log(`FAILED  ${path}  (${e.message})`); } else await sleep(1500 * (attempt + 1)); }
  }
  await sleep(400);
}
console.log(`${posts.length} posts, ${wanted.size} uploads: fetched ${fetched}, already present ${present}, failed ${failed}`);
if (failed) process.exitCode = 1;
