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
  return { card: g(card), form: g(document.querySelector('.eb-fluent-form-04ajb')),
    input: g(document.querySelector('.ff-el-form-control')), submit: g(document.querySelector('.ff-btn')),
    brandLogo: g(logo), cols };
});

const readMine = (page) => page.evaluate((sel) => {
  const g = (s) => { const e = document.querySelector(s); if (!e) return null;
    const b = e.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height), x: Math.round(b.x) }; };
  const cols = [...document.querySelectorAll('.footer__cols > *')]
    .map((e) => { const b = e.getBoundingClientRect(); return { w: Math.round(b.width), x: Math.round(b.x) }; });
  const out = {}; for (const [k, s] of Object.entries(sel)) out[k] = g(s);
  out.cols = cols; return out;
}, MINE_SEL);

const browser = await chromium.launch();
const ctx = await browser.newContext();
const ref = await ctx.newPage(), mine = await ctx.newPage();
const settle = async (p, url) => {
  await p.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 800) { scrollTo(0, y); await new Promise(r => setTimeout(r, 40)); } });
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
  const cw = (a) => a.map((c) => c.w + '@' + c.x).join(' ');
  const same = cw(r.cols) === cw(m.cols);
  console.log(`  cols       ref ${cw(r.cols)}\n             mine ${cw(m.cols)} ${same ? '✓' : '✗'}`);
}
console.log(`\nworst delta: ${worst}px`);
await browser.close();
