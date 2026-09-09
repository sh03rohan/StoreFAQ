// Glyph rects via Range on BOTH sides — the only like-for-like comparison when
// one side wraps its text in an inline span and the other does not.
import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ reducedMotion: 'reduce' });
const ref = await ctx.newPage(), mine = await ctx.newPage();
const settle = async (p,u)=>{ await p.goto(u,{waitUntil:'networkidle',timeout:60000});
  await p.evaluate(async()=>{for(let y=0;y<document.body.scrollHeight;y+=700){scrollTo(0,y);await new Promise(r=>setTimeout(r,50));}scrollTo(0,0);});
  await p.evaluate(async()=>{await document.fonts.ready;let l=-1,s=0;for(let i=0;i<80&&s<3;i++){await new Promise(r=>requestAnimationFrame(()=>setTimeout(r,100)));const h=document.documentElement.scrollHeight;s=h===l?s+1:0;l=h;}});
  await p.waitForTimeout(300); };
const rd = p => p.evaluate(()=>{
  const own=e=>[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());
  const all=[...document.querySelectorAll('*')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0;});
  const card=[...document.querySelectorAll('*')].find(e=>getComputedStyle(e).backgroundColor==='rgb(106, 166, 60)');
  const base=card.getBoundingClientRect().bottom+scrollY;
  const glyph=t=>{const e=all.filter(x=>new RegExp('^'+t+'$').test(x.textContent.trim())&&own(x)).pop();
    if(!e)return null; const r=document.createRange(); r.selectNodeContents(e);
    const b=r.getBoundingClientRect(); const c=getComputedStyle(e);
    return {y:+(b.top+scrollY-base).toFixed(1), h:+b.height.toFixed(1),
      fs:c.fontSize, lh:c.lineHeight, fw:c.fontWeight, ff:c.fontFamily.split(',')[0].replace(/"/g,'')}; };
  const out={};
  for (const t of ['Apps','StoreSEO','BetterDocs for Shopify','Trust\\.Sync','EasyFlow','Get Help','Support'])
    out[t.replace('\\','')]=glyph(t);
  return out;
});
const W=Number(process.argv[2]||360);
await ref.setViewportSize({width:W,height:900}); await mine.setViewportSize({width:W,height:900});
await settle(ref,'https://storefaq.io/docs/'); await settle(mine,'http://localhost:4321/docs/');
const r=await rd(ref), m=await rd(mine);
console.log('W='+W+'   glyph y relative to newsletter-card bottom');
for (const k of Object.keys(r)) {
  const a=r[k], c=m[k];
  if(!a||!c){console.log('  '+k.padEnd(24),'MISSING',!!a,!!c);continue;}
  console.log('  '+k.padEnd(24), `ref y${String(a.y).padStart(7)} h${a.h} ${a.ff} ${a.fs}/${a.lh} ${a.fw}`);
  console.log('  '+' '.repeat(24), `mine y${String(c.y).padStart(7)} h${c.h} ${c.ff} ${c.fs}/${c.lh} ${c.fw}   Δy ${(c.y-a.y).toFixed(1)}`);
}
await b.close();
