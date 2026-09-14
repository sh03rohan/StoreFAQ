// Box + key computed styles for selectors on a live page.
// node scripts/probe-sel.mjs <url> <width> <selector> [selector...]
import { chromium } from 'playwright';
const [url, w, ...sels] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage();
await p.setViewportSize({ width: +w, height: 900 });
await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise(r => setTimeout(r, 50)); } scrollTo(0, 0); await document.fonts.ready; });
await p.waitForTimeout(800);
for (const sel of sels) {
  const rows = await p.evaluate((sel) => [...document.querySelectorAll(sel)].slice(0, 6).map((el) => {
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    const before = getComputedStyle(el, '::before'), after = getComputedStyle(el, '::after');
    const ps = (s) => s.content !== 'none' && s.content !== 'normal' ? `content:${s.content} ${s.width}x${s.height} bg:${s.backgroundColor} bd:${s.borderBottomWidth} ${s.borderBottomColor} pos:${s.position} ${s.left}/${s.bottom}` : '';
    return `${el.tagName.toLowerCase()}.${[...el.classList].slice(0,3).join('.')} [${Math.round(r.left)},${Math.round(r.top+scrollY)} ${r.width.toFixed(1)}x${r.height.toFixed(1)}] ${cs.display} ${cs.fontFamily.split(',')[0]} ${cs.fontSize}/${cs.lineHeight} ${cs.fontWeight} ${cs.color} ls:${cs.letterSpacing} td:${cs.textDecorationLine} bg:${cs.backgroundColor} bd:${cs.borderTopWidth}/${cs.borderBottomWidth} ${cs.borderBottomColor} r:${cs.borderRadius} p:${cs.padding} m:${cs.margin} gap:${cs.gap} ${cs.flexDirection} ai:${cs.alignItems} jc:${cs.justifyContent} w:${cs.width} maxw:${cs.maxWidth} of:${cs.objectFit} ${cs.position} ${before.content!=='none'?'::before{'+ps(before)+'}':''} ${after.content!=='none'?'::after{'+ps(after)+'}':''} "${(el.textContent||'').trim().replace(/\s+/g,' ').slice(0,40)}"`;
  }), sel);
  console.log(`--- ${sel}`); rows.forEach((r) => console.log('  ' + r));
}
await b.close();
