import { chromium } from 'playwright';
const b = await chromium.launch(); /* `reducedMotion: 'reduce'` so the entrance animations never run here.
 * Every element is then at its final position from first paint, which is
 * what these measurements are about — and it exercises the accessibility
 * path at the same time. */
const ctx = await b.newContext({ reducedMotion: 'reduce' });
const ref = await ctx.newPage(), mine = await ctx.newPage();
/* `domcontentloaded`, NOT `networkidle`. The live site runs Crisp live chat and
 * the BetterDocs Instant Answer widget, which hold connections open — /docs/
 * stopped reaching networkidle at all and the diff died on a 60s timeout with
 * nothing wrong on either side. Readiness here is the settled page height
 * below, which is the signal that actually made these measurements stable. */
const settle = async (p, u) => { await p.goto(u, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise(r => setTimeout(r, 50)); } scrollTo(0, 0); });
  // Wait for layout to stop moving. Web fonts swapping in change where text
  // wraps, and measuring mid-swap makes the REFERENCE itself vary run to run —
  // one card read 3 lines on one run and 4 on the next. Neither
  // `document.fonts.ready` (it resolves to a FontFaceSet, which Playwright
  // cannot serialise, so awaiting it in Node is a no-op) nor
  // `document.fonts.check` (true before the face is actually applied) is
  // enough on its own; a settled page height is.
  await p.evaluate(async () => {
    /* networkidle used to be what guaranteed images had arrived; wait for them
     * explicitly instead, since a late image changes where text wraps. Raced
     * against a timeout because a `loading="lazy"` image that never enters the
     * viewport never fires either event — waiting on it unconditionally hung
     * the whole run with both servers responding fine. */
    await Promise.race([
      Promise.all([...document.images].filter((i) => !i.complete)
        .map((i) => new Promise((r) => { i.addEventListener('load', r, { once: true });
          i.addEventListener('error', r, { once: true }); }))),
      new Promise((r) => setTimeout(r, 5000)),
    ]);
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
    // The card, not the column. The reference's column box also contains the
    // card's 30px bottom margin, which this build expresses as a row gap —
    // comparing the column against my card made every card look 30px short.
    rows.slice(1).forEach(row => [...row.querySelectorAll('.eb-row-inner > .wp-block-essential-blocks-column')]
      .filter(vis).forEach(c => cells.push(g(c.querySelector('.eb-parent-wrapper') ?? c))));
    // "Tails": the gap between a card's last content edge and its bottom.
    // The original keeps every screenshot flush to the card bottom; this is
    // the check that would have caught the misalignment reported in review.
    const tails = [];
    rows.slice(1).forEach(row => [...row.querySelectorAll('.eb-row-inner > .wp-block-essential-blocks-column')]
      .filter(vis).forEach(c => { const card = c.querySelector('.eb-parent-wrapper') ?? c;
        const img = [...c.querySelectorAll('img')].filter(vis).pop();
        tails.push(img ? Math.round(card.getBoundingClientRect().bottom - img.getBoundingClientRect().bottom) : null); }));
    return { section: g(outer), card: g(card), cells, tails };
  });
  const m = await mine.evaluate(() => {
    const g = s => { const e = document.querySelector(s); if (!e) return null; const q = e.getBoundingClientRect(); return { w: Math.round(q.width), h: Math.round(q.height), x: Math.round(q.x), y: Math.round(q.top + scrollY) }; };
    const cells = [...document.querySelectorAll('.feature')].map(e => { const q = e.getBoundingClientRect(); return { w: Math.round(q.width), h: Math.round(q.height), x: Math.round(q.x), y: Math.round(q.top + scrollY) }; });
    const tails = [...document.querySelectorAll('.feature')].map(c => {
      const img = c.querySelector('.feature__media img') ?? c.querySelector('img');
      return img ? Math.round(c.getBoundingClientRect().bottom - img.getBoundingClientRect().bottom) : null; });
    return { section: g('.features'), card: g('.feature-lead'), cells, tails };
  });
  const d = (a, c) => a && c ? ['w','h','x'].map(k => c[k] - a[k]) : null;
  console.log(`\n${w}px`);
  for (const k of ['section', 'card']) {
    const dd = d(r[k], m[k]);
    if (dd) { console.log(`  ${k.padEnd(8)} ref ${r[k].w}x${r[k].h}@${r[k].x}  mine ${m[k].w}x${m[k].h}@${m[k].x}  Δ${dd.join(',')} ${dd.some(v=>Math.abs(v)>2)?'✗':'✓'}`); worst = Math.max(worst, ...dd.map(Math.abs)); }
  }
  console.log(`  cells    ref ${r.cells.length} mine ${m.cells.length}`);
  const tailsOk = JSON.stringify(r.tails) === JSON.stringify(m.tails);
  console.log(`  tails    ref ${JSON.stringify(r.tails)}\n           mine ${JSON.stringify(m.tails)} ${tailsOk ? '✓' : '✗'}`);
  if (!tailsOk) worst = Math.max(worst, 3);
  /* All eight, not the first two. Card heights are DELIBERATELY equalised per
   * row (asked for in review; the original leaves them ragged), so compare
   * each card's height against the tallest in its reference row. Width and x
   * still compare card to card, so a genuinely wrong card still fails. */
  const rowMax = new Map();
  r.cells.forEach(c => rowMax.set(c.y, Math.max(rowMax.get(c.y) ?? 0, c.h)));
  for (let i = 0; i < Math.min(r.cells.length, m.cells.length); i++) {
    const expect = { ...r.cells[i], h: rowMax.get(r.cells[i].y) ?? r.cells[i].h };
    const dd = d(expect, m.cells[i]);
    console.log(`    [${i}] ref ${expect.w}x${expect.h}@${expect.x}  mine ${m.cells[i].w}x${m.cells[i].h}@${m.cells[i].x}  Δ${dd.join(',')} ${dd.some(v=>Math.abs(v)>2)?'✗':'✓'}`);
    worst = Math.max(worst, ...dd.map(Math.abs));
  }
}
console.log('\nworst:', worst);
await b.close();
