import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BASE = 'https://storefaq.io';
const OUT = 'reference';
const VIEWPORTS = [360, 480, 768, 1024, 1280, 1440, 1920];
const DEEP = 1440;

const ROUTES = [
  '/', '/features/', '/docs/', '/docs-category/getting-started/',
  '/docs/how-to-install-storefaq/', '/blog/', '/best-shopify-faq-apps/',
  '/changelog/', '/privacy-policy/',
];

const PROPS = [
  'font-family','font-size','font-weight','line-height','letter-spacing',
  'text-transform','text-align','color','background-color','background-image',
  'padding-top','padding-right','padding-bottom','padding-left',
  'margin-top','margin-right','margin-bottom','margin-left',
  'border-top-width','border-color','border-radius','box-shadow','opacity',
  'display','flex-direction','justify-content','align-items','gap',
  'grid-template-columns','width','max-width','height','position','z-index',
  'transition-duration','transition-timing-function',
];

const slug = (r) => (r === '/' ? 'home' : r.replace(/^\/|\/$/g, '').replace(/\//g, '__'));

const browser = await chromium.launch();
const ctx = await browser.newContext({ deviceScaleFactor: 2 });
const page = await ctx.newPage();

const css = new Map();
page.on('response', async (res) => {
  if (!(res.headers()['content-type'] || '').includes('text/css')) return;
  try { css.set(res.url(), await res.text()); } catch {}
});

const KILL_MOTION = `*,*::before,*::after{
  animation-duration:0s!important;animation-delay:0s!important;
  transition-duration:0s!important;transition-delay:0s!important;
  scroll-behavior:auto!important}`;

for (const route of ROUTES) {
  const name = slug(route);
  console.log(`\n${route}`);

  for (const width of VIEWPORTS) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 60000 });

    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) {
        window.scrollTo(0, y);
        await new Promise(r => setTimeout(r, 60));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(600);
    await page.addStyleTag({ content: KILL_MOTION });

    await mkdir(path.join(OUT, 'screens'), { recursive: true });
    await page.screenshot({
      path: path.join(OUT, 'screens', `${name}-${width}.png`),
      fullPage: true,
    });
    console.log(`  ${width}px`);

    if (width !== DEEP) continue;

    await mkdir(path.join(OUT, 'html'), { recursive: true });
    await writeFile(path.join(OUT, 'html', `${name}.html`), await page.content());

    const computed = await page.$$eval('[class]', (els, props) =>
      els.slice(0, 4000).map((el, i) => {
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {
          i, tag: el.tagName.toLowerCase(),
          cls: [...el.classList].join(' '),
          text: (el.textContent || '').trim().slice(0, 60),
          box: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
          styles: Object.fromEntries(props.map(p => [p, s.getPropertyValue(p)])),
        };
      }), PROPS);

    await mkdir(path.join(OUT, 'computed'), { recursive: true });
    await writeFile(path.join(OUT, 'computed', `${name}.json`), JSON.stringify(computed, null, 2));

    const fonts = await page.evaluate(() =>
      [...document.styleSheets]
        .flatMap(ss => { try { return [...ss.cssRules]; } catch { return []; } })
        .filter(r => r.constructor.name === 'CSSFontFaceRule')
        .map(r => r.cssText));
    await writeFile(path.join(OUT, `fonts-${name}.txt`), fonts.join('\n\n'));
  }
}

await mkdir(path.join(OUT, 'css'), { recursive: true });
let i = 0;
for (const [url, text] of css) {
  await writeFile(
    path.join(OUT, 'css', `${String(i++).padStart(2, '0')}-${url.split('/').pop().split('?')[0]}`),
    `/* ${url} */\n${text}`);
}
await writeFile(path.join(OUT, 'css', '_all.css'), [...css.values()].join('\n\n'));

await browser.close();
console.log(`\nDone. ${css.size} stylesheets, ${ROUTES.length} routes.`);
