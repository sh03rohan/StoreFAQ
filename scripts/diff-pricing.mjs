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
for (const w of [360, 768, 1024, 1280, 1440, 1920]) {
  await ref.setViewportSize({ width: w, height: 900 }); await mine.setViewportSize({ width: w, height: 900 });
  await settle(ref, 'https://storefaq.io/'); await settle(mine, 'http://localhost:4321/');
  const r = await ref.evaluate(() => {
    const sec = document.querySelectorAll('main .wp-block-essential-blocks-wrapper')[2];
    const vis = e => { const q = e.getBoundingClientRect(); return q.width > 0 && q.height > 0; };
    const g = e => { if (!e) return null; const q = e.getBoundingClientRect(); return { w: Math.round(q.width), h: Math.round(q.height), x: Math.round(q.x) }; };
    const cols = [...sec.querySelectorAll('.eb-mcpt-column')];
    // Where the glyphs land inside each plan header, relative to the header
    // cell's own content edge, plus their colours. Box geometry alone let a
    // 15px offset and three different price inks through unnoticed.
    const T = (e, top) => { if (!e) return null; const q = e.getBoundingClientRect();
      return { dy: Math.round(q.top + scrollY - top), dx: Math.round(q.x), c: getComputedStyle(e).color }; };
    // Not `.slice(1)`: the label column's header is only present at 1280+,
    // so slicing blind shifted every plan by one below that.
    const heads = [...sec.querySelectorAll('.eb-mcpt-cell.eb-mcpt-header')]
      .filter(e => vis(e) && e.querySelector('.eb-original-price-wrapper'));
    return { section: g(sec.querySelector('.eb-wrapper-outer')),
      heading: g([...sec.querySelectorAll('.eb-ah-title')].filter(vis)[0]),
      content: (() => { const boxes = cols.filter(vis).map(c => c.getBoundingClientRect());
        if (!boxes.length) return null;
        const l = Math.min(...boxes.map(q => q.x)), rt = Math.max(...boxes.map(q => q.right));
        const t = Math.min(...boxes.map(q => q.top)), bt = Math.max(...boxes.map(q => q.bottom));
        return { w: Math.round(rt - l), h: Math.round(bt - t), x: Math.round(l) }; })(),
      labelCol: vis(cols[0]) ? g(cols[0]) : null,
      plans: cols.slice(1).map(c => vis(c) ? g(c) : null),
      headers: heads.map(h => { const top = h.getBoundingClientRect().top + scrollY
            + parseFloat(getComputedStyle(h).paddingTop);
        const yr = [...h.querySelectorAll('.first-title')].find(e => /yearly/.test(e.textContent));
        return { name: T(h.querySelector('.eb-ah-title .first-title'), top),
                 price: T(h.querySelector('.eb-original-price-wrapper'), top),
                 yearly: T(yr, top), cta: T(h.querySelector('.eb-button-anchor'), top) }; }),
      badge: (() => { const bd = [...sec.querySelectorAll('*')].filter(vis)
          .find(e => /^\s*Popular\s*$/.test(e.textContent) && e.children.length < 3);
        if (!bd) return null; const c = getComputedStyle(bd);
        return { ...g(bd), bg: c.backgroundColor, bd: c.borderColor, bw: c.borderTopWidth, br: c.borderRadius }; })() };
  });
  const m = await mine.evaluate(() => {
    const g = s => { const e = document.querySelector(s); if (!e) return null; const q = e.getBoundingClientRect();
      const st = getComputedStyle(e); if (st.display === 'none') return null;
      return { w: Math.round(q.width), h: Math.round(q.height), x: Math.round(q.x) }; };
    const span = (nodes) => { if (!nodes.length) return null;
      const rs = nodes.map(n => n.getBoundingClientRect());
      const top = Math.min(...rs.map(r => r.top)), bot = Math.max(...rs.map(r => r.bottom));
      return { w: Math.round(rs[0].width), h: Math.round(bot - top), x: Math.round(rs[0].x) }; };
    const labelCells = [...document.querySelectorAll('.pricing__labels .pricing__cell')]
      .filter(n => getComputedStyle(n).display !== 'none');
    const planBoxes = [...document.querySelectorAll('.pricing__plan')].map(pl => {
      if (getComputedStyle(pl).display !== 'contents') { const q = pl.getBoundingClientRect();
        return { w: Math.round(q.width), h: Math.round(q.height), x: Math.round(q.x) }; }
      return span([...pl.querySelectorAll('.pricing__cell')]);
    });
    // Ranges, not block boxes: padding-left shifts the glyphs inside the box,
    // so only a range sees the reference's 5px Enterprise indent.
    const T = (e, top) => { if (!e) return null; const rg = document.createRange(); rg.selectNodeContents(e);
      const q = rg.getBoundingClientRect();
      return { dy: Math.round(q.top + scrollY - top), dx: Math.round(q.x), c: getComputedStyle(e).color }; };
    const heads = [...document.querySelectorAll('.pricing__plan .pricing__cell--header')];
    const headers = heads.map(h => { const top = h.getBoundingClientRect().top + scrollY
          + parseFloat(getComputedStyle(h).paddingTop);
      const cta = h.querySelector('.pricing__cta');
      const q = cta.getBoundingClientRect();
      return { name: T(h.querySelector('.pricing__plan-name'), top),
               price: T(h.querySelector('.pricing__price'), top),
               yearly: T(h.querySelector('.pricing__yearly'), top),
               cta: { dy: Math.round(q.top + scrollY - top), dx: Math.round(q.x),
                      c: getComputedStyle(cta).color } }; });
    const bdEl = document.querySelector('.pricing__badge');
    const bdCS = getComputedStyle(bdEl); const bq = bdEl.getBoundingClientRect();
    const badge = { w: Math.round(bq.width), h: Math.round(bq.height), x: Math.round(bq.x),
      bg: bdCS.backgroundColor, bd: bdCS.borderColor, bw: bdCS.borderTopWidth, br: bdCS.borderRadius };
    return { headers, badge,
      section: g('.pricing'), heading: g('.pricing__heading'),
      content: (() => {
        const cells = [...document.querySelectorAll('.pricing__plan, .pricing__labels')]
          .flatMap(p => getComputedStyle(p).display === 'contents' ? [...p.children] : [p])
          .filter(e => !e.classList.contains('pricing__badge'))
          .map(e => e.getBoundingClientRect()).filter(q => q.width > 0 && q.height > 0);
        if (!cells.length) return null;
        const l = Math.min(...cells.map(q => q.x)), rt = Math.max(...cells.map(q => q.right));
        const t = Math.min(...cells.map(q => q.top)), bt = Math.max(...cells.map(q => q.bottom));
        return { w: Math.round(rt - l), h: Math.round(bt - t), x: Math.round(l) }; })(),
      // The label column is display:none below 1280; report it absent (as the
      // reference does) rather than as a zero-sized box.
      labelCol: (() => { if (!labelCells.length) return null; const b = span(labelCells);
        return b && b.w > 0 && b.h > 0 ? b : null; })(), plans: planBoxes };
  });
  console.log(`\n${w}px`);
  const NAMES = ['Free', 'Professional', 'Growth', 'Enterprise'];
  (r.headers ?? []).forEach((a, i) => {
    const z = m.headers[i]; if (!z) return;
    for (const part of ['name', 'price', 'yearly', 'cta']) {
      const A = a[part], Z = z[part];
      if (!A && !Z) continue;
      if (!A || !Z) { console.log(`  ${NAMES[i]}.${part} ref=${JSON.stringify(A)} mine=${JSON.stringify(Z)} ✗`); worst = 999; continue; }
      const d = [Z.dy - A.dy, Z.dx - A.dx];
      const bad = d.some(v => Math.abs(v) > 2) || A.c !== Z.c;
      console.log(`  ${(NAMES[i] + '.' + part).padEnd(20)} ref +${A.dy}@${A.dx} ${A.c}  mine +${Z.dy}@${Z.dx} ${Z.c}  Δy${d[0]} Δx${d[1]} ${bad ? '✗' : '✓'}`);
      if (bad) worst = Math.max(worst, 3, ...d.map(Math.abs));
    }
  });
  if (r.badge && m.badge) {
    const d = [m.badge.w - r.badge.w, m.badge.h - r.badge.h];
    const paintSame = ['bg', 'bd', 'bw', 'br'].every(k => r.badge[k] === m.badge[k]);
    const bad = d.some(v => Math.abs(v) > 2) || !paintSame;
    console.log(`  ${'badge'.padEnd(20)} ref ${r.badge.w}x${r.badge.h} ${r.badge.bw} ${r.badge.bd} ${r.badge.br}  mine ${m.badge.w}x${m.badge.h} ${m.badge.bw} ${m.badge.bd} ${m.badge.br} ${bad ? '✗' : '✓'}`);
    if (bad) worst = Math.max(worst, 3, ...d.map(Math.abs));
  }
  for (const k of ['section', 'heading', 'content', 'labelCol']) {
    if (!r[k] && !m[k]) { console.log(`  ${k.padEnd(9)} both absent ✓`); continue; }
    if (!r[k] || !m[k]) { console.log(`  ${k.padEnd(9)} ref=${JSON.stringify(r[k])} mine=${JSON.stringify(m[k])} ✗`); worst = 999; continue; }
    const d = ['w','h','x'].map(q => m[k][q] - r[k][q]);
    console.log(`  ${k.padEnd(9)} ref ${r[k].w}x${r[k].h}@${r[k].x}  mine ${m[k].w}x${m[k].h}@${m[k].x}  Δ${d.join(',')} ${d.some(v=>Math.abs(v)>2)?'✗':'✓'}`);
    worst = Math.max(worst, ...d.map(Math.abs));
  }
  for (let i = 0; i < 4; i++) {
    const a = r.plans[i], c = m.plans[i];
    if (!a || !c) { console.log(`  plan[${i}]   ref=${JSON.stringify(a)} mine=${JSON.stringify(c)}`); continue; }
    const d = ['w','h','x'].map(q => c[q] - a[q]);
    console.log(`  plan[${i}]   ref ${a.w}x${a.h}@${a.x}  mine ${c.w}x${c.h}@${c.x}  Δ${d.join(',')} ${d.some(v=>Math.abs(v)>2)?'✗':'✓'}`);
    worst = Math.max(worst, ...d.map(Math.abs));
  }
}
console.log('\nworst:', worst);
await b.close();
