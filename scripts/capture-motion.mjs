// Supplements capture-reference.mjs: that script injects KILL_MOTION *before*
// reading computed styles, so transition/animation values there are all 0s.
// This reads them with motion intact. No screenshots — values only.
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';

const BASE = 'https://storefaq.io';
const ROUTES = ['/', '/features/', '/docs/', '/docs-category/getting-started/',
  '/docs/how-to-install-storefaq/', '/blog/', '/best-shopify-faq-apps/',
  '/changelog/', '/privacy-policy/'];
const PROPS = ['transition-duration','transition-timing-function','transition-property',
  'transition-delay','animation-duration','animation-timing-function','animation-name'];

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1440, height: 900 });

const tally = {};
const add = (k, v) => {
  if (!v || v === '0s' || v === 'none' || v === 'all' || v === '0s, 0s') return;
  tally[k] ??= new Map();
  tally[k].set(v, (tally[k].get(v) || 0) + 1);
};
const samples = {};

for (const route of ROUTES) {
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const rows = await page.$$eval('[class]', (els, props) =>
    els.slice(0, 4000).map((el) => ({
      tag: el.tagName.toLowerCase(),
      cls: [...el.classList].join(' '),
      styles: Object.fromEntries(props.map(p => [p, getComputedStyle(el).getPropertyValue(p)])),
    })), PROPS);

  for (const r of rows) {
    for (const p of PROPS) add(p, r.styles[p]);
    // Keep concrete examples for the components §B3 calls out.
    for (const key of ['accordion', 'nav', 'menu', 'btn', 'button', 'slide', 'carousel', 'swiper', 'card']) {
      if (r.cls.toLowerCase().includes(key) && r.styles['transition-duration'] !== '0s') {
        (samples[key] ??= new Set()).add(
          `${r.tag}.${r.cls.split(' ')[0]}  ${r.styles['transition-duration']}  ${r.styles['transition-timing-function']}  [${r.styles['transition-property']}]`);
      }
    }
  }
  console.log('read', route);
}

let md = '# Motion values (captured with motion intact)\n\n' +
  'The main capture zeroes these; use this file for §B3 timings.\n';
for (const [k, map] of Object.entries(tally)) {
  const rows = [...map.entries()].sort((a, b) => b[1] - a[1]).filter(([, n]) => n >= 2);
  md += `\n## ${k} (${rows.length} distinct)\n\n`;
  for (const [v, n] of rows) md += `- \`${v}\`  ×${n}\n`;
}
md += '\n# Samples by component\n';
for (const [k, set] of Object.entries(samples)) {
  md += `\n## ${k}\n\n`;
  for (const s of [...set].slice(0, 12)) md += `- \`${s}\`\n`;
}
await writeFile('reference/MOTION.md', md);
await browser.close();
console.log('Wrote reference/MOTION.md');
