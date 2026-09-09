/* Geometry + paint diff for the Home FAQ section: the cream card, both
 * columns, and every accordion item (open and closed) with its header,
 * title, icon and panel. */
import { chromium } from 'playwright';

const b = await chromium.launch();
/* `reducedMotion: 'reduce'` so the entrance animations never run here.
 * Every element is then at its final position from first paint, which is
 * what these measurements are about — and it exercises the accessibility
 * path at the same time. */
const ctx = await b.newContext({ reducedMotion: 'reduce' });
const ref = await ctx.newPage(), mine = await ctx.newPage();
const settle = async (p, u) => {
  await p.goto(u, { waitUntil: 'networkidle', timeout: 60000 });
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); } scrollTo(0, 0); });
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
  await p.waitForTimeout(800);
};

const readRef = () => {
  const bx = e => { if (!e) return null; const q = e.getBoundingClientRect(); return { w: Math.round(q.width), h: Math.round(q.height), x: Math.round(q.x), y: Math.round(q.top + scrollY) }; };
  const cs = e => getComputedStyle(e);
  const acc = document.querySelector('.eb-accordion-container');
  const row = acc.closest('.eb-row-inner');
  const wraps = []; for (let e = acc; (e = e.closest('.eb-wrapper-outer')); e = e.parentElement) wraps.push(e);
  const items = [...acc.querySelectorAll('.eb-accordion-wrapper')];
  const fig = row.querySelector('.eb-advanced-image-wrapper');
  return {
    section: bx(wraps[wraps.length - 1]), card: bx(wraps[0]), row: bx(row),
    intro: bx(row.children[0]), list: bx(acc),
    title: bx(row.querySelector('.eb-infobox-wrapper .title')),
    sub: bx(row.querySelector('.eb-infobox-wrapper .description')),
    swoosh: cs(fig.parentElement).display === 'none' ? null : bx(fig.querySelector('img')),
    cardPaint: (c => ({ bg: c.backgroundColor, br: c.borderTopLeftRadius, pad: c.padding }))(cs(wraps[0])),
    items: items.map(bx),
    heads: items.map(e => bx(e.querySelector('.eb-accordion-title-wrapper'))),
    titles: items.map(e => bx(e.querySelector('.eb-accordion-title'))),
    icons: items.map(e => bx(e.querySelector('.eb-accordion-icon'))),
    panels: items.map(e => { const c = e.querySelector('.eb-accordion-content'); return cs(e.querySelector('.eb-accordion-content-wrapper')).display === 'none' ? null : bx(c); }),
    paras: items.map(e => { const c = e.querySelector('.eb-accordion-content-wrapper'); return cs(c).display === 'none' ? null : bx(e.querySelector('.eb-accordion-content p')); }),
    itemPaint: items.map(e => (c => ({ bg: c.backgroundColor, bd: c.borderColor, bw: c.borderTopWidth, br: c.borderTopLeftRadius }))(cs(e))),
    headPaint: items.map(e => (c => ({ bg: c.backgroundColor, pad: c.padding }))(cs(e.querySelector('.eb-accordion-title-wrapper')))),
    panelPaint: items.map(e => (c => ({ bg: c.backgroundColor, pad: c.padding }))(cs(e.querySelector('.eb-accordion-content')))),
    textPaint: items.map(e => ({
      title: cs(e.querySelector('.eb-accordion-title')).color,
      icon: cs(e.querySelector('.eb-accordion-icon')).color,
      para: cs(e.querySelector('.eb-accordion-content p')).color,
    })),
  };
};

const readMine = () => {
  const bx = e => { if (!e) return null; const q = e.getBoundingClientRect(); return { w: Math.round(q.width), h: Math.round(q.height), x: Math.round(q.x), y: Math.round(q.top + scrollY) }; };
  const cs = e => getComputedStyle(e);
  const sec = document.querySelector('.faq');
  const items = [...sec.querySelectorAll('.faq__item')];
  const sw = sec.querySelector('.faq__swoosh');
  return {
    section: bx(sec), card: bx(sec.querySelector('.faq__card')), row: bx(sec.querySelector('.faq__row')),
    intro: bx(sec.querySelector('.faq__intro')), list: bx(sec.querySelector('.faq__list')),
    title: bx(sec.querySelector('.faq__title')), sub: bx(sec.querySelector('.faq__sub')),
    swoosh: cs(sw).display === 'none' ? null : bx(sw.querySelector('img')),
    cardPaint: (c => ({ bg: c.backgroundColor, br: c.borderTopLeftRadius, pad: c.padding }))(cs(sec.querySelector('.faq__card'))),
    items: items.map(bx),
    heads: items.map(e => bx(e.querySelector('.faq__q'))),
    titles: items.map(e => bx(e.querySelector('.faq__q-title'))),
    icons: items.map(e => bx(e.querySelector('.faq__icon'))),
    panels: items.map(e => e.open ? bx(e.querySelector('.faq__a')) : null),
    paras: items.map(e => e.open ? bx(e.querySelector('.faq__a p')) : null),
    itemPaint: items.map(e => (c => ({ bg: c.backgroundColor, bd: c.borderColor, bw: c.borderTopWidth, br: c.borderTopLeftRadius }))(cs(e))),
    headPaint: items.map(e => (c => ({ bg: c.backgroundColor, pad: c.padding }))(cs(e.querySelector('.faq__q')))),
    panelPaint: items.map(e => (c => ({ bg: c.backgroundColor, pad: c.padding }))(cs(e.querySelector('.faq__a')))),
    textPaint: items.map(e => ({
      title: cs(e.querySelector('.faq__q-title')).color,
      icon: cs(e.querySelector('.faq__icon svg')).fill,
      para: cs(e.querySelector('.faq__a p')).color,
    })),
  };
};

const SINGLE = ['section', 'card', 'row', 'intro', 'list', 'title', 'sub', 'swoosh'];
const LISTS = ['items', 'heads', 'titles', 'icons', 'panels', 'paras'];
// The reference title/sub are block boxes but the accordion h3 is shrink-to-fit.
const INLINE = new Set(['titles']);
let worst = 0;
for (const w of [360, 480, 768, 1024, 1280, 1440, 1920]) {
  await ref.setViewportSize({ width: w, height: 900 });
  await mine.setViewportSize({ width: w, height: 900 });
  await settle(ref, 'https://storefaq.io/');
  await settle(mine, process.env.LOCAL ?? 'http://localhost:4321/');
  const r = await ref.evaluate(readRef), m = await mine.evaluate(readMine);
  console.log(`\n${w}px`);
  const line = (k, a, z) => {
    if (a === null && z === null) { console.log(`  ${k.padEnd(9)} both absent ✓`); return; }
    if (!a || !z) { console.log(`  ${k.padEnd(9)} ref=${JSON.stringify(a)} mine=${JSON.stringify(z)} ✗`); worst = 999; return; }
    const dy = (z.y - m.section.y) - (a.y - r.section.y);
    const d = [z.w - a.w, z.h - a.h, z.x - a.x, dy];
    const bad = d.some(v => Math.abs(v) > 2);
    console.log(`  ${k.padEnd(9)} ref ${a.w}x${a.h}@${a.x}  mine ${z.w}x${z.h}@${z.x}  Δw${d[0]} Δh${d[1]} Δx${d[2]} Δy${d[3]} ${bad ? '✗' : '✓'}`);
    worst = Math.max(worst, ...d.map(Math.abs));
  };
  for (const k of SINGLE) line(k, r[k], m[k]);
  for (const k of LISTS) r[k].forEach((v, i) => line(`${k}${i}`, v, m[k][i]));
  for (const k of ['cardPaint', 'itemPaint', 'headPaint', 'panelPaint', 'textPaint']) {
    const same = JSON.stringify(r[k]) === JSON.stringify(m[k]);
    console.log(`  ${k.padEnd(9)} ${same ? '✓' : '✗\n     ref  ' + JSON.stringify(r[k]) + '\n     mine ' + JSON.stringify(m[k])}`);
    if (!same) worst = Math.max(worst, 3);
  }
}
console.log('\nworst:', worst);
await b.close();
