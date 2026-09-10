// Diffs footer + newsletter geometry against the live site.
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4321';
const VIEWPORTS = [360, 480, 768, 1024, 1280, 1440, 1920];

const REF_SEL = {
  card: null,           // resolved by background colour
  form: '.eb-fluent-form-04ajb',
  input: '.ff-el-form-control',
  submit: '.ff-btn',
  brandLogo: null,
};
const MINE_SEL = {
  card: '.newsletter__card',
  form: '.newsletter__form',
  input: '.newsletter__input',
  submit: '.newsletter__submit',
  brandLogo: '.footer__brand img',
};

const readRef = (page) => page.evaluate(() => {
  const g = (e) => { if (!e) return null; const b = e.getBoundingClientRect();
    return { w: Math.round(b.width), h: Math.round(b.height), x: Math.round(b.x) }; };
  const card = [...document.querySelectorAll('.eb-wrapper-outer')]
    .find((e) => getComputedStyle(e).backgroundColor === 'rgb(106, 166, 60)');
  const rows = [...document.querySelectorAll('.eb-row-inner')]
    .filter((e) => e.getBoundingClientRect().top + scrollY > document.body.scrollHeight - 700);
  const cols = rows.length ? [...rows[0].children]
    .filter((e) => e.getBoundingClientRect().width > 0)
    .map((e) => { const b = e.getBoundingClientRect(); return { w: Math.round(b.width), x: Math.round(b.x) }; }) : [];
  const logo = [...document.querySelectorAll('img')]
    .find((e) => /Logo\.png/.test(e.currentSrc) && e.getBoundingClientRect().top + scrollY > document.body.scrollHeight - 700);
  /* Paint, not boxes. The newsletter band's ground is a hard-stop 50/50
   * gradient — white above, footer-dark below — which is the whole reason the
   * card appears to overlap the footer. Every box measures the same with and
   * without it, so it has to be read directly. */
  const cs = (e) => e ? getComputedStyle(e) : null;
  const sec = card ? card.closest('.eb-wrapper-outer:not(.eb-wrapper-b9xpk)') ||
    (() => { let n = card.parentElement; while (n && n.getBoundingClientRect().width < innerWidth - 1) n = n.parentElement; return n; })() : null;
  const link = [...document.querySelectorAll('a')]
    .find((e) => /BetterDocs/.test(e.textContent) && e.getBoundingClientRect().width > 0);
  const head = [...document.querySelectorAll('*')]
    .find((e) => /^Apps$/.test(e.textContent.trim()) && e.children.length === 0 && e.getBoundingClientRect().width > 0);
  const bar = [...document.querySelectorAll('*')]
    .find((e) => parseFloat(getComputedStyle(e).borderTopWidth) === 1
      && /rgba\(255, 255, 255, 0\.1\)/.test(getComputedStyle(e).borderTopColor));
  const soc = [...document.querySelectorAll('a')]
    .filter((e) => /facebook|linkedin/i.test(e.getAttribute('href') || '') && e.getBoundingClientRect().width > 0)
    .map((e) => { const q = e.getBoundingClientRect(); return Math.round(q.width) + '@' + Math.round(q.x); }).join(' ');
  const paint = {
    social: soc,
    band: sec ? cs(sec).backgroundImage.replace(/\s+/g, ' ') : null,
    secPad: sec ? cs(sec).paddingTop + '/' + cs(sec).paddingBottom : null,
    link: link ? [cs(link).display, cs(link).fontSize, cs(link).fontWeight, cs(link).lineHeight, cs(link).textTransform].join(' ') : null,
    head: head ? [cs(head).fontSize, cs(head).lineHeight, cs(head).textTransform].join(' ') : null,
    bar: bar ? [cs(bar).borderTopWidth, cs(bar).paddingTop, cs(bar).paddingBottom].join(' ') : null,
  };
  /* Vertical rhythm, not just boxes. Every named box below passed while the
   * page total was 3px out at 1280 and 47px at 360 — because nothing here
   * measured the DISTANCE between them. These three spans are structural
   * (found by background and by the bottom bar's 1px white-10% rule), so they
   * pick the same thing on both sides. */
  const dB = document.documentElement.scrollHeight;
  const span = {
    cardToBar: card && bar ? Math.round(bar.getBoundingClientRect().top + scrollY - (card.getBoundingClientRect().bottom + scrollY)) : null,
    barH: bar ? Math.round(bar.getBoundingClientRect().height) : null,
    barToEnd: bar ? Math.round(dB - (bar.getBoundingClientRect().bottom + scrollY)) : null,
  };
  return { span, card: g(card), form: g(document.querySelector('.eb-fluent-form-04ajb')),
    input: g(document.querySelector('.ff-el-form-control')), submit: g(document.querySelector('.ff-btn')),
    brandLogo: g(logo), cols, paint };
});

const readMine = (page) => page.evaluate((sel) => {
  const g = (s) => { const e = document.querySelector(s); if (!e) return null;
    const b = e.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height), x: Math.round(b.x) }; };
  const cols = [...document.querySelectorAll('.footer__cols > *')]
    .map((e) => { const b = e.getBoundingClientRect(); return { w: Math.round(b.width), x: Math.round(b.x) }; });
  const cs = (e) => e ? getComputedStyle(e) : null;
  const sec = document.querySelector('.newsletter');
  const link = [...document.querySelectorAll('.footer__link')].find((e) => /BetterDocs/.test(e.textContent));
  const head = document.querySelector('.footer__heading');
  const bar = document.querySelector('.footer__bar');
  const soc = [...document.querySelectorAll('.footer__social-link')]
    .map((e) => { const q = e.getBoundingClientRect(); return Math.round(q.width) + '@' + Math.round(q.x); }).join(' ');
  const dB = document.documentElement.scrollHeight;
  const cardEl = document.querySelector('.newsletter__card');
  const spanM = {
    cardToBar: cardEl && bar ? Math.round(bar.getBoundingClientRect().top + scrollY - (cardEl.getBoundingClientRect().bottom + scrollY)) : null,
    barH: bar ? Math.round(bar.getBoundingClientRect().height) : null,
    barToEnd: bar ? Math.round(dB - (bar.getBoundingClientRect().bottom + scrollY)) : null,
  };
  const out = {}; for (const [k, s] of Object.entries(sel)) out[k] = g(s);
  out.span = spanM;
  out.cols = cols;
  out.paint = {
    social: soc,
    band: sec ? cs(sec).backgroundImage.replace(/\s+/g, ' ') : null,
    secPad: sec ? cs(sec).paddingTop + '/' + cs(sec).paddingBottom : null,
    link: link ? [cs(link).display, cs(link).fontSize, cs(link).fontWeight, cs(link).lineHeight, cs(link).textTransform].join(' ') : null,
    head: head ? [cs(head).fontSize, cs(head).lineHeight, cs(head).textTransform].join(' ') : null,
    bar: bar ? [cs(bar).borderTopWidth, cs(bar).paddingTop, cs(bar).paddingBottom].join(' ') : null,
  };
  return out;
}, MINE_SEL);

const browser = await chromium.launch();
/* `reducedMotion: 'reduce'` so the entrance animations never run here.
 * Every element is then at its final position from first paint, which is
 * what these measurements are about — and it exercises the accessibility
 * path at the same time. */
const ctx = await browser.newContext({ reducedMotion: 'reduce' });
const ref = await ctx.newPage(), mine = await ctx.newPage();
/* `domcontentloaded`, NOT `networkidle`. The live site runs Crisp live chat and
 * the BetterDocs Instant Answer widget, which hold connections open — /docs/
 * stopped reaching networkidle at all and the diff died on a 60s timeout with
 * nothing wrong on either side. Readiness here is the settled page height
 * below, which is the signal that actually made these measurements stable. */
const settle = async (p, url) => {
  await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 800) { scrollTo(0, y); await new Promise(r => setTimeout(r, 40)); } });
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
  await p.waitForTimeout(400);
};

let worst = 0;

for (const w of VIEWPORTS) {
  await ref.setViewportSize({ width: w, height: 900 });
  await mine.setViewportSize({ width: w, height: 900 });
  await settle(ref, 'https://storefaq.io/');
  await settle(mine, BASE + '/');
  const r = await readRef(ref), m = await readMine(mine);
  console.log(`\n${w}px`);
  for (const k of ['card', 'form', 'input', 'submit', 'brandLogo']) {
    if (!r[k] || !m[k]) { console.log(`  ${k.padEnd(10)} ref=${JSON.stringify(r[k])} mine=${JSON.stringify(m[k])}`); continue; }
    const d = ['w', 'h', 'x'].map((q) => m[k][q] - r[k][q]);
    const bad = d.some((v) => Math.abs(v) > 2);
    console.log(`  ${k.padEnd(10)} ref ${r[k].w}x${r[k].h}@${r[k].x}  mine ${m[k].w}x${m[k].h}@${m[k].x}  Δ${d.join(',')} ${bad ? '✗' : '✓'}`);
    worst = Math.max(worst, ...d.map(Math.abs));
  }
  for (const k of Object.keys(r.span)) {
    const d = m.span[k] - r.span[k];
    const bad = Math.abs(d) > 2;
    if (bad) worst = Math.max(worst, Math.abs(d));
    console.log(`  span.${k.padEnd(9)} ref ${r.span[k]}  mine ${m.span[k]}  Δ${d} ${bad ? '✗' : '✓'}`);
  }
  const cw = (a) => a.map((c) => c.w + '@' + c.x).join(' ');
  const same = cw(r.cols) === cw(m.cols);
  console.log(`  cols       ref ${cw(r.cols)}\n             mine ${cw(m.cols)} ${same ? '✓' : '✗'}`);
  if (!same) worst = Math.max(worst, 3);
  for (const k of Object.keys(r.paint)) {
    const ok = r.paint[k] === m.paint[k];
    console.log(`  ${('paint.' + k).padEnd(10)} ${ok ? '✓' : `✗\n     ref  ${r.paint[k]}\n     mine ${m.paint[k]}`}`);
    if (!ok) worst = Math.max(worst, 3);
  }
}
console.log(`\nworst delta: ${worst}px`);
await browser.close();
