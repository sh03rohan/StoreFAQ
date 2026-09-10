// Segments a page into its top-level sections with geometry, background and
// heading, so Phase 5 can be worked one section at a time.
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';

const route = process.argv[2] ?? '/';
const width = Number(process.argv[3] ?? 1440);
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width, height: 900 });
await page.goto('https://storefaq.io' + route, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.evaluate(async () => {
  for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); }
  scrollTo(0, 0);
});
await page.waitForTimeout(800);

const sections = await page.evaluate(() => {
  const main = document.querySelector('main') ?? document.body;
  // Top-level Essential Blocks wrappers are the section boundaries.
  const nodes = [...main.querySelectorAll('.wp-block-essential-blocks-wrapper')]
    .filter((e) => {
      const r = e.getBoundingClientRect();
      if (r.width < 100 || r.height < 40) return false;
      // keep only outermost
      return !e.parentElement?.closest('.wp-block-essential-blocks-wrapper');
    });
  return nodes.map((e, i) => {
    const r = e.getBoundingClientRect();
    const inner = e.querySelector('.eb-wrapper-outer');
    const s = inner ? getComputedStyle(inner) : getComputedStyle(e);
    const heads = [...e.querySelectorAll('.first-title, h1, h2, h3')]
      .filter((h) => h.getBoundingClientRect().width > 0)
      .map((h) => h.textContent.trim().replace(/\s+/g, ' ').slice(0, 60));
    const imgs = [...e.querySelectorAll('img')].filter((m) => m.getBoundingClientRect().width > 0);
    return {
      i,
      y: Math.round(r.top + scrollY),
      h: Math.round(r.height),
      bg: s.backgroundColor,
      bgImage: s.backgroundImage === 'none' ? null : s.backgroundImage.slice(0, 80),
      pad: s.padding,
      heading: heads[0] ?? null,
      headings: [...new Set(heads)].slice(0, 4),
      imgCount: imgs.length,
      firstImg: imgs[0]?.currentSrc.split('/').pop() ?? null,
    };
  });
});

console.log(`${route} @ ${width} — ${sections.length} sections`);
for (const s of sections) {
  console.log(`${String(s.i).padStart(2)}  y=${String(s.y).padStart(5)} h=${String(s.h).padStart(4)}  bg=${s.bg.padEnd(22)} imgs=${String(s.imgCount).padStart(2)}  ${JSON.stringify(s.heading)}`);
}
await writeFile(`reference/sections-${route === '/' ? 'home' : route.replace(/\//g, '')}-${width}.json`, JSON.stringify(sections, null, 2));
await browser.close();
