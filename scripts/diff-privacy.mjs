// Diffs /privacy-policy/ geometry AND paint against the live site.
//
// This page is almost entirely prose, so what matters is the column, the
// rhythm between blocks and the type — not a handful of named boxes. Every
// block in the document is compared, in order, by size and by rendered type.
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4321';
const VIEWPORTS = [360, 480, 768, 1024, 1280, 1440, 1920];

const b = await chromium.launch();
const ctx = await b.newContext({ reducedMotion: 'reduce' });
const ref = await ctx.newPage(), mine = await ctx.newPage();

/* `domcontentloaded`, NOT `networkidle`. The live site runs Crisp live chat and
 * the BetterDocs Instant Answer widget, which hold connections open — /docs/
 * stopped reaching networkidle at all and the diff died on a 60s timeout with
 * nothing wrong on either side. Readiness here is the settled page height
 * below, which is the signal that actually made these measurements stable. */
const settle = async (p, u) => {
  await p.goto(u, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 800) { scrollTo(0, y); await new Promise(r => setTimeout(r, 40)); } scrollTo(0, 0); });
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
  await p.waitForTimeout(300);
};

const read = (page, S) => page.evaluate((S) => {
  const cs = (e) => e && getComputedStyle(e);
  const g = (e) => { if (!e) return null; const r = e.getBoundingClientRect();
    return { w: +r.width.toFixed(1), h: +r.height.toFixed(1), x: Math.round(r.x), y: +(r.top + scrollY).toFixed(1) }; };
  /* Glyphs, not boxes, for the title: the two sides centre it differently
   * (the original with an auto margin inside a padded group, this build with
   * an auto margin on the element) and only the words' position is visible. */
  const glyph = (e) => { if (!e) return null; const r = document.createRange(); r.selectNodeContents(e);
    const b = r.getBoundingClientRect();
    return { w: +b.width.toFixed(1), h: +b.height.toFixed(1), x: Math.round(b.x), y: +(b.top + scrollY).toFixed(1) }; };
  /* Read the type off whichever element actually holds the words. The original
   * wraps each heading's text in a <strong>, so the <h3> itself computes to
   * weight 400 while every glyph renders at 700; this build drops the redundant
   * <strong> and puts the 700 on the heading. Comparing the headings themselves
   * would report a difference that does not exist on screen. */
  const hasOwnText = (e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
  const textEl = (e) => { let n = e;
    for (let i = 0; i < 4; i++) { if (hasOwnText(n)) return n;
      const kids = [...n.children]; if (!kids.length) return null; n = kids[0]; }
    return null; };
  const typ = (e) => { const t = e && textEl(e); const c = cs(t); if (!c) return null;
    return { family: c.fontFamily.split(',')[0].replace(/"/g, ''), size: parseFloat(c.fontSize),
      lh: parseFloat(c.lineHeight), weight: c.fontWeight, color: c.color }; };

  const main = document.querySelector(S.main);
  const title = document.querySelector(S.title);
  const body = document.querySelector(S.body);
  const blocks = [...body.children];
  const top = main.getBoundingClientRect().top + scrollY;

  return {
    pageH: document.documentElement.scrollHeight,
    bodyBg: cs(document.body).backgroundColor,
    main: g(main),
    title: { ...glyph(title), y: +(glyph(title).y - top).toFixed(1) },
    titleType: typ(title),
    body: (() => { const v = g(body); return { ...v, y: +(v.y - top).toFixed(1) }; })(),
    /* Every block, measured against the page's own top so a single bad gap is
     * reported where it happens rather than shifting everything after it. */
    blocks: blocks.map((e) => {
      const v = g(e);
      const first = e.tagName === 'UL' || e.tagName === 'OL' ? e.querySelector('li') : e;
      return { tag: e.tagName, ...v, y: +(v.y - top).toFixed(1), typ: typ(first),
        id: e.getAttribute('id') || '', text: e.textContent.replace(/\s+/g, ' ').trim().slice(0, 40) };
    }),
    /* The gap each block carries above it — the theme's block rhythm. */
    gaps: blocks.map((e, i) => i === 0 ? 0
      : +(e.getBoundingClientRect().top - blocks[i - 1].getBoundingClientRect().bottom).toFixed(1)),
  };
}, S);

const REF = { main: 'main', title: '.wp-block-post-title', body: '.entry-content' };
const MINE = { main: 'main.plain', title: '.plain__title', body: '.plain__body' };

let fails = 0, worst = 0;
const cmp = (label, a, c, keys = ['w', 'h', 'x', 'y']) => {
  if (!a || !c) { console.log(`  ${label.padEnd(10)} MISSING ref=${!!a} mine=${!!c}`); fails++; return; }
  const d = keys.map((k) => +(c[k] - a[k]).toFixed(1));
  const bad = d.some((v) => Math.abs(v) > 2);
  if (bad) fails++;
  worst = Math.max(worst, ...d.map(Math.abs));
  console.log(`  ${label.padEnd(10)} ref ${a.w}x${a.h}@${a.x},${a.y}  mine ${c.w}x${c.h}@${c.x},${c.y}  Δ${d.join(',')} ${bad ? '✗' : '✓'}`);
};

for (const w of VIEWPORTS) {
  await ref.setViewportSize({ width: w, height: 900 });
  await mine.setViewportSize({ width: w, height: 900 });
  await settle(ref, 'https://storefaq.io/privacy-policy/');
  await settle(mine, BASE + '/privacy-policy/');
  const r = await read(ref, REF), m = await read(mine, MINE);
  console.log(`\n${w}px  pageH ref ${r.pageH} mine ${m.pageH} Δ${m.pageH - r.pageH}   blocks ref ${r.blocks.length} mine ${m.blocks.length}`);

  cmp('main', r.main, m.main, ['w', 'h', 'x']);
  cmp('title', r.title, m.title);
  /* Height and top only: the original's content block spans the viewport and
   * carries its own inset, while this build's sits inside a padded <main>.
   * Different boxes, same result — which the per-block comparison below proves
   * to the pixel. */
  cmp('body', r.body, m.body, ['h', 'y']);
  /* Font size is compared to 0.01px: a fluid clamp reproduced from measured
   * values lands within four decimal places, and string equality calls that a
   * failure. */
  const sameType = (a, c) => a && c && a.family === c.family && a.weight === c.weight
    && a.color === c.color && Math.abs(a.size - c.size) < 0.01 && Math.abs(a.lh - c.lh) < 0.01;
  const fmt = (t) => t && `${t.family} ${t.size}/${t.lh} ${t.weight} ${t.color}`;
  const tOk = sameType(r.titleType, m.titleType);
  if (!tOk) { fails++; worst = Math.max(worst, 3); }
  console.log(`  titleType ${tOk ? '✓' : `✗\n     ref  ${fmt(r.titleType)}\n     mine ${fmt(m.titleType)}`}`);
  const bgOk = r.bodyBg === m.bodyBg;
  if (!bgOk) { fails++; worst = Math.max(worst, 3); }
  console.log(`  bodyBg    ${bgOk ? '✓' : `✗ ref ${r.bodyBg}  mine ${m.bodyBg}`}`);

  if (r.blocks.length !== m.blocks.length) {
    console.log(`  BLOCK COUNT MISMATCH\n    ref  ${r.blocks.map((e) => e.tag).join(' ')}\n    mine ${m.blocks.map((e) => e.tag).join(' ')}`);
    fails++;
    continue;
  }
  const bad = [];
  r.blocks.forEach((a, i) => {
    const c = m.blocks[i];
    const d = ['w', 'h', 'x', 'y'].map((k) => +(c[k] - a[k]).toFixed(1));
    const geo = d.some((v) => Math.abs(v) > 2);
    const tag = a.tag !== c.tag, type = !sameType(a.typ, c.typ), id = a.id !== c.id, text = a.text !== c.text;
    if (geo || tag || type || id || text) bad.push({ i, a, c, d, tag, type, id, text });
  });
  fails += bad.length;
  bad.forEach(({ i, a, c, d, tag, type, id, text }) => {
    worst = Math.max(worst, ...d.map(Math.abs));
    console.log(`  block[${i}] ${a.tag} "${a.text}"`);
    console.log(`      ref ${a.w}x${a.h}@${a.x},${a.y}  mine ${c.w}x${c.h}@${c.x},${c.y}  Δ${d.join(',')}`);
    if (tag) console.log(`      TAG   ref ${a.tag} mine ${c.tag}`);
    if (id) console.log(`      ID    ref "${a.id}" mine "${c.id}"`);
    if (text) console.log(`      TEXT  ref "${a.text}"\n            mine "${c.text}"`);
    if (type) console.log(`      TYPE  ref ${fmt(a.typ)}\n            mine ${fmt(c.typ)}`);
  });
  console.log(`  blocks    ${bad.length ? bad.length + ' of ' + r.blocks.length + ' differ ✗' : `all ${r.blocks.length} match ✓`}`);
  const gOk = r.gaps.every((v, i) => Math.abs(v - m.gaps[i]) <= 0.5);
  if (!gOk) { fails++; worst = Math.max(worst, 3); }
  console.log(`  gaps      ${gOk ? `all ${r.gaps.length} within 0.5px ✓` : `✗\n     ref  ${r.gaps.join(' ')}\n     mine ${m.gaps.join(' ')}`}`);
}
console.log(`\nfails ${fails}, worst ${worst}px`);
await b.close();
