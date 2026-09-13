// Diffs a docs category page against the live site.
import { chromium } from 'playwright';
const BASE = process.argv[2] ?? 'http://localhost:4321';
const SLUG = process.argv[3] ?? 'getting-started';
const VIEWPORTS = [360, 768, 1024, 1280, 1440, 1920];
const b = await chromium.launch(); const ctx = await b.newContext({ reducedMotion: 'reduce' });
const ref = await ctx.newPage(), mine = await ctx.newPage();
const settle = async (p, u) => {
  await p.goto(u, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 800) { scrollTo(0, y); await new Promise(r => setTimeout(r, 30)); } scrollTo(0, 0);
    await Promise.race([Promise.all([...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => { i.addEventListener('load', r, { once: true }); i.addEventListener('error', r, { once: true }); }))), new Promise((r) => setTimeout(r, 5000))]);
    await document.fonts.ready; let last = -1, stable = 0;
    for (let i = 0; i < 80 && stable < 3; i++) { await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 100))); const h = document.documentElement.scrollHeight; stable = h === last ? stable + 1 : 0; last = h; } });
  await p.waitForTimeout(300);
};
const read = (page, S) => page.evaluate((S) => {
  const q = (s, r = document) => r.querySelector(s); const cs = (e) => e && getComputedStyle(e);
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const g = (e) => { if (!e || !vis(e)) return null; const r = e.getBoundingClientRect(); return { w: +r.width.toFixed(1), h: +r.height.toFixed(1), x: Math.round(r.x), y: +(r.top + scrollY).toFixed(1) }; };
  const glyph = (e) => { if (!e || !vis(e)) return null; const r = document.createRange(); r.selectNodeContents(e); const b = r.getBoundingClientRect(); return { w: +b.width.toFixed(1), h: +b.height.toFixed(1), x: Math.round(b.x), y: +(b.top + scrollY).toFixed(1) }; };
  const hasOwnText = (e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
  const textEl = (e) => hasOwnText(e) ? e : [...e.querySelectorAll('*')].find((n) => hasOwnText(n)) ?? null;
  const typ = (e) => { const t = e && textEl(e); const c = cs(t); return c ? [c.fontFamily.split(',')[0].replace(/"/g, ''), c.fontSize, c.lineHeight, c.fontWeight, c.color].join(' ') : null; };
  const col = (v) => /rgba\([^)]*,\s*0\)$/.test(v) ? 'transparent' : v;
  const paint = (e) => { const c = cs(e); if (!c) return null; const bw = parseFloat(c.borderBottomWidth); return [col(c.backgroundColor), bw > 0 ? bw + 'px ' + c.borderBottomColor : 'none', c.borderRadius, c.padding].join(' | '); };
  const main = q(S.main); const top = main.getBoundingClientRect().top + scrollY;
  const rel = (e, fn = g) => { const v = fn(e); return v && { ...v, y: +(v.y - top).toFixed(1) }; };
  const out = { pageH: document.documentElement.scrollHeight, boxes: {}, type: {}, paint: {} };
  for (const [k, s] of Object.entries(S.boxes)) out.boxes[k] = rel(q(s));
  for (const [k, s] of Object.entries(S.glyphs)) out.boxes[k] = rel(q(s), glyph);
  for (const [k, s] of Object.entries(S.type)) out.type[k] = typ(q(s));
  for (const [k, s] of Object.entries(S.paint)) out.paint[k] = paint(q(s));
  out.items = [...document.querySelectorAll(S.item)].filter(vis).map((e) => ({ box: rel(e), title: rel(q(S.itemTitle, e), glyph), date: rel(q(S.itemDate, e)), excerpt: rel(q(S.itemExcerpt, e)), text: q(S.itemTitle, e)?.textContent.trim().slice(0, 30) }));
  return out;
}, S);
const REF = { main: '.betterdocs-breadcrumb', boxes: { side: '#betterdocs-full-sidebar-left', crumb: '#betterdocs-breadcrumb', head: '.betterdocs-main-category-folder', tile: '.betterdocs-main-category-folder .betterdocs-folder-icon', list: '.betterdocs-title-excerpt-lists' },
  glyphs: { title: '.betterdocs-main-category-folder .betterdocs-category-title', count: '.betterdocs-main-category-folder .betterdocs-sub-category-items-counts span' },
  type: { title: '.betterdocs-main-category-folder .betterdocs-category-title', count: '.betterdocs-main-category-folder .betterdocs-sub-category-items-counts span', itemTitle: '.betterdocs-entry-title a', date: '.update-date', excerpt: '.betterdocs-title-excerpt-list p' },
  paint: { head: '.betterdocs-main-category-folder', tile: '.betterdocs-main-category-folder .betterdocs-folder-icon', item: '.betterdocs-title-excerpt-list', date: '.update-date' },
  item: '.betterdocs-title-excerpt-list', itemTitle: '.betterdocs-entry-title a', itemDate: '.update-date', itemExcerpt: 'p' };
const MINE = { main: '.crumb', boxes: { side: '.dside', crumb: '.crumb', head: '.dcat__head', tile: '.dcat__tile', list: '.dcat__list' },
  glyphs: { title: '.dcat__title', count: '.dcat__count' },
  type: { title: '.dcat__title', count: '.dcat__count', itemTitle: '.dcat__item-title a', date: '.dcat__date', excerpt: '.dcat__excerpt' },
  paint: { head: '.dcat__head', tile: '.dcat__tile', item: '.dcat__item', date: '.dcat__date' },
  item: '.dcat__item', itemTitle: '.dcat__item-title a', itemDate: '.dcat__date', itemExcerpt: '.dcat__excerpt' };
let fails = 0, worst = 0;
const cmp = (label, a, c, indent = '  ') => { if (!a && !c) return; if (!a || !c) { console.log(`${indent}${label.padEnd(9)} MISSING ref=${!!a} mine=${!!c}`); fails++; return; }
  const d = ['w', 'h', 'x', 'y'].map((k) => +(c[k] - a[k]).toFixed(1)); const bad = d.some((v) => Math.abs(v) > 2); if (bad) fails++; worst = Math.max(worst, ...d.map(Math.abs));
  console.log(`${indent}${label.padEnd(9)} ref ${a.w}x${a.h}@${a.x},${a.y}  mine ${c.w}x${c.h}@${c.x},${c.y}  Δ${d.join(',')} ${bad ? '✗' : '✓'}`); };
const cmpS = (label, a, c, indent = '  ') => { if (a === null && c === null) return; const ok = a === c; if (!ok) { fails++; worst = Math.max(worst, 3); } console.log(`${indent}${label.padEnd(9)} ${ok ? '✓' : `✗\n${indent}   ref  ${a}\n${indent}   mine ${c}`}`); };
for (const w of VIEWPORTS) {
  await ref.setViewportSize({ width: w, height: 900 }); await mine.setViewportSize({ width: w, height: 900 });
  await settle(ref, `https://storefaq.io/docs-category/${SLUG}/`); await settle(mine, `${BASE}/docs-category/${SLUG}/`);
  const r = await read(ref, REF), m = await read(mine, MINE);
  console.log(`\n${w}px  pageH ref ${r.pageH} mine ${m.pageH} Δ${m.pageH - r.pageH}  items ref ${r.items.length} mine ${m.items.length}`);
  for (const k of Object.keys(REF.boxes)) cmp(k, r.boxes[k], m.boxes[k]);
  for (const k of Object.keys(REF.glyphs)) cmp(k, r.boxes[k], m.boxes[k]);
  for (const k of Object.keys(r.type)) cmpS('type.' + k, r.type[k], m.type[k]);
  for (const k of Object.keys(r.paint)) cmpS('paint.' + k, r.paint[k], m.paint[k]);
  if (r.items.length !== m.items.length) { fails++; console.log('  ITEM COUNT MISMATCH'); continue; }
  r.items.forEach((a, i) => { const c = m.items[i]; console.log(`  item[${i}] "${a.text}"${a.text !== c.text ? ` ≠ "${c.text}" ✗` : ''}`); if (a.text !== c.text) fails++;
    for (const k of ['box', 'title', 'date', 'excerpt']) cmp(k, a[k], c[k], '    '); });
}
console.log(`\nfails ${fails}, worst ${worst}px`); await b.close();
