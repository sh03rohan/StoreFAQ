import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await (await b.newContext({ reducedMotion: 'reduce' })).newPage();
const settle = async (p,u)=>{ await p.goto(u,{waitUntil:'domcontentloaded',timeout:60000});
  await p.evaluate(async()=>{await document.fonts.ready;let l=-1,s=0;for(let i=0;i<60&&s<3;i++){await new Promise(r=>requestAnimationFrame(()=>setTimeout(r,100)));const h=document.documentElement.scrollHeight;s=h===l?s+1:0;l=h;}});
  await p.waitForTimeout(300); };
for (const w of [360, 768, 1024, 1280, 1440]) {
  await p.setViewportSize({width:w,height:900});
  await settle(p,'https://storefaq.io/docs/how-to-install-storefaq/');
  const o = await p.evaluate(() => {
    const cs=e=>e&&getComputedStyle(e);
    const D=e=>{if(!e)return null;const r=e.getBoundingClientRect();return `${r.width.toFixed(1)}x${r.height.toFixed(1)}@${Math.round(r.x)},${(r.top+scrollY).toFixed(1)}`;};
    const F=e=>{const c=cs(e);return c?`${c.fontFamily.split(',')[0].replace(/"/g,'')} ${c.fontSize}/${c.lineHeight} ${c.fontWeight} ${c.color}`:null;};
    const q=s=>document.querySelector(s);
    const main=q('main')||q('.wp-site-blocks > div:nth-child(2)');
    const layout=q('.betterdocs-wrapper')||q('#betterdocs-full-sidebar-left')?.parentElement;
    const side=q('#betterdocs-full-sidebar-left');
    const crumb=q('#betterdocs-breadcrumb');
    const content=q('#betterdocs-single-content');
    const h1=q('.betterdocs-entry-title')||q('h1');
    const firstH2=content?.querySelector('h2');
    const firstP=content?.querySelector('p');
    const img=content?.querySelector('img');
    return {
      pageH: document.documentElement.scrollHeight,
      layout: D(layout)+' disp='+(cs(layout)?.display)+' gap='+(cs(layout)?.gap),
      side: D(side)+' disp='+(cs(side)?.display)+' bg='+(cs(side)?.backgroundColor),
      crumb: D(crumb)+' | '+F(crumb),
      content: D(content)+' pad='+(cs(content)?.padding)+' bg='+(cs(content)?.backgroundColor),
      h1: D(h1)+' | '+F(h1),
      h2: D(firstH2)+' | '+F(firstH2)+' m='+(cs(firstH2)?.margin),
      p: D(firstP)+' | '+F(firstP)+' m='+(cs(firstP)?.margin),
      img: D(img)+' r='+(cs(img)?.borderRadius),
    };
  });
  console.log('\n== '+w+'px pageH='+o.pageH);
  for (const [k,v] of Object.entries(o)) if(k!=='pageH') console.log('   '+k.padEnd(8), v);
}
await b.close();
