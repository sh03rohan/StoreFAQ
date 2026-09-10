// Every URL WordPress currently serves, as JSON.
//
// This is the input to the redirect map: anything here that will not exist at
// the same path after the migration needs a 301, or it is a broken link on
// launch day (§C ground rule 5).
//
// Paced deliberately — the reference is a production site.
import { writeFileSync } from 'node:fs';

const BASE = 'https://storefaq.io/wp-json/wp/v2';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const get = async (path) => {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${BASE}/${path}`, { headers: { 'user-agent': 'storefaq-migration/1.0' } });
    if (res.ok) return res.json();
    await sleep(2000 * (attempt + 1));
  }
  throw new Error(`giving up on ${path}`);
};

const all = async (type, fields) => {
  const out = [];
  for (let page = 1; page <= 10; page++) {
    const batch = await get(`${type}?per_page=100&page=${page}&_fields=${fields}`);
    out.push(...batch);
    if (batch.length < 100) break;
    await sleep(1000);
  }
  return out;
};

const inventory = {};
for (const [key, type, fields] of [
  ['posts', 'posts', 'id,slug,link,date,modified'],
  ['pages', 'pages', 'id,slug,link'],
  ['docs', 'docs', 'id,slug,link'],
  ['categories', 'categories', 'id,slug,link,count'],
  ['docCategories', 'doc_category', 'id,slug,link,count'],
]) {
  try {
    inventory[key] = await all(type, fields);
    console.log(`${key.padEnd(14)} ${inventory[key].length}`);
  } catch (e) {
    inventory[key] = [];
    console.log(`${key.padEnd(14)} FAILED — ${e.message}`);
  }
  await sleep(1500);
}

writeFileSync('reference/wp-inventory.json', JSON.stringify(inventory, null, 2));
const total = Object.values(inventory).reduce((n, a) => n + a.length, 0);
console.log(`\n${total} URLs -> reference/wp-inventory.json`);
for (const [k, v] of Object.entries(inventory)) {
  if (v.length) console.log(`  ${k}: ${v.slice(0, 3).map((x) => new URL(x.link).pathname).join('  ')}${v.length > 3 ? '  …' : ''}`);
}
