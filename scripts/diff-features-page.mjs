/* Geometry + paint diff for /features/: the page header, the lead block,
 * every one of the eleven cards, and the section bands.
 *
 * Both sides measure text with a Range where padding shifts glyphs inside a
 * box, and paint is read per card — the two things the pricing diff was
 * missing when it let a whole column's offset through.
 */
import { chromium } from 'playwright';

const b = await chromium.launch();
const ctx = await b.newContext();
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
  await p.waitForTimeout(900);
};

const readRef = () => {
  const vis = e => { const q = e.getBoundingClientRect(); return q.width > 0 && q.height > 0; };
  const B = e => { if (!e) return null; const q = e.getBoundingClientRect(); return { w: Math.round(q.width), h: Math.round(q.height), x: Math.round(q.x), y: Math.round(q.top + scrollY) }; };
  // Range, not the element box: some of these are blocks and some are inline
  // spans, and only a range reports where the glyphs actually start on both.
  const T = e => { if (!e) return null; const r = document.createRange(); r.selectNodeContents(e);
    const q = r.getBoundingClientRect();
    return { y: Math.round(q.top + scrollY), x: Math.round(q.x), c: getComputedStyle(e).color }; };
  const cs = e => getComputedStyle(e);
  const secs = [...document.querySelectorAll('main .wp-block-essential-blocks-wrapper')].filter(e => {
    const q = e.getBoundingClientRect();
    return q.width >= 100 && q.height >= 40 && !e.parentElement?.closest('.wp-block-essential-blocks-wrapper');
  });
  const head = secs[0], list = secs[1], faq = secs[2];
  const rows = [...list.querySelectorAll('.eb-row-root-container')].filter(vis);
  const leadCols = [...rows[0].querySelectorAll(':scope > .eb-row-wrapper > .eb-row-inner > *')].filter(vis);
  const cards = [];
  for (let i = 1; i < rows.length; i++)
    for (const c of [...rows[i].querySelectorAll(':scope > .eb-row-wrapper > .eb-row-inner > *')].filter(vis)) {
      const o = [...c.querySelectorAll('.eb-wrapper-outer')].filter(vis);
      if (o.length < 2) continue;
      const img = [...c.querySelectorAll('img')].filter(vis)[0];
      cards.push({ shell: B(o[0]), band: B(o[1]), img: B(img),
        title: T(c.querySelector('.contents-wrapper .title')),
        desc: T(c.querySelector('.contents-wrapper .description')),
        link: T(c.querySelector('.eb-button-anchor')),
        paint: (x => ({ bg: cs(o[1]).backgroundColor, bandRule: cs(o[1]).borderBottomWidth + ' ' + cs(o[1]).borderBottomColor,
          bd: x.borderColor, bw: x.borderTopWidth, br: x.borderTopLeftRadius }))(cs(o[0])) });
    }
  return {
    head: B(head.querySelector('.eb-wrapper-outer')),
    headTitle: T([...head.querySelectorAll('.first-title')].filter(vis)[0]),
    headSub: T([...head.querySelectorAll('.eb-ah-subtitle')].filter(vis)[0]),
    headCol: B([...head.querySelectorAll('.eb-column-wrapper')].filter(vis)[0]),
    list: B(list.querySelector('.eb-wrapper-outer')),
    lead: B(rows[0]), leadText: B(leadCols[0]), leadMedia: B(leadCols[1]),
    leadTitle: T([...leadCols[0].querySelectorAll('.first-title')].filter(vis)[0]),
    leadSub: T([...leadCols[0].querySelectorAll('.eb-ah-subtitle')].filter(vis)[0]),
    leadSwoosh: B([...leadCols[0].querySelectorAll('img')].filter(vis)[0]),
    leadLink: T([...leadCols[0].querySelectorAll('.eb-button-anchor')].filter(vis)[0]),
    leadImg: B([...leadCols[1].querySelectorAll('img')].filter(vis)[0]),
    faq: B(faq.querySelector('.eb-wrapper-outer')),
    // Paint on the lead block. A geometry-only diff passed this section while
    // the whole lead was missing its green ground and its sparkle.
    leadPaint: (x => ({ bg: x.backgroundColor, br: x.borderTopLeftRadius }))(cs(rows[0])),
    // `hasImage`, not the filename: assets are renamed in the migration, so
    // comparing names would fail by construction. Position and size still are.
    leadMediaPaint: (x => ({ hasImage: x.backgroundImage !== 'none',
      bp: x.backgroundPosition, bs: x.backgroundSize }))(cs([...leadCols[1].querySelectorAll('.eb-advanced-image-wrapper')].filter(vis)[0])),
    cards,
  };
};

const readMine = () => {
  const B = e => { if (!e) return null; const q = e.getBoundingClientRect(); return { w: Math.round(q.width), h: Math.round(q.height), x: Math.round(q.x), y: Math.round(q.top + scrollY) }; };
  const T = e => { if (!e) return null; const r = document.createRange(); r.selectNodeContents(e);
    const q = r.getBoundingClientRect();
    return { y: Math.round(q.top + scrollY), x: Math.round(q.x), c: getComputedStyle(e).color }; };
  const cs = e => getComputedStyle(e);
  return {
    head: B(document.querySelector('.page-head')),
    headTitle: T(document.querySelector('.page-head__title')),
    headSub: T(document.querySelector('.page-head__sub')),
    headCol: B(document.querySelector('.page-head__col')),
    list: B(document.querySelector('.features-list')),
    lead: B(document.querySelector('.flead')),
    leadText: B(document.querySelector('.flead__text')),
    leadMedia: B(document.querySelector('.flead__media')),
    leadTitle: T(document.querySelector('.flead__title')),
    leadSub: T(document.querySelector('.flead__sub')),
    leadSwoosh: B(document.querySelector('.flead__swoosh img')),
    leadLink: T(document.querySelector('.flead .learn-more')),
    leadImg: B(document.querySelector('.flead__media img')),
    faq: B(document.querySelector('.faq')),
    leadPaint: (x => ({ bg: x.backgroundColor, br: x.borderTopLeftRadius }))(cs(document.querySelector('.flead'))),
    leadMediaPaint: (x => ({ hasImage: x.backgroundImage !== 'none',
      bp: x.backgroundPosition, bs: x.backgroundSize }))(cs(document.querySelector('.flead__media'))),
    cards: [...document.querySelectorAll('.fcard')].map(c => ({
      shell: B(c), band: B(c.querySelector('.fcard__band')), img: B(c.querySelector('.fcard__band img')),
      title: T(c.querySelector('.fcard__title')), desc: T(c.querySelector('.fcard__desc')),
      link: T(c.querySelector('.learn-more')),
      paint: (x => ({ bg: cs(c.querySelector('.fcard__band')).backgroundColor,
        bandRule: cs(c.querySelector('.fcard__band')).borderBottomWidth + ' ' + cs(c.querySelector('.fcard__band')).borderBottomColor,
        bd: x.borderColor, bw: x.borderTopWidth, br: x.borderTopLeftRadius }))(cs(c)),
    })),
  };
};

const BOXES = ['head', 'headCol', 'list', 'lead', 'leadText', 'leadMedia', 'leadSwoosh', 'leadImg', 'faq'];
const TEXTS = ['headTitle', 'headSub', 'leadTitle', 'leadSub', 'leadLink'];
let worst = 0;
for (const w of [360, 480, 768, 1024, 1280, 1440, 1920]) {
  await ref.setViewportSize({ width: w, height: 900 });
  await mine.setViewportSize({ width: w, height: 900 });
  await settle(ref, 'https://storefaq.io/features/');
  await settle(mine, (process.env.LOCAL ?? 'http://localhost:4321') + '/features/');
  const r = await ref.evaluate(readRef), m = await mine.evaluate(readMine);
  console.log(`\n${w}px`);
  const base = k => k === 'head' ? 0 : (r.head ? r.head.y : 0);
  const box = (k, a, z) => {
    if (!a || !z) { console.log(`  ${k.padEnd(11)} ref=${JSON.stringify(a)} mine=${JSON.stringify(z)} ✗`); worst = 999; return; }
    const dy = (z.y - m.head.y) - (a.y - r.head.y);
    const d = [z.w - a.w, z.h - a.h, z.x - a.x, dy];
    const bad = d.some(v => Math.abs(v) > 2);
    console.log(`  ${k.padEnd(11)} ref ${a.w}x${a.h}@${a.x}  mine ${z.w}x${z.h}@${z.x}  Δw${d[0]} Δh${d[1]} Δx${d[2]} Δy${d[3]} ${bad ? '✗' : '✓'}`);
    worst = Math.max(worst, ...d.map(Math.abs));
  };
  const txt = (k, a, z) => {
    if (!a || !z) { console.log(`  ${k.padEnd(11)} ref=${JSON.stringify(a)} mine=${JSON.stringify(z)} ✗`); worst = 999; return; }
    const dy = (z.y - m.head.y) - (a.y - r.head.y);
    const d = [z.x - a.x, dy];
    const bad = d.some(v => Math.abs(v) > 2) || a.c !== z.c;
    console.log(`  ${k.padEnd(11)} ref @${a.x} ${a.c}  mine @${z.x} ${z.c}  Δx${d[0]} Δy${d[1]} ${bad ? '✗' : '✓'}`);
    if (bad) worst = Math.max(worst, 3, ...d.map(Math.abs));
  };
  for (const k of BOXES) box(k, r[k], m[k]);
  for (const k of TEXTS) txt(k, r[k], m[k]);
  for (const k of ['leadPaint', 'leadMediaPaint']) {
    const same = JSON.stringify(r[k]) === JSON.stringify(m[k]);
    console.log(`  ${k.padEnd(11)} ${same ? '✓' : '✗ ref ' + JSON.stringify(r[k]) + ' mine ' + JSON.stringify(m[k])}`);
    if (!same) worst = Math.max(worst, 3);
  }
  console.log(`  cards       ref ${r.cards.length}  mine ${m.cards.length} ${r.cards.length === m.cards.length ? '✓' : '✗'}`);
  if (r.cards.length !== m.cards.length) worst = 999;
  r.cards.forEach((a, i) => {
    const z = m.cards[i]; if (!z) return;
    for (const part of ['shell', 'band', 'img']) box(`c${i}.${part}`, a[part], z[part]);
    for (const part of ['title', 'desc', 'link']) txt(`c${i}.${part}`, a[part], z[part]);
    const same = JSON.stringify(a.paint) === JSON.stringify(z.paint);
    if (!same) { console.log(`  c${i}.paint   ref ${JSON.stringify(a.paint)} mine ${JSON.stringify(z.paint)} ✗`); worst = Math.max(worst, 3); }
  });
}
console.log('\nworst:', worst);
await b.close();
