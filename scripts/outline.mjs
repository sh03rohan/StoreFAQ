// DOM outline of a live route with geometry + paint, for building a page from
// scratch. node scripts/outline.mjs /blog/ 1440 [rootSelector] [maxDepth]
import { chromium } from 'playwright';
const [route='/', w='1440', rootSel='main', maxDepth='8', skipSel=''] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage();
await p.setViewportSize({ width: +w, height: 900 });
await p.goto('https://storefaq.io' + route, { waitUntil: 'domcontentloaded', timeout: 90000 });
await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); } scrollTo(0, 0); await document.fonts.ready; });
await p.waitForTimeout(1000);
const out = await p.evaluate(({ rootSel, maxDepth, skipSel }) => {
  const root = document.querySelector(rootSel) ?? document.body;
  const lines = [];
  const walk = (el, d) => {
    if (d > maxDepth) return;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    const cls = [...el.classList].filter(c => !/^root-eb|^eb-parent-eb|^eb-.*-[a-z0-9]{5}$/.test(c)).slice(0, 4).join('.');
    const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').replace(/\s+/g, ' ').slice(0, 50);
    const paint = [];
    if (cs.backgroundColor !== 'rgba(0, 0, 0, 0)') paint.push('bg:' + cs.backgroundColor);
    if (cs.backgroundImage !== 'none') paint.push('bgi:' + cs.backgroundImage.slice(0, 50));
    if (cs.borderTopWidth !== '0px' || cs.borderLeftWidth !== '0px') paint.push('bd:' + cs.borderTopWidth + ' ' + cs.borderTopColor);
    if (cs.borderRadius !== '0px') paint.push('r:' + cs.borderRadius);
    if (cs.padding !== '0px') paint.push('p:' + cs.padding);
    if (cs.margin !== '0px') paint.push('m:' + cs.margin);
    if (cs.display.includes('flex') || cs.display.includes('grid')) paint.push(cs.display + (cs.gap !== 'normal' ? ' gap:' + cs.gap : '') + (cs.flexDirection !== 'row' ? ' ' + cs.flexDirection : '') + (cs.gridTemplateColumns !== 'none' ? ' cols:' + cs.gridTemplateColumns : ''));
    if (cs.position !== 'static') paint.push(cs.position);
    if (own || /^(H[1-6]|A|P|SPAN|LI|TIME|BUTTON|INPUT|TD|TH)$/.test(el.tagName)) paint.push(`${cs.fontFamily.split(',')[0]} ${cs.fontSize}/${cs.lineHeight} ${cs.fontWeight} ${cs.color}${cs.textDecorationLine !== 'none' ? ' ' + cs.textDecorationLine : ''}`);
    if (el.tagName === 'IMG') paint.push('img:' + el.getAttribute('src')?.split('/').pop()?.slice(0, 40) + ' ' + el.naturalWidth + 'x' + el.naturalHeight + ' fit:' + cs.objectFit);
    lines.push(`${'  '.repeat(d)}${el.tagName.toLowerCase()}${cls ? '.' + cls : ''} [${Math.round(r.left)},${Math.round(r.top + scrollY)} ${Math.round(r.width)}x${Math.round(r.height)}] ${paint.join(' | ')}${own ? ' "' + own + '"' : ''}`);
    if (skipSel && el.matches(skipSel)) return;
    for (const c of el.children) walk(c, d + 1);
  };
  walk(root, 0);
  return lines.join('\n');
}, { rootSel, maxDepth: +maxDepth, skipSel });
console.log(out);
await b.close();
