// Header/footer geometry at every viewport. The main capture only dumps
// computed styles at 1440, which says nothing about the mobile nav.
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';

const VIEWPORTS = [360, 480, 768, 1024, 1280, 1440, 1920];
const browser = await chromium.launch();
const page = await browser.newPage();
const out = {};

for (const w of VIEWPORTS) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.goto('https://storefaq.io/', { waitUntil: 'networkidle', timeout: 60000 });
  out[w] = await page.evaluate(() => {
    const box = (sel) => {
      const e = document.querySelector(sel);
      if (!e) return null;
      const r = e.getBoundingClientRect();
      const s = getComputedStyle(e);
      return {
        x: Math.round(r.x), y: Math.round(r.y),
        w: Math.round(r.width), h: Math.round(r.height),
        display: s.display, visible: r.width > 0 && r.height > 0 && s.visibility !== 'hidden',
      };
    };
    const header = document.querySelector('.eb-wrapper-outer');
    const hr = header?.getBoundingClientRect();
    return {
      headerH: hr ? Math.round(hr.height) : null,
      row: box('.eb-row-wrapper'),
      logo: box('.eb-image-wrapper-inner'),
      nav: box('nav.is-responsive .wp-block-navigation__container'),
      hamburger: box('.wp-block-navigation__responsive-container-open'),
      cta: box('.eb-button-anchor'),
      firstItem: box('.wp-block-navigation-item__content'),
    };
  });
  console.log(w, JSON.stringify(out[w].hamburger?.visible ? 'HAMBURGER' : 'full nav'),
    'headerH=' + out[w].headerH, 'row=' + (out[w].row ? out[w].row.w + '@' + out[w].row.x : '-'),
    'cta=' + (out[w].cta?.visible ? 'yes' : 'no'));
}
await writeFile('reference/CHROME.json', JSON.stringify(out, null, 2));
await browser.close();
