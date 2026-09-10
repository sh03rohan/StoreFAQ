/* Geometry + paint diff for the Home "Here's What Our Users Say" section.
 * Compares section chrome, all six cards, every text box inside the first
 * card, and the trailing button. Also reports "tails" — slack between a
 * card's last content edge and the card's bottom padding edge. */
import { chromium } from 'playwright';

const b = await chromium.launch();
/* `reducedMotion: 'reduce'` so the entrance animations never run here.
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
const settle = async (p, u) => {
  await p.goto(u, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); } scrollTo(0, 0); });
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
  await p.waitForTimeout(700);
};

const readRef = () => {
  const vis = e => { const q = e.getBoundingClientRect(); return q.width > 0 && q.height > 0; };
  const bx = e => { if (!e) return null; const q = e.getBoundingClientRect(); return { w: Math.round(q.width), h: Math.round(q.height), x: Math.round(q.x), y: Math.round(q.top + scrollY) }; };
  const heading = [...document.querySelectorAll('.first-title')].find(e => /Here.s What Our Users Say/.test(e.textContent));
  const sec = heading.closest('.eb-wrapper-outer');
  const cards = [...sec.querySelectorAll('.eb-testimonial-wrapper')].filter(vis)
    .sort((a, z) => { const A = a.getBoundingClientRect(), Z = z.getBoundingClientRect(); return (A.top - Z.top) || (A.left - Z.left); });
  const btn = [...sec.querySelectorAll('.eb-button-anchor')].filter(vis)[0];
  const c0 = cards[0];
  const cs = e => getComputedStyle(e);
  return {
    section: bx(sec), title: bx(heading.closest('h2')), btn: bx(btn),
    btnPaint: (c => ({ bg: c.backgroundColor, bd: c.borderColor, br: c.borderRadius, fs: c.fontSize }))(cs(btn)),
    cards: cards.map(bx),
    names: cards.map(c => c.querySelector('.eb-testimonial-username').textContent),
    cardPaint: cards.map(c => (x => ({ bg: x.backgroundColor, bd: x.borderColor, br: x.borderTopLeftRadius }))(cs(c))),
    stars: bx(c0.querySelector('.eb-testimonial-rating')),
    star0: bx(c0.querySelector('.eb-testimonial-rating i')),
    name: bx(c0.querySelector('.eb-testimonial-username')),
    place: bx(c0.querySelector('.eb-testimonial-company')),
    quote: bx(c0.querySelector('.eb-testimonial-description')),
    textPaint: cards.map(c => ({
      star: cs(c.querySelector('.eb-testimonial-rating i')).color,
      name: cs(c.querySelector('.eb-testimonial-username')).color,
      place: cs(c.querySelector('.eb-testimonial-company')).color,
      quote: cs(c.querySelector('.eb-testimonial-description')).color,
    })),
    tails: cards.map(c => {
      const q = c.getBoundingClientRect();
      const d = c.querySelector('.eb-testimonial-description').getBoundingClientRect();
      const pb = parseFloat(getComputedStyle(c).paddingBottom) + parseFloat(getComputedStyle(c).borderBottomWidth);
      return Math.round(q.bottom - d.bottom - pb);
    }),
  };
};

const readMine = () => {
  const bx = e => { if (!e) return null; const q = e.getBoundingClientRect(); return { w: Math.round(q.width), h: Math.round(q.height), x: Math.round(q.x), y: Math.round(q.top + scrollY) }; };
  const cs = e => getComputedStyle(e);
  const sec = document.querySelector('.tm');
  // Both sides are sorted by paint position so the lists line up regardless
  // of how the two documents order their markup.
  const cards = [...sec.querySelectorAll('.tm__card')]
    .sort((a, z) => { const A = a.getBoundingClientRect(), Z = z.getBoundingClientRect(); return (A.top - Z.top) || (A.left - Z.left); });
  const c0 = cards[0], btn = sec.querySelector('.tm__more');
  return {
    section: bx(sec), title: bx(sec.querySelector('.tm__title')), btn: bx(btn),
    btnPaint: (c => ({ bg: c.backgroundColor, bd: c.borderColor, br: c.borderRadius, fs: c.fontSize }))(cs(btn)),
    cards: cards.map(bx),
    names: cards.map(c => c.querySelector('.tm__name').textContent),
    cardPaint: cards.map(c => (x => ({ bg: x.backgroundColor, bd: x.borderColor, br: x.borderTopLeftRadius }))(cs(c))),
    stars: bx(c0.querySelector('.tm__stars')),
    star0: bx(c0.querySelector('.tm__stars svg')),
    name: bx(c0.querySelector('.tm__name')),
    place: bx(c0.querySelector('.tm__place')),
    quote: bx(c0.querySelector('.tm__quote')),
    textPaint: cards.map(c => ({
      star: cs(c.querySelector('.tm__stars svg')).fill,
      name: cs(c.querySelector('.tm__name')).color,
      place: cs(c.querySelector('.tm__place')).color,
      quote: cs(c.querySelector('.tm__quote')).color,
    })),
    tails: cards.map(c => {
      const q = c.getBoundingClientRect();
      const d = c.querySelector('.tm__quote').getBoundingClientRect();
      const pb = parseFloat(cs(c).paddingBottom) + parseFloat(cs(c).borderBottomWidth);
      return Math.round(q.bottom - d.bottom - pb);
    }),
  };
};

const KEYS = ['section', 'title', 'btn', 'stars', 'star0', 'name', 'place', 'quote'];
let worst = 0;
for (const w of [360, 480, 768, 1024, 1280, 1440, 1920]) {
  await ref.setViewportSize({ width: w, height: 900 });
  await mine.setViewportSize({ width: w, height: 900 });
  await settle(ref, 'https://storefaq.io/');
  await settle(mine, process.env.LOCAL ?? 'http://localhost:4321/');
  const r = await ref.evaluate(readRef), m = await mine.evaluate(readMine);
  console.log(`\n${w}px`);
  const line = (k, a, z) => {
    if (!a || !z) { console.log(`  ${k.padEnd(9)} ref=${JSON.stringify(a)} mine=${JSON.stringify(z)}`); worst = 999; return; }
    const dy = (z.y - m.section.y) - (a.y - r.section.y);
    const d = [z.w - a.w, z.h - a.h, z.x - a.x, dy];
    const bad = d.some(v => Math.abs(v) > 2);
    console.log(`  ${k.padEnd(9)} ref ${a.w}x${a.h}@${a.x}  mine ${z.w}x${z.h}@${z.x}  Δw${d[0]} Δh${d[1]} Δx${d[2]} Δy${d[3]} ${bad ? '✗' : '✓'}`);
    worst = Math.max(worst, ...d.map(Math.abs));
  };
  for (const k of KEYS) line(k, r[k], m[k]);
  r.cards.forEach((c, i) => line(`card${i}`, c, m.cards[i]));
  const order = JSON.stringify(r.names) === JSON.stringify(m.names);
  console.log(`  order     ${order ? '✓' : '✗ ref=' + JSON.stringify(r.names) + ' mine=' + JSON.stringify(m.names)}`);
  if (!order) worst = 999;
  console.log(`  tails     ref ${JSON.stringify(r.tails)}  mine ${JSON.stringify(m.tails)}`);
  for (const k of ['cardPaint', 'btnPaint', 'textPaint']) {
    const same = JSON.stringify(r[k]) === JSON.stringify(m[k]);
    console.log(`  ${k.padEnd(9)} ${same ? '✓' : '✗ ref ' + JSON.stringify(r[k]) + ' mine ' + JSON.stringify(m[k])}`);
    if (!same) worst = Math.max(worst, 3);
  }
}
console.log('\nworst:', worst);
await b.close();
