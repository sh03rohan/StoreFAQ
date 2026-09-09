// Side-by-side crops of a section from the live site and the local build.
// Usage: node scripts/crop.mjs <refSelectorKey> <mineSelector> <width> <outName>
import { chromium } from 'playwright';

const [key, mineSel, width = '1440', out = 'crop', route = '/'] = process.argv.slice(2);
const REF = {
  hero: () => document.querySelectorAll('main .wp-block-essential-blocks-wrapper')[0],
  pricingBadge: () => { const vis = e => { const q = e.getBoundingClientRect(); return q.width > 0 && q.height > 0; };
    const b = [...document.querySelectorAll('*')].filter(vis).find(e => /^\s*Popular\s*$/.test(e.textContent) && e.children.length < 3);
    return b.closest('.eb-wrapper-outer'); },
  featuresList: () => [...document.querySelectorAll('main .wp-block-essential-blocks-wrapper')].filter(e => {
    const q = e.getBoundingClientRect();
    return q.width >= 100 && q.height >= 40 && !e.parentElement?.closest('.wp-block-essential-blocks-wrapper');
  })[1].querySelector('.eb-wrapper-outer'),
  faq: () => { const a = document.querySelector('.eb-accordion-container');
    const w = []; for (let e = a; (e = e.closest('.eb-wrapper-outer')); e = e.parentElement) w.push(e);
    return w[w.length - 1]; },
  testimonials: () => [...document.querySelectorAll('.first-title')]
    .find(e => /Here.s What Our Users Say/.test(e.textContent)).closest('.eb-wrapper-outer'),
};
const browser = await chromium.launch();
const ctx = await browser.newContext({ deviceScaleFactor: 2 });

const shoot = async (url, resolve, path) => {
  const p = await ctx.newPage();
  await p.setViewportSize({ width: Number(width), height: 900 });
  await p.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise(r => setTimeout(r, 50)); } scrollTo(0, 0); });
  await p.waitForTimeout(600);
  await p.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
  const h = await p.evaluateHandle(resolve);
  const el = h.asElement();
  await el.scrollIntoViewIfNeeded();
  await p.waitForTimeout(250);
  await el.screenshot({ path });
  await p.close();
};

await shoot('https://storefaq.io' + route, REF[key], `/tmp/crops/${out}-ref-${width}.png`);
await shoot('http://localhost:4321' + route, new Function(`return document.querySelector(${JSON.stringify(mineSel)})`), `/tmp/crops/${out}-mine-${width}.png`);
console.log(`/tmp/crops/${out}-{ref,mine}-${width}.png`);
await browser.close();
