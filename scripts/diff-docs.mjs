// Diffs /docs/ geometry AND paint against the live site.
//
// Paint is read per element, not sampled from one. Five separate times on
// this migration a geometry diff passed while the section was the wrong
// colour, so every box below is compared on its background, border, radius
// and text colour as well as its rectangle.
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4321';
const VIEWPORTS = [360, 480, 600, 768, 1024, 1280, 1440, 1920];

const b = await chromium.launch();
/* `reducedMotion: 'reduce'` so the entrance animations never run here.
 * Every element is then at its final position from first paint. */
const ctx = await b.newContext({ reducedMotion: 'reduce' });
const ref = await ctx.newPage(), mine = await ctx.newPage();

const settle = async (p, u) => {
  await p.goto(u, { waitUntil: 'networkidle', timeout: 60000 });
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise(r => setTimeout(r, 50)); } scrollTo(0, 0); });
  // Wait for layout to stop moving; see the note in diff-features.mjs — neither
  // `document.fonts.ready` awaited from Node nor `document.fonts.check` is
  // enough on its own, a settled page height is.
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
  await p.waitForTimeout(400);
};

/** One reader, two selector maps — so the two sides cannot drift apart. */
const read = (page, sel) => page.evaluate((S) => {
  const q = (s) => document.querySelector(s);
  const cs = (e) => e && getComputedStyle(e);
  const g = (e) => { if (!e) return null; const r = e.getBoundingClientRect();
    return { w: +r.width.toFixed(1), h: +r.height.toFixed(1), x: Math.round(r.x), y: Math.round(r.top + scrollY) }; };
  /* Only report what can actually paint. A border colour on a 0px border and
   * a text colour on an element with no text of its own are both unobservable,
   * and reporting them turns a clean section into noise — which is how a real
   * +59 went unread on the pricing diff for weeks. The reference's category
   * card is a bare <a>, so its `color` is the browser's default link blue and
   * its border colour is a transparent 0px: neither reaches a pixel, because
   * every text child sets its own colour. */
  const hasOwnText = (e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
  /* Read the type off whichever element actually holds the words. The two
   * sides nest text to different depths — the reference's doc count is a
   * <div> wrapping a <span> wrapping the text, mine puts the text straight in
   * — and the colour and font are identical either way. */
  /* Descend only through pass-through wrappers — one element child, no text
   * and nothing painted of its own. That covers the reference nesting its doc
   * count as <div><span>3 Docs</span></div> where mine puts the text straight
   * in the span. It deliberately does NOT descend into a box with several
   * children: the first text inside the search bar is the placeholder on the
   * reference and the submit button on mine, and reporting one against the
   * other compares nothing. */
  const textEl = (e) => {
    let n = e;
    for (let i = 0; i < 4; i++) {
      if (hasOwnText(n)) return n;
      const kids = [...n.children];
      if (kids.length !== 1) return null;
      n = kids[0];
    }
    return null;
  };
  const typeOf = (e) => { const t = textEl(e); if (!t) return '(no text)'; const c = cs(t);
    return [c.color, c.fontFamily.split(',')[0].replace(/"/g, ''), c.fontSize, c.lineHeight, c.fontWeight].join(' '); };
  const paint = (e) => { const c = cs(e); if (!c) return null;
    const bw = parseFloat(c.borderTopWidth);
    const border = bw > 0 ? bw + 'px ' + c.borderTopColor : 'none';
    return [c.backgroundColor, border, c.borderRadius, typeOf(e)].join(' | '); };
  /* The glyphs, not the box. The reference's heading text sits in an inline
   * <span> that shrink-wraps it; mine is the block itself, centred. The boxes
   * are 827px apart and the words are in the same place — so measure where
   * the words are. Same technique as the pricing indent. */
  const glyphs = (e) => { if (!e) return null; const r = document.createRange(); r.selectNodeContents(e);
    const b = r.getBoundingClientRect();
    return { w: +b.width.toFixed(1), h: +b.height.toFixed(1), x: Math.round(b.x), y: Math.round(b.top + scrollY) }; };

  const out = { boxes: {}, paint: {} };
  for (const [k, s] of Object.entries(S.one)) {
    const e = q(s);
    out.boxes[k] = k === 'title' ? glyphs(e) : g(e);
    out.paint[k] = paint(e);
  }
  /* Placeholder text. The original's "field" is a <span> holding the literal
   * words, so its own `color` IS the placeholder colour; mine is a real
   * <input> whose ::placeholder carries it. Compare like with like. */
  const ph = q(S.placeholderOf);
  /* Colour off ::placeholder, metrics off the input. Chrome reports
   * `line-height: normal` on the pseudo whatever the element says, so reading
   * leading from there compares nothing. */
  const phc = ph && (S.placeholderPseudo ? getComputedStyle(ph, '::placeholder') : cs(ph));
  out.paint.placeholder = ph
    ? [phc.color, cs(ph).fontFamily.split(',')[0].replace(/"/g, ''), cs(ph).fontSize, cs(ph).lineHeight, cs(ph).fontWeight].join(' ')
    : null;
  /* Covered entirely by `placeholder` above: the reference's field is a <span>
   * holding the literal placeholder words, mine is an empty <input>, so there
   * is no text on my side to read a type off. */
  delete out.paint.input;
  out.cards = [...document.querySelectorAll(S.cards)].map(g);
  // The hero's ground is an image, and the mint card's is flat: both are
  // invisible to a box measurement and both were wrong on other sections.
  const hero = q(S.one.hero);
  /* "Has an image", not which file — the filenames differ by construction
   * across a migration, and comparing them fails forever while telling you
   * nothing. How it is laid down is what shows. */
  out.paint.heroBg = hero ? [/^url\(/.test(cs(hero).backgroundImage) ? 'image' : 'none',
    cs(hero).backgroundSize, cs(hero).backgroundPosition, cs(hero).backgroundRepeat].join(' ') : null;
  const grid = q(S.one.grid);
  out.paint.gridCols = grid ? cs(grid).gridTemplateColumns.split(' ').length + 'col' : null;
  out.paint.gridGap = grid ? cs(grid).gap : null;
  const icon = q(S.iconImg);
  out.boxes.iconImg = g(icon);
  out.pageH = document.documentElement.scrollHeight;
  return out;
}, sel);

const REF = {
  one: {
    hero:    '.eb-wrapper-3lds7',
    title:   '.eb-ah-title .first-title',
    search:  '.search-bar',
    field:   '.search-input-wrapper',
    input:   '.search-input',
    submit:  '.search-button',
    catCard: '.eb-wrapper-lend1',
    grid:    '.betterdocs-category-box-inner-wrapper',
    cat0:    '.category-box',
    tile:    '.betterdocs-folder-icon',
    catTitle:'.betterdocs-category-title',
    catCount:'.betterdocs-sub-category-items-counts',
    catUpd:  '.betterdocs-last-update',
    faq:     '.eb-wrapper-c31vpz6',
  },
  cards: '.category-box',
  iconImg: '.betterdocs-category-folder-img',
  placeholderOf: '.search-input',
  placeholderPseudo: false,
};
const MINE = {
  one: {
    hero:    '.docs-hero',
    title:   '.docs-hero__title',
    search:  '.docs-search',
    field:   '.docs-search__field',
    input:   '.docs-search__input',
    submit:  '.docs-search__submit',
    catCard: '.docs-cats__card',
    grid:    '.docs-cats__grid',
    cat0:    '.docs-cat',
    tile:    '.docs-cat__icon',
    catTitle:'.docs-cat__title',
    catCount:'.docs-cat__count',
    catUpd:  '.docs-cat__updated',
    faq:     '.faq',
  },
  cards: '.docs-cat',
  iconImg: '.docs-cat__icon img',
  placeholderOf: '.docs-search__input',
  placeholderPseudo: true,
};

/* The original's search field is a <span>; mine is an <input>. Its own box is
 * driven by font metrics and is not load-bearing — the bar's height comes from
 * the button and the field's from the 20px icon — so the box is not compared;
 * the placeholder colour and font are, above. */
const SKIP_BOX = new Set(['input']);

let worst = 0, fails = 0;
for (const w of VIEWPORTS) {
  await ref.setViewportSize({ width: w, height: 900 });
  await mine.setViewportSize({ width: w, height: 900 });
  await settle(ref, 'https://storefaq.io/docs/');
  await settle(mine, BASE + '/docs/');
  const r = await read(ref, REF), m = await read(mine, MINE);
  console.log(`\n${w}px   pageH ref ${r.pageH} mine ${m.pageH} Δ${m.pageH - r.pageH}`);

  for (const k of Object.keys(REF.one)) {
    if (SKIP_BOX.has(k)) continue;
    const a = r.boxes[k], c = m.boxes[k];
    if (!a || !c) { console.log(`  ${k.padEnd(9)} MISSING ref=${!!a} mine=${!!c}`); fails++; continue; }
    // Sections start at different y because the pages above them differ in
    // height by a pixel or two; compare each box's size and its x, plus its
    // offset from the hero, rather than absolute y.
    const d = [c.w - a.w, c.h - a.h, c.x - a.x, (c.y - m.boxes.hero.y) - (a.y - r.boxes.hero.y)];
    const bad = d.some((v) => Math.abs(v) > 2);
    if (bad) fails++;
    worst = Math.max(worst, ...d.map(Math.abs));
    console.log(`  ${k.padEnd(9)} ref ${a.w}x${a.h}@${a.x}  mine ${c.w}x${c.h}@${c.x}  Δwhxy ${d.join(',')} ${bad ? '✗' : '✓'}`);
  }

  const boxKey = (a) => a.map((e) => `${e.w}x${e.h}@${e.x}`).join(' ');
  const cardsOk = r.cards.length === m.cards.length && boxKey(r.cards) === boxKey(m.cards);
  console.log(`  cards     ref ${boxKey(r.cards)}\n            mine ${boxKey(m.cards)} ${cardsOk ? '✓' : '✗'}`);
  if (!cardsOk) { fails++; worst = Math.max(worst, 3); }

  for (const k of Object.keys(r.paint)) {
    const a = r.paint[k], c = m.paint[k];
    const ok = a === c;
    if (!ok) { fails++; worst = Math.max(worst, 3); }
    console.log(`  ${('paint.' + k).padEnd(15)} ${ok ? '✓' : `✗\n     ref  ${a}\n     mine ${c}`}`);
  }
}
console.log(`\nfails ${fails}, worst ${worst}px`);
await b.close();
