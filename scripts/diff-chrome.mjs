// Measures the local build exactly as capture-chrome.mjs measured the
// original, and prints the delta. Guide Phase 4: diff, don't eyeball.
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';

const REF = JSON.parse(await readFile('reference/CHROME.json', 'utf8'));
const BASE = process.argv[2] ?? 'http://localhost:4321';
const VIEWPORTS = [360, 480, 768, 1024, 1280, 1440, 1920];

const browser = await chromium.launch();
const page = await browser.newPage();
let worst = 0;

const MAP = {
  logo: '.header__logo img',
  nav: '.header__list',
  cta: '.header__cta',
  hamburger: '.header__burger',
};

for (const w of VIEWPORTS) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);

  const mine = await page.evaluate((map) => {
    const box = (sel) => {
      const e = document.querySelector(sel);
      if (!e) return null;
      const r = e.getBoundingClientRect();
      const s = getComputedStyle(e);
      return {
        x: Math.round(r.x), y: Math.round(r.y),
        w: Math.round(r.width), h: Math.round(r.height),
        visible: r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden',
      };
    };
    const out = {};
    for (const [k, sel] of Object.entries(map)) out[k] = box(sel);
    const hdr = document.querySelector('.header');
    out.headerH = hdr ? Math.round(hdr.getBoundingClientRect().height) : null;
    return out;
  }, MAP);

  const ref = REF[w];
  console.log(`\n${w}px  headerH ref=${ref.headerH} mine=${mine.headerH}  Δ${mine.headerH - ref.headerH}`);
  worst = Math.max(worst, Math.abs(mine.headerH - ref.headerH));

  for (const key of ['logo', 'nav', 'cta', 'hamburger']) {
    const r = ref[key], m = mine[key];
    const rv = r?.visible ?? false, mv = m?.visible ?? false;
    if (rv !== mv) { console.log(`  ${key.padEnd(10)} VISIBILITY ref=${rv} mine=${mv}`); worst = Math.max(worst, 999); continue; }
    if (!rv) { console.log(`  ${key.padEnd(10)} both hidden ✓`); continue; }
    const d = ['x', 'w', 'h'].map((k) => m[k] - r[k]);
    const bad = d.some((v) => Math.abs(v) > 2);
    console.log(`  ${key.padEnd(10)} ref ${r.w}x${r.h}@${r.x}  mine ${m.w}x${m.h}@${m.x}  Δx${d[0]} Δw${d[1]} Δh${d[2]} ${bad ? '✗' : '✓'}`);
    worst = Math.max(worst, ...d.map(Math.abs));
  }
}
console.log(`\nworst delta: ${worst}px`);
await browser.close();
