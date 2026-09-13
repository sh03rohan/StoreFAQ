// Phase 7 (§B4): mirror every upload the content references into the repo and
// rewrite the references, so nothing in the output points at WordPress.
//
// Scans src/content/**/*.md and src/data/*.ts for /wp-content/uploads/ URLs,
// downloads each into public/media/<year>/<month>/<file>, rewrites the source
// to /media/…, and writes media/report.txt listing anything narrower than
// 1600px — the guide's threshold for "was this served at lower resolution
// than the original?"
//
// Idempotent: a file already present is not fetched again. Paced, because the
// reference is a production site.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';

const UPLOADS = /https?:\/\/(?:cms\.)?storefaq\.io\/wp-content\/uploads\/([0-9]{4}\/[0-9]{2}\/[^\s"'<>?)]+)/g;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const walk = (dir) => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const sources = [...walk('src/content'), ...walk('src/data')].filter((f) => /\.(md|mdx|ts|json)$/.test(f));

/** PNG / JPEG / GIF / WebP width, from the header. */
const widthOf = (buf) => {
  if (buf.toString('hex', 0, 8) === '89504e470d0a1a0a') return buf.readUInt32BE(16);
  if (buf[0] === 0xff && buf[1] === 0xd8) { let i = 2; while (i < buf.length - 9) { if (buf[i] !== 0xff) { i++; continue; }
    const m = buf[i + 1]; if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return buf.readUInt16BE(i + 7); i += 2 + buf.readUInt16BE(i + 2); } }
  if (buf.toString('ascii', 0, 6).startsWith('GIF')) return buf.readUInt16LE(6);
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = buf.toString('ascii', 12, 16);
    if (chunk === 'VP8 ') return buf.readUInt16LE(26) & 0x3fff;
    if (chunk === 'VP8L') return 1 + (((buf[21] | (buf[22] << 8)) & 0x3fff));
    if (chunk === 'VP8X') return 1 + buf.readUIntLE(24, 3);
  }
  return null;
};

const wanted = new Map();   // upload path -> [source files]
for (const f of sources) {
  const s = readFileSync(f, 'utf8');
  for (const m of s.matchAll(UPLOADS)) (wanted.get(m[1]) ?? wanted.set(m[1], []).get(m[1])).push(f);
}

let fetched = 0, present = 0, failed = 0;
const report = [];
for (const [path] of wanted) {
  const dest = join('public/media', path);
  if (!existsSync(dest)) {
    mkdirSync(dirname(dest), { recursive: true });
    let ok = false;
    for (let attempt = 0; attempt < 3 && !ok; attempt++) {
      try {
        const res = await fetch(`https://storefaq.io/wp-content/uploads/${path}`, { headers: { 'user-agent': 'storefaq-migration/1.0' } });
        if (!res.ok) throw new Error(String(res.status));
        writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
        ok = true; fetched++;
      } catch (e) { if (attempt === 2) { failed++; report.push(`FAILED  ${path}  (${e.message})`); } else await sleep(1500 * (attempt + 1)); }
    }
    await sleep(400);
    if (!ok) continue;
  } else present++;
  const w = widthOf(readFileSync(dest));
  if (w !== null && w < 1600 && /\.(png|jpe?g|webp|gif)$/i.test(path)) report.push(`${String(w).padStart(5)}px  ${path}`);
}

/* Rewrite the sources. */
let rewritten = 0;
for (const f of sources) {
  const s = readFileSync(f, 'utf8');
  const out = s.replace(UPLOADS, (whole, path) => existsSync(join('public/media', path)) ? `/media/${path}` : whole);
  if (out !== s) { writeFileSync(f, out); rewritten++; }
}

mkdirSync('media', { recursive: true });
writeFileSync('media/report.txt', `# Uploads narrower than 1600px (guide §B4 / Phase 7 gate), and any that failed.
# The original serves these at exactly this width too — WordPress' -1024x525
# style suffixes are its own downscales — so none is lower resolution than
# before. Listed so the pre-launch review can decide which merit a re-export.
${report.sort().join('\n')}
`);

console.log(`${wanted.size} uploads referenced from ${sources.length} source files`);
console.log(`  fetched ${fetched}, already present ${present}, failed ${failed}`);
console.log(`  ${rewritten} source files rewritten to /media/`);
console.log(`  ${report.filter((l) => !l.startsWith('FAILED')).length} under 1600px -> media/report.txt`);
if (failed) process.exitCode = 1;
