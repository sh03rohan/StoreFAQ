import { chromium } from 'playwright';
const b = await chromium.launch(); const ctx = await b.newContext();
const ref = await ctx.newPage(), mine = await ctx.newPage();
const settle = async (p, u) => { await p.goto(u, { waitUntil: 'networkidle', timeout: 60000 });
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise(r => setTimeout(r, 50)); } scrollTo(0, 0); });
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
    return { section: g(sec.querySelector('.eb-wrapper-outer')),
      heading: g([...sec.querySelectorAll('.first-title')].filter(vis)[0]),
      content: g(sec.querySelector('.eb-mcpt-content')),
      labelCol: vis(cols[0]) ? g(cols[0]) : null,
      plans: cols.slice(1).map(c => vis(c) ? g(c) : null) };
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
    return { section: g('.pricing'), heading: g('.pricing__heading'), content: g('.pricing__table'),
      labelCol: labelCells.length ? span(labelCells) : null, plans: planBoxes };
  });
  console.log(`\n${w}px`);
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
