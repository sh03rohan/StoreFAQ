// Side-by-side crops of a section from the live site and the local build.
// Usage: node scripts/crop.mjs <refSelectorKey> <mineSelector> <width> <outName>
import { chromium } from 'playwright';

const [key, mineSel, width = '1440', out = 'crop'] = process.argv.slice(2);
const REF = {
  hero: () => document.querySelectorAll('main .wp-block-essential-blocks-wrapper')[0],
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

await shoot('https://storefaq.io/', REF[key], `/tmp/crops/${out}-ref-${width}.png`);
await shoot('http://localhost:4321/', new Function(`return document.querySelector(${JSON.stringify(mineSel)})`), `/tmp/crops/${out}-mine-${width}.png`);
console.log(`/tmp/crops/${out}-{ref,mine}-${width}.png`);
await browser.close();
