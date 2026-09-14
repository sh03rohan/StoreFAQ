// Diffs a blog post against the live site: the hero, the two-column body,
// every block of the article, the author card, the recent-posts grid and the
// four sidebar widgets — geometry and paint.
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4321';
const SLUG = process.argv[3] ?? 'best-shopify-faq-apps';
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
  const qa = (s, r = document) => [...r.querySelectorAll(s)];
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
  const hero = q(S.boxes.hero); out.paint.heroGradient = cs(hero).backgroundImage.replace(/url\("[^"]*\/([^/"]+)"\)/, 'url($1)');
  const hb = getComputedStyle(hero, '::before'); if (hb.content !== 'none' && hb.backgroundImage !== 'none') out.paint.heroGradient = hb.backgroundImage.replace(/url\("[^"]*\/([^/"]+)"\)/, 'url($1)') + ', ' + out.paint.heroGradient;
  const hi = q(S.boxes.heroImg); out.paint.heroImg = hi && [cs(hi).objectFit, cs(hi).borderRadius].join(' ');
  const act = q(S.activeTab); out.paint.activeTab = act && [cs(act).color, cs(act).borderBottomWidth, cs(act).borderBottomColor].join(' ');
  const tab = q(S.tab); out.paint.tab = tab && [cs(tab).color, cs(tab).borderBottomWidth, cs(tab).borderBottomColor].join(' ');
  const sub = q(S.subItem); out.paint.subRule = sub && (() => { const c = getComputedStyle(sub, '::before'); return [c.width, c.backgroundColor].join(' '); })();
  const td = q(S.body + ' td'); out.paint.td = td && [cs(td).borderTopWidth, cs(td).borderTopColor, cs(td).padding].join(' ');
  const link = q(S.body + ' a'); out.paint.proseLink = link && [cs(link).textDecorationLine, cs(link).color].join(' ');
  const av = q(S.avatar); out.paint.avatar = av && cs(av).borderRadius;
  const th = q(S.fpostThumb); out.paint.fpostThumb = th && [cs(th).objectFit, cs(th).borderRadius].join(' ');

  const body = q(S.body);
  const btop = body.getBoundingClientRect().top + scrollY;
  /* Post Views Counter's line is dropped by the sanitiser (a number only
   * WordPress can count); the original's page is that much taller below the
   * body. Measured here and taken off the reference's boxes under the body. */
  const views = q('.post-views'); out.viewsH = views ? views.getBoundingClientRect().height + parseFloat(cs(views).marginTop) : 0;
  out.blocks = [...body.children].filter(vis).filter((e) => !e.classList.contains('post-views')).map((e) => { const v = g(e); return { tag: e.tagName, w: v.w, h: v.h, x: v.x, y: +(v.y - btop).toFixed(1), typ: typ(e) }; });
  out.recentCards = qa(S.recentCard).filter(vis).map((e) => ({ ...rel(e), img: rel(q('img', e)), title: rel(q(S.recentTitle, e), glyph) }));
  out.fpostItems = qa(S.fpostItem).filter(vis).map((e) => ({ ...rel(e), img: rel(q('img', e)), title: rel(q(S.fpostName, e), glyph) }));
  out.tabs = qa(S.tab).filter(vis).map((e) => rel(e));
  out.tocLinks = qa(S.tocLink).filter(vis).map((e) => rel(e));
  out.shareLinks = qa(S.shareLink).filter(vis).map((e) => rel(e));
  out.socialLinks = qa(S.socialLink).filter(vis).map((e) => rel(e));
  return out;
}, S);

const REF = {
  main: '.eb-wrapper-umy5r',
  boxes: { hero: '.eb-wrapper-umy5r', heroRow: '.eb-row-9o0bl .eb-row-inner', heroCol: '.eb-row-9o0bl .wp-block-essential-blocks-column:first-child',
    meta: '.eb-row-9o0bl .wp-block-essential-blocks-flex-container', dateIcon: '.eb-row-9o0bl .eb-advanced-image-wrapper img', by: '.eb-post-metadata-author.eb-author-inline-layout',
    heroImg: '.wp-post-image', body: '.wp-site-blocks > .wp-block-essential-blocks-wrapper:nth-of-type(2) > .eb-parent-wrapper > .eb-wrapper-outer', row: '.wp-site-blocks > .wp-block-essential-blocks-wrapper:nth-of-type(2) .eb-row-inner',
    mainCol: '.wp-site-blocks > .wp-block-essential-blocks-wrapper:nth-of-type(2) .eb-row-inner > .wp-block-essential-blocks-column:first-child',
    sideCol: '.wp-site-blocks > .wp-block-essential-blocks-wrapper:nth-of-type(2) .eb-row-inner > .wp-block-essential-blocks-column:last-child',
    prose: '.entry-content', author: '.eb-wrapper-1up3e', authorAvatar: '.eb-author-avatar', recent: '.eb-wrapper-3gcca',
    recentGrid: '.eb-wrapper-3gcca .eb-post-grid-posts-wrapper',
    fpost: '.eb-wrapper-sba8w', fpostTabs: '.wp-block-essential-blocks-column:last-child .ebpg-category-filter-list',
    fpostList: '.wp-block-essential-blocks-column:last-child .eb-post-grid-posts-wrapper',
    tocCard: '.eb-wrapper-5dmb4', tocInner: '.eb-wrapper-2lkye',
    share: '.eb-wrapper-ltk2t', shareList: '.eb-social-shares',
    subscribe: '.eb-wrapper-2pm4y', input: '.eb-form-wrapper input[type="email"]', submit: '.eb-form-submit', socials: '.eb-socials' },
  glyphs: { title: '.eb-row-9o0bl h1 .first-title', date: '.eb-post-metadata-date span', cat: '.taxonomy-category a', authorName: '.eb-author-info span',
    recentTitle: '.wp-block-essential-blocks-column:first-child .eb-advance-heading-wrapper h6 .first-title',
    fpostTitle: '.wp-block-essential-blocks-column:last-child .eb-advance-heading-wrapper h6 .first-title',
    shareTitle: '.eb-wrapper-ltk2t h6 .first-title', subTitle: '.eb-wrapper-2pm4y h6 .first-title', follow: '.eb-wrapper-2pm4y p .first-title' },
  type: { title: '.eb-row-9o0bl h1 .first-title', date: '.eb-post-metadata-date span', cat: '.taxonomy-category a', by: '.eb-author-inline-layout span', byName: '.eb-author-inline-layout a span',
    p: '.entry-content > p', h2: '.entry-content > h2', h3: '.entry-content > h3', li: '.entry-content li', td: '.entry-content td', strong: '.entry-content > p strong',
    authorName: '.eb-author-info span', recentTitle: '.wp-block-essential-blocks-column:first-child .eb-advance-heading-wrapper h6 .first-title',
    recentCard: '.wp-block-essential-blocks-column:first-child .ebpg-entry-title a',
    fpostTitle: '.wp-block-essential-blocks-column:last-child .eb-advance-heading-wrapper h6 .first-title', tab: '.ebpg-category-filter-list-item:not(.active)', activeTab: '.ebpg-category-filter-list-item.active',
    fpostName: '.wp-block-essential-blocks-column:last-child .ebpg-entry-title a', tocLink: '.eb-toc__list > li > a', subLink: '.eb-toc__list .eb-toc__list a',
    shareTitle: '.eb-wrapper-ltk2t h6 .first-title', subTitle: '.eb-wrapper-2pm4y h6 .first-title', follow: '.eb-wrapper-2pm4y p .first-title' },
  paint: { author: '.eb-wrapper-1up3e', fpost: '.eb-wrapper-sba8w',
    tocCard: '.eb-wrapper-5dmb4', tocInner: '.eb-wrapper-2lkye', toc: '.eb-toc-container',
    share: '.eb-wrapper-ltk2t', shareLink: '.eb-social-shares a',
    subscribe: '.eb-wrapper-2pm4y', input: '.eb-form-wrapper input[type="email"]', recentImg: '.wp-block-essential-blocks-column:first-child .ebpg-entry-thumbnail img' },
  placeholder: '.eb-form-wrapper input[type="email"]', activeTab: '.ebpg-category-filter-list-item.active', tab: '.ebpg-category-filter-list-item', subItem: '.eb-toc__list .eb-toc__list li',
  body: '.entry-content', avatar: '.eb-author-avatar', fpostThumb: '.wp-block-essential-blocks-column:last-child .ebpg-entry-thumbnail img',
  recentCard: '.wp-block-essential-blocks-column:first-child .ebpg-grid-post', recentTitle: '.ebpg-entry-title a',
  fpostItem: '.wp-block-essential-blocks-column:last-child .ebpg-grid-post', fpostName: '.ebpg-entry-title a',
  tocLink: '.eb-toc__list a', shareLink: '.eb-social-shares a', socialLink: '.eb-socials a',
};
const MINE = {
  main: '.post-hero',
  boxes: { hero: '.post-hero', heroRow: '.post-hero__row', heroCol: '.post-hero__col:first-child',
    meta: '.post-meta', dateIcon: '.post-meta__icon', by: '.post-by',
    heroImg: '.post-hero__img', body: '.post-body', row: '.post-body__row', mainCol: '.post-main', sideCol: '.post-side',
    prose: '.prose--post', author: '.author-box', authorAvatar: '.author-box__avatar', recent: '.recent', recentGrid: '.recent .pgrid',
    fpost: '.fpost', fpostTabs: '.fpost__tabs', fpostList: '.fpost__list[data-tab="all"]',
    tocCard: '.post-side__card', tocInner: '.ptoc',
    share: '.pshare', shareList: '.pshare__list',
    subscribe: '.psub', input: '.psub__input', submit: '.psub__submit', socials: '.psub__social' },
  glyphs: { title: '.post-hero__title', date: '.post-meta time', cat: '.post-meta__item--tag a', authorName: '.author-box__name',
    recentTitle: '.recent__title', fpostTitle: '.fpost__title', shareTitle: '.pshare__title', subTitle: '.psub__title', follow: '.psub__follow' },
  type: { title: '.post-hero__title', date: '.post-meta time', cat: '.post-meta__item--tag a', by: '.post-by', byName: '.post-by__name',
    p: '.prose--post > p', h2: '.prose--post > h2', h3: '.prose--post > h3', li: '.prose--post li', td: '.prose--post td', strong: '.prose--post > p strong',
    authorName: '.author-box__name', recentTitle: '.recent__title', recentCard: '.recent .pcard__link',
    fpostTitle: '.fpost__title', tab: '.fpost__radio:not(:checked) + .fpost__tab', activeTab: '.fpost__radio:checked + .fpost__tab',
    fpostName: '.fpost__list[data-tab="all"] .fpost__name a', tocLink: '.ptoc__link', subLink: '.ptoc__sublink',
    shareTitle: '.pshare__title', subTitle: '.psub__title', follow: '.psub__follow' },
  paint: { author: '.author-box', fpost: '.fpost', tocCard: '.post-side__card', tocInner: '.ptoc', toc: '.ptoc__list', share: '.pshare', shareLink: '.pshare__link',
    subscribe: '.psub', input: '.psub__input', recentImg: '.recent .pcard__img' },
  placeholder: '.psub__input', activeTab: '.fpost__radio:checked + .fpost__tab', tab: '.fpost__tab', subItem: '.ptoc__subitem',
  body: '.prose--post', avatar: '.author-box__avatar', fpostThumb: '.fpost__list[data-tab="all"] .fpost__thumb img',
  recentCard: '.recent .pcard', recentTitle: '.pcard__link',
  fpostItem: '.fpost__list[data-tab="all"] .fpost__item', fpostName: '.fpost__name a',
  tocLink: '.ptoc a', shareLink: '.pshare__link', socialLink: '.psub__social-link',
};

let fails = 0, worst = 0;
const cmp = (label, a, c, keys, indent = '  ') => {
  keys = keys ?? ['w', 'h', 'x', 'y'];
  if (!a && !c) return;
  if (!a || !c) { console.log(`${indent}${label.padEnd(10)} MISSING ref=${!!a} mine=${!!c}`); fails++; return; }
  const d = keys.map((k) => +(c[k] - a[k]).toFixed(1));
  const bad = d.some((v) => Math.abs(v) > 2);
  if (bad) fails++;
  worst = Math.max(worst, ...d.map(Math.abs));
  console.log(`${indent}${label.padEnd(10)} ref ${a.w}x${a.h}@${a.x},${a.y}  mine ${c.w}x${c.h}@${c.x},${c.y}  Δ${d.join(',')} ${bad ? '✗' : '✓'}`);
};
/* Pixel values inside a type string are compared numerically: a fluid clamp
 * reproduced from measured values lands within a thousandth of a pixel. */
const sameTyp = (x, y) => { if (x === y) return true; if (!x || !y) return false;
  const px = (t) => t.split(' ').map((v) => /^[\d.]+px$/.test(v) ? parseFloat(v) : v);
  const ax = px(x), cx = px(y); return ax.length === cx.length && ax.every((v, j) => typeof v === 'number' ? Math.abs(v - cx[j]) < 0.02 : v === cx[j]); };
const cmpStr = (label, a, c, indent = '  ') => {
  if (a === null && c === null) return;
  const ok = sameTyp(a, c); if (!ok) { fails++; worst = Math.max(worst, 3); }
  console.log(`${indent}${label.padEnd(10)} ${ok ? '✓' : `✗\n${indent}   ref  ${a}\n${indent}   mine ${c}`}`);
};
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
  await settle(ref, `https://storefaq.io/${SLUG}/`); await settle(mine, `${BASE}/blog/${SLUG}/`);
  const r = await read(ref, REF), m = await read(mine, MINE);
  /* Below 768 the sidebar sits under the article, so it moves with the views
   * line too — and its height, and the row's, then carry the longer contents
   * list, which is compared without height there. */
  const stacked = r.boxes.sideCol && r.boxes.mainCol && r.boxes.sideCol.y > r.boxes.mainCol.y;
  if (r.viewsH) {
    const BELOW = ['author', 'authorAvatar', 'recent', 'recentGrid', 'authorName', 'recentTitle',
      ...(stacked ? ['sideCol', 'fpost', 'fpostTabs', 'fpostList', 'fpostTitle', 'tocCard', 'tocInner'] : [])];
    const SHRINK = ['body', 'row', 'mainCol', 'sideCol', 'prose'];
    for (const k of BELOW) if (r.boxes[k]) r.boxes[k].y = +(r.boxes[k].y - r.viewsH).toFixed(1);
    for (const k of SHRINK) if (r.boxes[k]) r.boxes[k].h = +(r.boxes[k].h - r.viewsH).toFixed(1);
    const lists = [r.recentCards, ...(stacked ? [r.fpostItems, r.tabs, r.tocLinks] : [])];
    for (const list of lists) for (const c of list) for (const e of [c, c.img, c.title]) if (e) e.y = +(e.y - r.viewsH).toFixed(1);
  }
  const STACK_NO_H = new Set(['body', 'row', 'sideCol']);
  console.log(`\n${w}px  pageH ref ${r.pageH} mine ${m.pageH} Δ${m.pageH - r.pageH}`);
  /* The contents list is longer here than the original's stale snapshot, so
   * everything under it in the sidebar sits lower: those boxes are compared
   * without y. The card the list is in is compared by width and x only. */
  const NO_Y = new Set(['share', 'shareList', 'subscribe', 'input', 'submit', 'socials', 'shareTitle', 'subTitle', 'follow']);
  for (const k of Object.keys(r.boxes)) cmp(k, r.boxes[k], m.boxes[k], k === 'tocCard' || k === 'tocInner' ? ['w', 'x'] : NO_Y.has(k) ? ['w', 'h', 'x'] : stacked && STACK_NO_H.has(k) ? ['w', 'x', 'y'] : undefined);
  for (const k of Object.keys(r.type)) cmpStr('type.' + k, r.type[k], m.type[k]);
  for (const k of Object.keys(r.paint)) cmpStr('paint.' + k, r.paint[k], m.paint[k]);
  const bl = Math.min(r.blocks.length, m.blocks.length);
  if (r.blocks.length !== m.blocks.length) { fails++; console.log(`  blocks    COUNT ref ${r.blocks.length} mine ${m.blocks.length} ✗`); }
  const badBlocks = [];
  for (let i = 0; i < bl; i++) { const a = r.blocks[i], c = m.blocks[i];
    const d = ['w', 'h', 'x', 'y'].map((k) => +(c[k] - a[k]).toFixed(1));
    const sameTyp = (x, y) => { if (x === y) return true; if (!x || !y) return false;
      const px = (t) => t.split(' ').map((v) => /^[\d.]+px$/.test(v) ? parseFloat(v) : v);
      const ax = px(x), cx = px(y); return ax.length === cx.length && ax.every((v, j) => typeof v === 'number' ? Math.abs(v - cx[j]) < 0.02 : v === cx[j]); };
    if (a.tag !== c.tag || !sameTyp(a.typ, c.typ) || d.some((v) => Math.abs(v) > 2)) badBlocks.push({ i, a, c, d }); }
  fails += badBlocks.length;
  console.log(`  blocks    ${badBlocks.length ? badBlocks.length + ' of ' + bl + ' differ ✗' : `all ${bl} match ✓`}`);
  for (const { i, a, c, d } of badBlocks.slice(0, 6)) {
    worst = Math.max(worst, ...d.map(Math.abs));
    console.log(`    [${i}] ${a.tag}/${c.tag} ref ${a.w}x${a.h}@${a.x},${a.y} mine ${c.w}x${c.h}@${c.x},${c.y} Δ${d.join(',')}`);
    if (a.typ !== c.typ) console.log(`        type ref ${a.typ}\n             mine ${c.typ}`);
  }
  cmpList('recent', r.recentCards, m.recentCards);
  cmpList('recentImg', r.recentCards, m.recentCards, (c) => c.img);
  cmpList('recentTtl', r.recentCards, m.recentCards, (c) => c.title, 5);
  cmpList('fpost', r.fpostItems, m.fpostItems);
  cmpList('fpostImg', r.fpostItems, m.fpostItems, (c) => c.img);
  cmpList('fpostTtl', r.fpostItems, m.fpostItems, (c) => c.title, 5);
  cmpList('tabs', r.tabs, m.tabs);
  /* The original's contents list is a stale snapshot (see NOTES); only the
   * entries both sides have are compared, and only the first two. */
  cmpList('tocLinks', r.tocLinks.slice(0, 2), m.tocLinks.slice(0, 2));
  const noY = (l) => l.map((e) => e && { ...e, y: 0 });
  cmpList('share', noY(r.shareLinks), noY(m.shareLinks));
  cmpList('socials', noY(r.socialLinks.slice(0, 2)), noY(m.socialLinks.slice(0, 2)));
}
console.log(`\nfails ${fails}, worst ${worst}px`);
await b.close();
