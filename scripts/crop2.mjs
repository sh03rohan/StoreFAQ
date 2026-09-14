// crop-el with different paths per side
import { chromium } from 'playwright';
const [,, refSel, mineSel, w, name, refPath, minePath] = process.argv;
const b = await chromium.launch();
const ctx = await b.newContext({ reducedMotion: 'reduce', deviceScaleFactor: 2 });
for (const [label, base, sel, path] of [['ref', 'https://storefaq.io', refSel, refPath], ['mine', 'http://localhost:4321', mineSel, minePath]]) {
  const p = await ctx.newPage(); await p.setViewportSize({ width: +w, height: 900 });
  await p.goto(base + path, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 800) { scrollTo(0, y); await new Promise(r => setTimeout(r, 30)); } scrollTo(0, 0); await document.fonts.ready; });
  await p.waitForTimeout(800);
  const el = await p.$(sel); if (!el) { console.log(label + ': not found ' + sel); continue; }
  await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(200);
  await el.screenshot({ path: `/tmp/crops/${name}-${label}-${w}.png` });
  await p.close();
}
await b.close(); console.log(`/tmp/crops/${name}-{ref,mine}-${w}.png`);
