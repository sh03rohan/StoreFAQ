// Diffs /blog/ against the live site: hero card, search box, category tabs,
// the post grid (every card), the pager — geometry and paint.
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4321';
const VIEWPORTS = [360, 768, 1024, 1280, 1440, 1920];

const b = await chromium.launch();
const ctx = await b.newContext({ reducedMotion: 'reduce' });
const ref = await ctx.newPage(), mine = await ctx.newPage();

const settle = async (p, u) => {
  await p.goto(u, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 800) { scrollTo(0, y); await new Promise(r => setTimeout(r, 30)); } scrollTo(0, 0); });
  await p.evaluate(async () => {
    await Promise.race([Promise.all([...document.images].filter((i) => !i.complete)
      .map((i) => new Promise((r) => { i.addEventListener('load', r, { once: true }); i.addEventListener('error', r, { once: true }); }))),
      new Promise((r) => setTimeout(r, 5000))]);
    await document.fonts.ready;
    let last = -1, stable = 0;
    for (let i = 0; i < 80 && stable < 3; i++) {
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 100)));
      const h = document.documentElement.scrollHeight; stable = h === last ? stable + 1 : 0; last = h;
    }
  });
  await p.waitForTimeout(300);
};

const read = (page, S) => page.evaluate((S) => {
  const q = (s, r = document) => r.querySelector(s);
  const cs = (e) => e && getComputedStyle(e);
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const g = (e) => { if (!e || !vis(e)) return null; const r = e.getBoundingClientRect();
    return { w: +r.width.toFixed(1), h: +r.height.toFixed(1), x: Math.round(r.x), y: +(r.top + scrollY).toFixed(1) }; };
  const glyph = (e) => { if (!e || !vis(e)) return null; const r = document.createRange(); r.selectNodeContents(e); const b = r.getBoundingClientRect();
    return { w: +b.width.toFixed(1), h: +b.height.toFixed(1), x: Math.round(b.x), y: +(b.top + scrollY).toFixed(1) }; };
  const hasOwnText = (e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
  const textEl = (e) => hasOwnText(e) ? e : [...e.querySelectorAll('*')].find((n) => hasOwnText(n)) ?? null;
  const typ = (e) => { const t = e && textEl(e); const c = cs(t); if (!c) return null;
    return [c.fontFamily.split(',')[0].replace(/"/g, ''), c.fontSize, c.lineHeight, c.fontWeight, c.color].join(' '); };
  const col = (v) => /rgba\([^)]*,\s*0\)$/.test(v) ? 'transparent' : v;
  const paint = (e) => { const c = cs(e); if (!c) return null; const bw = parseFloat(c.borderTopWidth);
    return [col(c.backgroundColor), bw > 0 ? bw + 'px ' + c.borderTopColor : 'none', c.borderRadius].join(' | '); };

  const main = q(S.main);
  const top = main.getBoundingClientRect().top + scrollY;
  const rel = (e, fn = g) => { const v = fn(e); return v && { ...v, y: +(v.y - top).toFixed(1) }; };

  const out = { pageH: document.documentElement.scrollHeight, boxes: {}, type: {}, paint: {} };
  for (const [k, sel] of Object.entries(S.boxes)) out.boxes[k] = rel(q(sel));
  for (const [k, sel] of Object.entries(S.glyphs)) out.boxes[k] = rel(q(sel), glyph);
  for (const [k, sel] of Object.entries(S.type)) out.type[k] = typ(q(sel));
  for (const [k, sel] of Object.entries(S.paint)) out.paint[k] = paint(q(sel));
  const ph = q(S.placeholder); if (ph) { const c = cs(ph); const pc = ph.tagName === 'INPUT' ? getComputedStyle(ph, '::placeholder').color : c.color;
    out.type.placeholder = [c.fontFamily.split(',')[0].replace(/"/g, ''), c.fontSize, c.fontWeight, pc].join(' '); }
  /* The gradient and the corner blur: the original paints them on two
   * elements, this build on one. Both layers are read and the blur is
   * compared by file name. */
  const layers = [q(S.boxes.card), q(S.overlay)].filter(Boolean).map((e) => cs(e).backgroundImage).join(', ');
  out.paint.gradient = [...new Set(layers.split(/,\s*(?=url|linear)/).filter((l) => l && l !== 'none'))]
    .map((l) => l.replace(/url\("[^"]*\/([^/"]+)"\)/, 'url($1)')).sort().join(' + ');
  const act = q(S.activeTab); out.paint.activeTab = act && [cs(act).color, cs(act).borderBottomWidth, cs(act).borderBottomColor].join(' ');
  const glass = q(S.glass); out.paint.glass = glass && [cs(glass).fill === 'rgb(0, 0, 0)' ? cs(glass).color : cs(glass).fill].join(' ');
  const img = q(S.thumb); out.paint.thumb = img && [cs(img).objectFit, cs(img).borderRadius].join(' ');
  out.cards = [...document.querySelectorAll(S.card)].filter(vis).map((e) => ({ ...rel(e), img: rel(q(S.cardImg, e)), title: rel(q(S.cardTitle, e), glyph) }));
  out.tabs = [...document.querySelectorAll(S.tab)].filter(vis).map((e) => rel(e, glyph));
  out.pager = [...document.querySelectorAll(S.pagerItem)].filter(vis).map((e) => rel(e));
  return out;
}, S);

const REF = {
  main: '.eb-post-grid-wrapper',
  boxes: { hero: 'main > div > .wp-block-essential-blocks-wrapper', card: '.eb-wrapper-4nrb5',
    form: 'form.eb-adv-searchform', field: '.eb-adv-search-input-wrap', input: '.eb-adv-search-input-wrap input', btn: '.adv-search-btn', glass: '.eb-adv-search-icon',
    heroImg: '.eb-img-style-rounded img', filter: '.eb-post-grid-category-filter', filterList: '.ebpg-category-filter-list',
    grid: '.eb-post-grid-posts-wrapper', pager: '.ebpg-pagination', list: '.eb-post-grid-wrapper' },
  glyphs: { title: 'h1 .first-title' },
  type: { title: 'h1 .first-title', tab: '.ebpg-category-filter-list-item:not(.active)', activeTab: '.ebpg-category-filter-list-item.active',
    btn: '.adv-search-btn', cardTitle: '.ebpg-entry-title a', pager: '.ebpg-pagination-item.show:not(.active)', pagerActive: '.ebpg-pagination-item.active' },
  paint: { card: '.eb-wrapper-4nrb5', form: 'form.eb-adv-searchform', field: '.eb-adv-search-input-wrap', btn: '.adv-search-btn', filter: '.eb-post-grid-category-filter',
    pager: '.ebpg-pagination-item.show:not(.active)', pagerActive: '.ebpg-pagination-item.active' },
  overlay: '.eb-row-8f7bj',
  placeholder: '.eb-adv-search-input-wrap input', activeTab: '.ebpg-category-filter-list-item.active', glass: '.eb-adv-search-icon', thumb: '.ebpg-entry-thumbnail img',
  card: '.ebpg-grid-post', cardImg: '.ebpg-entry-thumbnail img', cardTitle: '.ebpg-entry-title a', tab: '.ebpg-category-filter-list-item',
  pagerItem: '.ebpg-pagination button.show, .ebpg-pagination button[class*="item-"]',
};
const MINE = {
  main: '.blog-list > div',
  boxes: { hero: '.blog-hero', card: '.blog-hero__card',
    form: '.blog-search', field: '.blog-search__field', input: '.blog-search__input', btn: '.blog-search__submit', glass: '.blog-search__icon',
    heroImg: '.blog-hero__img', filter: '.cattabs', filterList: '.cattabs__list',
    grid: '.pgrid', pager: '.pager', list: '.blog-list > div' },
  glyphs: { title: '.blog-hero__title' },
  type: { title: '.blog-hero__title', tab: '.cattabs__link:not(.is-active)', activeTab: '.cattabs__link.is-active',
    btn: '.blog-search__submit', cardTitle: '.pcard__link', pager: 'a.pager__item:not(.pager__item--arrow)', pagerActive: '.pager__item.is-active' },
  paint: { card: '.blog-hero__card', form: '.blog-search', field: '.blog-search__field', btn: '.blog-search__submit', filter: '.cattabs',
    pager: 'a.pager__item:not(.pager__item--arrow)', pagerActive: '.pager__item.is-active' },
  overlay: '.blog-hero__card',
  placeholder: '.blog-search__input', activeTab: '.cattabs__link.is-active', glass: '.blog-search__icon', thumb: '.pcard__img',
  card: '.pcard', cardImg: '.pcard__img', cardTitle: '.pcard__link', tab: '.cattabs__link',
  pagerItem: '.pager__item',
};

let fails = 0, worst = 0;
const cmp = (label, a, c, keys = ['w', 'h', 'x', 'y'], indent = '  ') => {
  if (!a && !c) return;
  if (!a || !c) { console.log(`${indent}${label.padEnd(10)} MISSING ref=${!!a} mine=${!!c}`); fails++; return; }
  const d = keys.map((k) => +(c[k] - a[k]).toFixed(1));
  const bad = d.some((v) => Math.abs(v) > 2);
  if (bad) fails++;
  worst = Math.max(worst, ...d.map(Math.abs));
  console.log(`${indent}${label.padEnd(10)} ref ${a.w}x${a.h}@${a.x},${a.y}  mine ${c.w}x${c.h}@${c.x},${c.y}  Δ${d.join(',')} ${bad ? '✗' : '✓'}`);
};
const cmpStr = (label, a, c, indent = '  ') => {
  if (a === null && c === null) return;
  const ok = a === c; if (!ok) { fails++; worst = Math.max(worst, 3); }
  console.log(`${indent}${label.padEnd(10)} ${ok ? '✓' : `✗\n${indent}   ref  ${a}\n${indent}   mine ${c}`}`);
};
/* A title's glyph range is as wide as its widest LINE, and where a two-line
 * title breaks can move by a word on sub-pixel font metrics without the
 * height changing. Width on titles is tolerated at 5px; everything else 2. */
const cmpList = (label, ra, ma, pick = (e) => e, widthTol = 2) => {
  const bad = [];
  if (ra.length !== ma.length) { fails++; console.log(`  ${label.padEnd(10)} COUNT ref ${ra.length} mine ${ma.length} ✗`); }
  for (let i = 0; i < Math.min(ra.length, ma.length); i++) { const a = pick(ra[i]), c = pick(ma[i]); if (!a && !c) continue;
    if (!a || !c) { bad.push([i, a, c, ['?']]); continue; }
    const d = ['w', 'h', 'x', 'y'].map((k) => +(c[k] - a[k]).toFixed(1)); worst = Math.max(worst, ...d.map(Math.abs));
    if (d.some((v, j) => Math.abs(v) > (j === 0 ? widthTol : 2))) bad.push([i, a, c, d]); }
  fails += bad.length;
  console.log(`  ${label.padEnd(10)} ${bad.length ? bad.length + ' of ' + Math.min(ra.length, ma.length) + ' differ ✗' : `all ${ra.length} match ✓`}`);
  for (const [i, a, c, d] of bad.slice(0, 5)) console.log(`    [${i}] ref ${a ? `${a.w}x${a.h}@${a.x},${a.y}` : 'none'} mine ${c ? `${c.w}x${c.h}@${c.x},${c.y}` : 'none'} Δ${d.join(',')}`);
};

for (const w of VIEWPORTS) {
  await ref.setViewportSize({ width: w, height: 900 }); await mine.setViewportSize({ width: w, height: 900 });
  await settle(ref, 'https://storefaq.io/blog/'); await settle(mine, `${BASE}/blog/`);
  const r = await read(ref, REF), m = await read(mine, MINE);
  console.log(`\n${w}px  pageH ref ${r.pageH} mine ${m.pageH} Δ${m.pageH - r.pageH}`);
  for (const k of Object.keys(r.boxes)) cmp(k, r.boxes[k], m.boxes[k]);
  for (const k of Object.keys(r.type)) cmpStr('type.' + k, r.type[k], m.type[k]);
  for (const k of Object.keys(r.paint)) cmpStr('paint.' + k, r.paint[k], m.paint[k]);
  cmpList('cards', r.cards, m.cards);
  cmpList('cardImgs', r.cards, m.cards, (c) => c.img);
  cmpList('cardTitles', r.cards, m.cards, (c) => c.title, 5);
  cmpList('tabs', r.tabs, m.tabs);
  cmpList('pager', r.pager, m.pager);
}
console.log(`\nfails ${fails}, worst ${worst}px`);
await b.close();
