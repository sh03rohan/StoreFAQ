import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await (await b.newContext({ reducedMotion: 'reduce' })).newPage();
const settle = async (p,u)=>{ await p.goto(u,{waitUntil:'domcontentloaded',timeout:60000});
  await p.evaluate(async()=>{await document.fonts.ready;let l=-1,s=0;for(let i=0;i<60&&s<3;i++){await new Promise(r=>requestAnimationFrame(()=>setTimeout(r,100)));const h=document.documentElement.scrollHeight;s=h===l?s+1:0;l=h;}});
  await p.waitForTimeout(250); };
for (const w of [360, 480, 768, 1024, 1280, 1440, 1920]) {
  await p.setViewportSize({width:w,height:900});
  await settle(p,'https://storefaq.io/feature-request/');
  const o = await p.evaluate(() => {
    const cs=e=>getComputedStyle(e);
    const q=s=>document.querySelector(s);
    const h2=q('.entry-content h2'), intro=q('.entry-content p.wp-block-paragraph');
    const outer=q('.eb-wrapper-i32hz'), ec=q('.entry-content');
    const col0=q('.eb-column-pabkd');
    const D=e=>{const r=e.getBoundingClientRect();return `${r.width.toFixed(1)}x${r.height.toFixed(1)}@${Math.round(r.x)}`;};
    return {
      ecPad: cs(ec).padding, outerPad: cs(outer).padding, outerW: D(outer),
      col0: D(col0),
      h2: `${D(h2)} ${cs(h2).fontSize}/${cs(h2).lineHeight} mt=${cs(h2).marginTop} mb=${cs(h2).marginBottom} ff=${cs(h2).fontFamily.split(',')[0]}`,
      intro: `${D(intro)} ${cs(intro).fontSize}/${cs(intro).lineHeight} mt=${cs(intro).marginTop} mb=${cs(intro).marginBottom}`,
      pageH: document.documentElement.scrollHeight,
    };
  });
  console.log(`${String(w).padStart(4)} pageH=${o.pageH} ecPad=${o.ecPad} outer=${o.outerW} pad=${o.outerPad} col0=${o.col0}`);
  console.log(`     h2    ${o.h2}`);
  console.log(`     intro ${o.intro}`);
}
await b.close();
