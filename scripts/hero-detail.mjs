import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
for (const w of [360, 480, 768, 1024, 1280, 1440, 1920]) {
  await p.setViewportSize({ width: w, height: 900 });
  await p.goto('https://storefaq.io/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(500);
  const r = await p.evaluate(() => {
    const vis = (e) => { if (!e) return false; const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
    const sec = document.querySelectorAll('main .wp-block-essential-blocks-wrapper')[0];
    const g = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); const s = getComputedStyle(e);
      return { w: Math.round(b.width), h: Math.round(b.height), x: Math.round(b.x), y: Math.round(b.top + scrollY), fs: s.fontSize, lh: s.lineHeight, fw: s.fontWeight }; };
    const title = [...sec.querySelectorAll('.first-title')].find(vis);
    const sub = [...sec.querySelectorAll('.eb-ah-subtitle')].find(vis);
    const btn = [...sec.querySelectorAll('.eb-button-anchor')].filter(vis);
    const badge = [...sec.querySelectorAll('.eb-infobox-wrapper, [class*=eb-infobox]')].find(vis);
    const badgeText = [...sec.querySelectorAll('h2.title')].find(vis);
    const img = [...sec.querySelectorAll('img')].filter(vis).map(m => ({ src: m.currentSrc.split('/').pop(), ...g(m) }));
    const outer = sec.querySelector('.eb-wrapper-outer');
    const cols = [...sec.querySelectorAll('.eb-row-inner > .wp-block-essential-blocks-column')].filter(vis)
      .map(e => { const b = e.getBoundingClientRect(); return Math.round(b.width) + '@' + Math.round(b.x); });
    return {
      sec: g(outer), pad: getComputedStyle(outer).padding,
      cols,
      title: title ? { t: title.textContent.trim(), ...g(title) } : null,
      sub: sub ? { t: sub.textContent.trim(), ...g(sub) } : null,
      badge: badge ? { ...g(badge), bg: getComputedStyle(badge).backgroundColor, r: getComputedStyle(badge).borderRadius, pad: getComputedStyle(badge).padding } : null,
      badgeText: badgeText ? { t: badgeText.textContent.trim(), ...g(badgeText) } : null,
      buttons: btn.map(a => ({ t: a.textContent.trim(), href: a.getAttribute('href'), ...g(a),
        bg: getComputedStyle(a).backgroundColor, pad: getComputedStyle(a).padding })),
      imgs: img,
    };
  });
  const f = (o, ks) => o ? ks.map(k => o[k]).join('/') : '-';
  console.log(String(w).padStart(5),
    'sec', r.sec.w + 'x' + r.sec.h, 'pad', r.pad.padEnd(20),
    '| cols', r.cols.join(' ').padEnd(22),
    '| title', f(r.title, ['w','h','x','fs','lh']).padEnd(30),
    '| sub', f(r.sub, ['w','h','x','fs','lh']).padEnd(26),
    '| btn', f(r.buttons[0], ['w','h','x','fs']).padEnd(18),
    '| img', r.imgs.map(i => i.src.slice(0,12) + ' ' + i.w + 'x' + i.h + '@' + i.x + ',' + i.y).join('  '));
}
await b.close();
