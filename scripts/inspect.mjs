// Dumps every rendered element in a y-range with geometry + type, so a
// section can be rebuilt from measurements rather than a screenshot.
// Usage: node scripts/inspect.mjs <route> <width> <yFrom> <yTo>
import { chromium } from 'playwright';

const [route = '/', width = '1440', yFrom = '0', yTo = '99999'] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: Number(width), height: 900 });
await page.goto('https://storefaq.io' + route, { waitUntil: 'networkidle', timeout: 60000 });
await page.evaluate(async () => {
  for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); }
  scrollTo(0, 0);
});
await page.waitForTimeout(800);

const rows = await page.evaluate(([a, b]) => {
  const out = [];
  for (const e of document.querySelectorAll('*')) {
    const r = e.getBoundingClientRect();
    const top = r.top + scrollY;
    if (r.width < 1 || r.height < 1) continue;
    if (top + r.height < a || top > b) continue;
    const s = getComputedStyle(e);
    if (s.visibility === 'hidden' || s.opacity === '0') continue;
    const own = [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ').trim();
    const isImg = e.tagName === 'IMG';
    // Keep leaf-ish nodes: text owners, images, and boxes with a background
    const hasBg = s.backgroundColor !== 'rgba(0, 0, 0, 0)' || s.backgroundImage !== 'none';
    if (!own && !isImg && !hasBg) continue;
    out.push({
      y: Math.round(top), x: Math.round(r.x), w: Math.round(r.width), h: Math.round(r.height),
      tag: e.tagName.toLowerCase(),
      cls: (typeof e.className === 'string' ? e.className : '').split(' ').filter(Boolean).slice(0, 2).join('.'),
      text: own.replace(/\s+/g, ' ').slice(0, 52) || null,
      src: isImg ? e.currentSrc.split('/').pop() : null,
      fs: s.fontSize, lh: s.lineHeight, fw: s.fontWeight, ff: s.fontFamily.split(',')[0].replace(/"/g, ''),
      color: s.color,
      bg: s.backgroundColor === 'rgba(0, 0, 0, 0)' ? null : s.backgroundColor,
      bgImg: s.backgroundImage === 'none' ? null : s.backgroundImage.slice(0, 60),
      radius: s.borderRadius === '0px' ? null : s.borderRadius,
      pad: s.padding === '0px' ? null : s.padding,
      border: s.borderTopWidth === '0px' && s.borderBottomWidth === '0px' ? null : `${s.borderWidth} ${s.borderColor}`,
    });
  }
  return out.sort((p, q) => p.y - q.y || p.x - q.x);
}, [Number(yFrom), Number(yTo)]);

for (const r of rows) {
  const t = r.text ? JSON.stringify(r.text) : (r.src ? `<${r.src}>` : '');
  const type = r.text ? `${r.ff} ${r.fs}/${r.lh} w${r.fw} ${r.color}` : '';
  console.log(
    `${String(r.y).padStart(5)} ${String(r.x).padStart(5)} ${(r.w + 'x' + r.h).padEnd(10)} ${(r.tag + '.' + r.cls).slice(0, 34).padEnd(35)} ${type.padEnd(46)} ${r.bg ?? ''} ${r.radius ?? ''} ${r.pad ?? ''} ${t}`);
}
console.log(`\n${rows.length} rendered elements in y ${yFrom}..${yTo}`);
await browser.close();
