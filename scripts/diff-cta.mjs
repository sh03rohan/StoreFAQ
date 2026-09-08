import { chromium } from 'playwright';
const b = await chromium.launch(); const ctx = await b.newContext();
const ref = await ctx.newPage(), mine = await ctx.newPage();
const settle = async (p, u) => { await p.goto(u, { waitUntil: 'networkidle', timeout: 60000 });
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); } scrollTo(0, 0); });
  await p.waitForTimeout(700); };
let worst = 0;
for (const w of [360, 480, 768, 1024, 1280, 1440, 1920]) {
  await ref.setViewportSize({ width: w, height: 900 }); await mine.setViewportSize({ width: w, height: 900 });
  await settle(ref, 'https://storefaq.io/'); await settle(mine, 'http://localhost:4321/');
  const r = await ref.evaluate(() => {
    const vis = e => { const q = e.getBoundingClientRect(); return q.width > 0 && q.height > 0; };
    const card = [...document.querySelectorAll('.eb-row-root-container')]
      .find(e => getComputedStyle(e).backgroundColor === 'rgb(47, 70, 33)' && vis(e));
    const sec = card.closest('.wp-block-essential-blocks-wrapper').querySelector('.eb-wrapper-outer');
    const bx = e => { if (!e) return null; const q = e.getBoundingClientRect();
      return { w: Math.round(q.width), h: Math.round(q.height), x: Math.round(q.x), y: Math.round(q.top + scrollY) }; };
    return { section: bx(sec), card: bx(card),
      title: bx([...card.querySelectorAll('.first-title')].filter(vis)[0]),
      link: bx([...card.querySelectorAll('.eb-button-anchor')].filter(vis)[0]),
      swoosh: bx([...card.querySelectorAll('img')].filter(vis).find(m => /Group-39473/.test(m.currentSrc))),
      media: bx([...card.querySelectorAll('img')].filter(vis).find(m => /Frame-10909/.test(m.currentSrc))) };
  });
  const m = await mine.evaluate(() => {
    const bx = s => { const e = document.querySelector(s); if (!e) return null; const q = e.getBoundingClientRect();
      return { w: Math.round(q.width), h: Math.round(q.height), x: Math.round(q.x), y: Math.round(q.top + scrollY) }; };
    return { section: bx('.cta'), card: bx('.cta__card'), title: bx('.cta__title'),
      link: bx('.cta__link'), swoosh: bx('.cta__swoosh'), media: bx('.cta__media img') };
  });
  console.log(`\n${w}px`);
  const INLINE = new Set(['title', 'link']);
  for (const k of ['section', 'card', 'title', 'link', 'swoosh', 'media']) {
    if (!r[k] || !m[k]) { console.log(`  ${k.padEnd(8)} ref=${JSON.stringify(r[k])} mine=${JSON.stringify(m[k])}`); worst = 999; continue; }
    const dy = (m[k].y - m.section.y) - (r[k].y - r.section.y);
    const d = [INLINE.has(k) ? 0 : m[k].w - r[k].w, m[k].h - r[k].h, m[k].x - r[k].x, dy];
    const bad = d.some(v => Math.abs(v) > 2);
    console.log(`  ${k.padEnd(8)} ref ${r[k].w}x${r[k].h}@${r[k].x}  mine ${m[k].w}x${m[k].h}@${m[k].x}  Δw${d[0]} Δh${d[1]} Δx${d[2]} Δy${d[3]} ${bad ? '✗' : '✓'}`);
    worst = Math.max(worst, ...d.map(Math.abs));
  }
}
console.log('\nworst:', worst);
await b.close();
