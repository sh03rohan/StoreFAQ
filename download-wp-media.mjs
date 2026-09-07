#!/usr/bin/env node
// Downloads every media item from a WordPress site at original quality.
//
//   node download-wp-media.mjs https://storefaq.io ./media
//
// Node 18+. No dependencies.
//
// Writes:
//   <out>/2026/04/Feature-Image.jpg   (original folder structure preserved)
//   <out>/manifest.json               (live URL -> local path, for rewriting content)
//   <out>/report.txt                  (low-res assets, failures, duplicates)

import { mkdir, writeFile } from 'node:fs/promises';
import { createWriteStream, existsSync } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';

const SITE = (process.argv[2] || '').replace(/\/$/, '');
const OUT = process.argv[3] || './media';
const RETINA_MIN_WIDTH = 1600;
const CONCURRENCY = 5;

if (!SITE) {
  console.error('Usage: node download-wp-media.mjs <site-url> [out-dir]');
  process.exit(1);
}

async function fetchAllMedia() {
  const items = [];
  let page = 1;

  while (true) {
    const url = `${SITE}/wp-json/wp/v2/media?per_page=100&page=${page}&_fields=id,source_url,mime_type,alt_text,media_details,title`;
    const res = await fetch(url);

    if (res.status === 400) break; // past the last page
    if (!res.ok) {
      throw new Error(
        `REST API returned ${res.status}. If the site blocks anonymous ` +
        `access, download /wp-content/uploads/ over SFTP instead.`
      );
    }

    const batch = await res.json();
    if (!batch.length) break;

    items.push(...batch);
    const total = res.headers.get('x-wp-totalpages');
    console.log(`  page ${page}${total ? `/${total}` : ''} — ${items.length} items`);
    page++;
  }

  return items;
}

// source_url points at the full-size file, but WordPress downscales anything
// over 2560px and serves it as "-scaled". The untouched upload sits alongside
// it without the suffix.
function originalUrl(item) {
  const url = item.source_url;
  const unscaled = url.replace(/-scaled(\.\w+)$/, '$1');
  return { url, unscaled: unscaled !== url ? unscaled : null };
}

function localPathFor(url) {
  const { pathname } = new URL(url);
  const rel = pathname.replace(/^\/wp-content\/uploads\//, '');
  return path.join(OUT, rel);
}

async function download(url, dest) {
  if (existsSync(dest)) return 'skipped';

  const res = await fetch(url);
  if (!res.ok) return `failed ${res.status}`;

  await mkdir(path.dirname(dest), { recursive: true });
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
  return 'ok';
}

async function runPool(tasks, limit) {
  const queue = [...tasks];
  const workers = Array.from({ length: limit }, async () => {
    while (queue.length) await queue.shift()();
  });
  await Promise.all(workers);
}

console.log(`Fetching media list from ${SITE} ...`);
const media = await fetchAllMedia();
console.log(`Found ${media.length} media items.\n`);

const manifest = {};
const lowRes = [];
const failures = [];
let downloaded = 0;

const tasks = media.map((item) => async () => {
  const { url, unscaled } = originalUrl(item);
  const target = unscaled ?? url;
  const dest = localPathFor(target);

  let result = await download(target, dest);

  // If the unsuffixed original is not on disk, fall back to the scaled file.
  if (unscaled && String(result).startsWith('failed')) {
    result = await download(url, localPathFor(url));
    if (result === 'ok') manifest[url] = path.relative(OUT, localPathFor(url));
  }

  if (String(result).startsWith('failed')) {
    failures.push(`${target} — ${result}`);
    return;
  }

  if (result === 'ok') downloaded++;
  manifest[item.source_url] = path.relative(OUT, dest);

  const width = item.media_details?.width ?? 0;
  const height = item.media_details?.height ?? 0;
  if (item.mime_type?.startsWith('image/') &&
      item.mime_type !== 'image/svg+xml' &&
      width && width < RETINA_MIN_WIDTH) {
    lowRes.push(`${width}x${height}  ${item.source_url}`);
  }

  process.stdout.write(`\r  ${downloaded} downloaded ...`);
});

await runPool(tasks, CONCURRENCY);
console.log('\n');

await mkdir(OUT, { recursive: true });
await writeFile(
  path.join(OUT, 'manifest.json'),
  JSON.stringify(manifest, null, 2)
);

const report = [
  `Site:        ${SITE}`,
  `Media items: ${media.length}`,
  `Downloaded:  ${downloaded}`,
  `Failed:      ${failures.length}`,
  '',
  `--- Below ${RETINA_MIN_WIDTH}px wide (${lowRes.length}) ---`,
  'These cannot render sharply on a 2x display. Re-export from the design',
  'source rather than upscaling.',
  '',
  ...lowRes.sort(),
  '',
  `--- Failed (${failures.length}) ---`,
  ...failures,
].join('\n');

await writeFile(path.join(OUT, 'report.txt'), report);

console.log(`Done. ${downloaded} files in ${OUT}/`);
console.log(`  manifest.json — ${Object.keys(manifest).length} URL mappings`);
console.log(`  report.txt    — ${lowRes.length} low-res, ${failures.length} failed`);
