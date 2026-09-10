// Generic section differ: compares named boxes between the live site and the
// local build at every viewport. Usage: node scripts/diff-section.mjs hero
import { chromium } from 'playwright';

const SECTIONS = {
  hero: {
    ref: {
      section: () => document.querySelectorAll('main .wp-block-essential-blocks-wrapper')[0].querySelector('.eb-wrapper-outer'),
      badge:   () => [...document.querySelectorAll('*')].find(e => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && s.backgroundColor === 'rgb(243, 249, 236)'; }),
      title:   () => [...document.querySelectorAll('.first-title')].find(e => e.getBoundingClientRect().width > 0),
      sub:     () => [...document.querySelectorAll('.eb-ah-subtitle')].find(e => e.getBoundingClientRect().width > 0),
      cta:     () => { const sec = document.querySelectorAll('main .wp-block-essential-blocks-wrapper')[0];
                       return [...sec.querySelectorAll('.eb-button-anchor')].find(e => e.getBoundingClientRect().width > 0); },
      media:   () => [...document.querySelectorAll('img')].find(e => /hero-image/.test(e.currentSrc)),
    },
    mine: {
      section: '.hero', badge: '.hero__badge', title: '.hero__title',
      sub: '.hero__sub', cta: '.hero__cta', media: '.hero__media img',
    },
  },
};

const name = process.argv[2] ?? 'hero';
const BASE = process.argv[3] ?? 'http://localhost:4321';
const spec = SECTIONS[name];
const VIEWPORTS = [360, 480, 768, 1024, 1280, 1440, 1920];

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
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise(r => setTimeout(r, 50)); } scrollTo(0, 0); });
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
  await p.waitForTimeout(500);
};

const box = (e) => { if (!e) return null; const r = e.getBoundingClientRect();
  return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.top + scrollY) }; };

let worst = 0;
for (const w of VIEWPORTS) {
  await ref.setViewportSize({ width: w, height: 900 });
  await mine.setViewportSize({ width: w, height: 900 });
  await settle(ref, 'https://storefaq.io/');
  await settle(mine, BASE + '/');

  const r = await ref.evaluate((fns) => {
    const out = {}; const box = (e) => { if (!e) return null; const r = e.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.top + scrollY) }; };
    for (const [k, src] of Object.entries(fns)) { try { out[k] = box(new Function('return (' + src + ')()')()); } catch { out[k] = null; } }
    return out;
  }, Object.fromEntries(Object.entries(spec.ref).map(([k, f]) => [k, f.toString()])));

  const m = await mine.evaluate((sel) => {
    const out = {}; const box = (e) => { if (!e) return null; const r = e.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.top + scrollY) }; };
    for (const [k, s] of Object.entries(sel)) out[k] = box(document.querySelector(s));
    return out;
  }, spec.mine);

  console.log(`\n${w}px`);
  for (const k of Object.keys(spec.mine)) {
    if (!r[k] || !m[k]) { console.log(`  ${k.padEnd(9)} ref=${JSON.stringify(r[k])} mine=${JSON.stringify(m[k])}`); worst = 999; continue; }
    // compare size and x; y is offset by the section's own start
    const dy = (m[k].y - m.section.y) - (r[k].y - r.section.y);
    const INLINE = new Set(['title', 'sub']);   // ref renders these as inline spans
    const d = [INLINE.has(k) ? 0 : m[k].w - r[k].w, m[k].h - r[k].h, m[k].x - r[k].x, dy];
    const bad = d.some((v) => Math.abs(v) > 2);
    console.log(`  ${k.padEnd(9)} ref ${r[k].w}x${r[k].h}@${r[k].x}  mine ${m[k].w}x${m[k].h}@${m[k].x}  Δw${d[0]} Δh${d[1]} Δx${d[2]} Δy${d[3]} ${bad ? '✗' : '✓'}`);
    worst = Math.max(worst, ...d.map(Math.abs));
  }
}
console.log(`\nworst delta: ${worst}px`);
await browser.close();
