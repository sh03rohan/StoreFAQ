import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await (await b.newContext({ reducedMotion: 'reduce' })).newPage();
const settle = async (p,u)=>{ await p.goto(u,{waitUntil:'networkidle',timeout:90000});
  await p.evaluate(async()=>{await document.fonts.ready;let l=-1,s=0;for(let i=0;i<40&&s<3;i++){await new Promise(r=>requestAnimationFrame(()=>setTimeout(r,100)));const h=document.documentElement.scrollHeight;s=h===l?s+1:0;l=h;}});
  await p.waitForTimeout(300); };
for (const w of [360, 480, 768, 1024, 1280, 1440, 1920]) {
  await p.setViewportSize({width:w,height:900});
  await settle(p,'https://storefaq.io/privacy-policy/');
  const o = await p.evaluate(() => {
    const cs=e=>e&&getComputedStyle(e);
    const B=e=>{if(!e)return null;const q=e.getBoundingClientRect();return `${q.width.toFixed(1)}x${q.height.toFixed(1)}@${Math.round(q.x)},${(q.top+scrollY).toFixed(1)}`;};
    const F=e=>{const c=cs(e);return c?`${c.fontFamily.split(',')[0].replace(/"/g,'')} ${c.fontSize}/${c.lineHeight} ${c.fontWeight} ${c.color}`:null;};
    const M=e=>{const c=cs(e);return c?`m=${c.margin} pad=${c.padding}`:null;};
    const main=document.querySelector('main');
    const grp=document.querySelector('main > .wp-block-group');
    const h1=document.querySelector('.wp-block-post-title');
    const ec=document.querySelector('.entry-content');
    const sp=[...document.querySelectorAll('.wp-block-spacer')];
    const p0=ec.querySelector('p');
    const h3=ec.querySelector('h3');
    const st=h3.querySelector('strong');
    const ul=ec.querySelector('ul');
    const li=ec.querySelector('li');
    const ps=[...ec.querySelectorAll(':scope > p')];
    const h3s=[...ec.querySelectorAll(':scope > h3')];
    return {
      pageH: document.documentElement.scrollHeight,
      main: B(main)+' | '+M(main)+' bg='+cs(main).backgroundColor,
      grp: B(grp)+' | '+M(grp),
      spacers: sp.map(e=>B(e)).join(' ; '),
      h1: B(h1)+' | '+F(h1)+' | '+M(h1)+' align='+cs(h1).textAlign,
      ec: B(ec)+' | '+M(ec),
      p0: B(p0)+' | '+F(p0)+' | '+M(p0),
      h3: B(h3)+' | '+F(h3)+' | '+M(h3),
      strong: F(st)+' '+M(st),
      ul: B(ul)+' | '+M(ul)+' lst='+cs(ul).listStyleType,
      li: B(li)+' | '+F(li)+' | '+M(li),
      pGaps: ps.slice(0,4).map((e,i)=>ps[i+1]?+(ps[i+1].getBoundingClientRect().top-e.getBoundingClientRect().bottom).toFixed(1):null).join(','),
      h3Count: h3s.length,
    };
  });
  console.log('\n== '+w+'px pageH='+o.pageH+' h3s='+o.h3Count+' pGaps='+o.pGaps);
  for (const k of ['main','grp','spacers','h1','ec','p0','h3','strong','ul','li']) console.log('   '+k.padEnd(8), o[k]);
}
await b.close();
