// Does each loaded family actually vary by weight? Measures the same string at
// several weights; a static file returns the same width for all of them.
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await (await b.newContext()).newPage();
await p.goto('http://localhost:4321/docs/', { waitUntil: 'domcontentloaded' });
await p.evaluate(async () => { await document.fonts.ready; });
const out = await p.evaluate(() => {
  const fams = { Inter: 'Inter', 'IBM Plex Sans': "'IBM Plex Sans'", 'DM Sans': "'DM Sans'", Manrope: 'Manrope' };
  const res = {};
  for (const [name, css] of Object.entries(fams)) {
    res[name] = {};
    for (const w of [300, 400, 500, 600, 700, 800]) {
      const s = document.createElement('span');
      s.textContent = 'Storeware Handgloves';
      s.style.cssText = `position:absolute;left:-9999px;white-space:nowrap;font-family:${css};font-size:40px;font-weight:${w}`;
      document.body.appendChild(s);
      res[name][w] = +s.getBoundingClientRect().width.toFixed(1);
      s.remove();
    }
  }
  return res;
});
for (const [f, ws] of Object.entries(out)) {
  const vals = Object.values(ws);
  const varies = new Set(vals).size > 1;
  console.log(f.padEnd(15), JSON.stringify(ws), varies ? '' : '   <-- SAME AT EVERY WEIGHT');
}
await b.close();
