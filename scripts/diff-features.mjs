import { chromium } from 'playwright';
const b = await chromium.launch(); const ctx = await b.newContext();
const ref = await ctx.newPage(), mine = await ctx.newPage();
const settle = async (p, u) => { await p.goto(u, { waitUntil: 'networkidle', timeout: 60000 });
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise(r => setTimeout(r, 50)); } scrollTo(0, 0); });
  // Wait for layout to stop moving. Web fonts swapping in change where text
  // wraps, and measuring mid-swap makes the REFERENCE itself vary run to run —
  // one card read 3 lines on one run and 4 on the next. Neither
  // `document.fonts.ready` (it resolves to a FontFaceSet, which Playwright
  // cannot serialise, so awaiting it in Node is a no-op) nor
  // `document.fonts.check` (true before the face is actually applied) is
  // enough on its own; a settled page height is.
  await p.evaluate(async () => {
    await document.fonts.ready;
    let last = -1, stable = 0;
    for (let i = 0; i < 80 && stable < 3; i++) {
      await new Promise(r => requestAnimationFrame(() => setTimeout(r, 100)));
      const h = document.documentElement.scrollHeight;
      stable = h === last ? stable + 1 : 0;
      last = h;
    }
  });
  await p.waitForTimeout(600); };
let worst = 0;
for (const w of [360, 480, 768, 1024, 1280, 1440, 1920]) {
  await ref.setViewportSize({ width: w, height: 900 }); await mine.setViewportSize({ width: w, height: 900 });
  await settle(ref, 'https://storefaq.io/'); await settle(mine, 'http://localhost:4321/');
  const r = await ref.evaluate(() => {
    const sec = document.querySelectorAll('main .wp-block-essential-blocks-wrapper')[1];
    const vis = e => { const q = e.getBoundingClientRect(); return q.width > 0 && q.height > 0; };
    const g = e => { if (!e) return null; const q = e.getBoundingClientRect(); return { w: Math.round(q.width), h: Math.round(q.height), x: Math.round(q.x), y: Math.round(q.top + scrollY) }; };
    const outer = sec.querySelector('.eb-wrapper-outer');
    const card = sec.querySelector('.eb-row-root-container');
    const rows = [...sec.querySelectorAll('.wp-block-essential-blocks-row')].filter(e => !e.parentElement.closest('.wp-block-essential-blocks-row')).filter(vis);
    const cells = [];
    rows.slice(1).forEach(row => [...row.querySelectorAll('.eb-row-inner > .wp-block-essential-blocks-column')].filter(vis).forEach(c => cells.push(g(c))));
    return { section: g(outer), card: g(card), cells };
  });
  const m = await mine.evaluate(() => {
    const g = s => { const e = document.querySelector(s); if (!e) return null; const q = e.getBoundingClientRect(); return { w: Math.round(q.width), h: Math.round(q.height), x: Math.round(q.x), y: Math.round(q.top + scrollY) }; };
    const cells = [...document.querySelectorAll('.feature')].map(e => { const q = e.getBoundingClientRect(); return { w: Math.round(q.width), h: Math.round(q.height), x: Math.round(q.x), y: Math.round(q.top + scrollY) }; });
    return { section: g('.features'), card: g('.feature-lead'), cells };
  });
  const d = (a, c) => a && c ? ['w','h','x'].map(k => c[k] - a[k]) : null;
  console.log(`\n${w}px`);
  for (const k of ['section', 'card']) {
    const dd = d(r[k], m[k]);
    if (dd) { console.log(`  ${k.padEnd(8)} ref ${r[k].w}x${r[k].h}@${r[k].x}  mine ${m[k].w}x${m[k].h}@${m[k].x}  Δ${dd.join(',')} ${dd.some(v=>Math.abs(v)>2)?'✗':'✓'}`); worst = Math.max(worst, ...dd.map(Math.abs)); }
  }
  console.log(`  cells    ref ${r.cells.length} mine ${m.cells.length}`);
  for (let i = 0; i < Math.min(r.cells.length, m.cells.length, 2); i++) {
    const dd = d(r.cells[i], m.cells[i]);
    console.log(`    [${i}] ref ${r.cells[i].w}x${r.cells[i].h}@${r.cells[i].x}  mine ${m.cells[i].w}x${m.cells[i].h}@${m.cells[i].x}  Δ${dd.join(',')} ${dd.some(v=>Math.abs(v)>2)?'✗':'✓'}`);
    worst = Math.max(worst, ...dd.map(Math.abs));
  }
}
console.log('\nworst:', worst);
await b.close();
