// Converts the 16 BetterDocs articles out of WordPress into the repo.
//
// A1 decision: docs are MDX in repo, not headless — they prerender with no WP
// runtime dependency. Bodies go through the §B1 sanitiser once, here, and the
// result is committed, so nothing about /docs/ depends on WordPress being up.
//
// Re-run to pick up edits made in WordPress before it is decommissioned.
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
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

const cats = await get('doc_category?per_page=100&_fields=id,slug,name,description,count');
await sleep(800);

const docs = [];
for (let page = 1; ; page++) {
  const batch = await get(`docs?per_page=100&page=${page}&_fields=id,slug,title,excerpt,content,date,modified,doc_category,menu_order`);
  docs.push(...batch);
  if (batch.length < 100) break;
  await sleep(800);
}

const decode = (s) => s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
  .replace(/&hellip;/g, '…').replace(/&#8217;/g, '’').replace(/&#8216;/g, '‘');

const dir = 'src/content/docs';
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });

const byCat = new Map(cats.map((c) => [c.id, c]));
const yaml = (v) => JSON.stringify(v);

let written = 0;
for (const d of docs) {
  const cat = byCat.get(d.doc_category?.[0]);
  const body = cleanWpHtml(d.content.rendered);
  const excerpt = decode(d.excerpt?.rendered?.replace(/<[^>]+>/g, '') ?? '').replace(/\s+/g, ' ').trim();

  writeFileSync(`${dir}/${d.slug}.md`, `---
title: ${yaml(decode(d.title.rendered))}
slug: ${yaml(d.slug)}
category: ${yaml(cat?.slug ?? 'uncategorised')}
categoryName: ${yaml(cat?.name ?? 'Uncategorised')}
order: ${d.menu_order ?? 0}
published: ${yaml(d.date)}
updated: ${yaml(d.modified)}
excerpt: ${yaml(excerpt.slice(0, 300))}
---

${body}
`);
  written++;
}

writeFileSync('src/data/docs-taxonomy.json', JSON.stringify(
  cats.map((c) => ({ slug: c.slug, name: decode(c.name), count: c.count })), null, 2) + '\n');

console.log(`${written} docs -> ${dir}/`);
console.log(`${cats.length} categories -> src/data/docs-taxonomy.json`);
for (const c of cats) console.log(`  ${c.slug.padEnd(18)} ${c.name.padEnd(18)} ${c.count} docs`);
