/* Whole-page check for Home: compares the six section bands (top offset and
 * height) and the total main height, so that per-section drift shows up even
 * when each section passes on its own. */
import { chromium } from 'playwright';

const b = await chromium.launch();
const ctx = await b.newContext();
const ref = await ctx.newPage(), mine = await ctx.newPage();
const settle = async (p, u) => {
  await p.goto(u, { waitUntil: 'networkidle', timeout: 60000 });
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); } scrollTo(0, 0); });
  await p.waitForTimeout(800);
};

const NAMES = ['hero', 'features', 'pricing', 'cta', 'testimonials', 'faq'];
let worst = 0;
for (const w of [360, 480, 768, 1024, 1280, 1440, 1920]) {
  await ref.setViewportSize({ width: w, height: 900 });
  await mine.setViewportSize({ width: w, height: 900 });
  await settle(ref, 'https://storefaq.io/');
  await settle(mine, process.env.LOCAL ?? 'http://localhost:4321/');

  const r = await ref.evaluate(() => {
    const bx = e => { const q = e.getBoundingClientRect(); return { h: Math.round(q.height), y: Math.round(q.top + scrollY) }; };
    const main = document.querySelector('main') ?? document.querySelector('.site-main') ?? document.body;
    // Outermost Essential Blocks wrappers are the section boundaries — the
    // same rule scripts/map-sections.mjs uses.
    const secs = [...main.querySelectorAll('.wp-block-essential-blocks-wrapper')].filter(e => {
      const q = e.getBoundingClientRect();
      return q.width >= 100 && q.height >= 40 && !e.parentElement?.closest('.wp-block-essential-blocks-wrapper');
    }).map(e => e.querySelector('.eb-wrapper-outer') ?? e);
    return { main: bx(main), secs: secs.map(bx) };
  });
  const m = await mine.evaluate(() => {
    const bx = e => { const q = e.getBoundingClientRect(); return { h: Math.round(q.height), y: Math.round(q.top + scrollY) }; };
    const main = document.querySelector('main');
    return { main: bx(main), secs: [...main.children].map(bx) };
  });

  console.log(`\n${w}px  ref ${r.secs.length} sections, mine ${m.secs.length}`);
  const n = Math.max(r.secs.length, m.secs.length);
  for (let i = 0; i < n; i++) {
    const a = r.secs[i], z = m.secs[i];
    if (!a || !z) { console.log(`  ${(NAMES[i] ?? i).padEnd(12)} ref=${JSON.stringify(a)} mine=${JSON.stringify(z)} ✗`); worst = 999; continue; }
    const dy = (z.y - m.main.y) - (a.y - r.main.y);
    const d = [z.h - a.h, dy];
    console.log(`  ${(NAMES[i] ?? i).padEnd(12)} ref ${a.h}h @${a.y - r.main.y}  mine ${z.h}h @${z.y - m.main.y}  Δh${d[0]} Δy${d[1]} ${d.some(v => Math.abs(v) > 2) ? '✗' : '✓'}`);
    worst = Math.max(worst, ...d.map(Math.abs));
  }
  const dm = m.main.h - r.main.h;
  console.log(`  ${'MAIN'.padEnd(12)} ref ${r.main.h}h  mine ${m.main.h}h  Δ${dm} ${Math.abs(dm) > 2 ? '✗' : '✓'}`);
  worst = Math.max(worst, Math.abs(dm));
}
console.log('\nworst:', worst);
await b.close();
