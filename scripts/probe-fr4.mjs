import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await (await b.newContext({ reducedMotion: 'reduce' })).newPage();
await p.setViewportSize({width:1280,height:900});
await p.goto('https://storefaq.io/feature-request/',{waitUntil:'domcontentloaded',timeout:60000});
await p.evaluate(async()=>{await document.fonts.ready;});
await p.waitForTimeout(800);
console.log(await p.evaluate(()=>{
  const cs=e=>getComputedStyle(e);
  const D=e=>{const r=e.getBoundingClientRect();return `${r.width.toFixed(1)}x${r.height.toFixed(1)}@${Math.round(r.x)},${(r.top+scrollY).toFixed(1)}`;};
  const cols=[...document.querySelectorAll('.eb-wrapper-i32hz .eb-row-inner > .wp-block-essential-blocks-column')];
  const col1=cols[1];
  const out=['col1 '+D(col1)+' align='+cs(col1.parentElement).alignItems];
  const walk=(n,d)=>{for(const c of n.children){const r=c.getBoundingClientRect();
    if(d<8) out.push('  '.repeat(d)+c.tagName.toLowerCase()+'.'+(c.className||'').toString().replace(/eb-parent-[\w-]+|root-eb-[\w-]+/g,'').trim().slice(0,32)+' '+D(c)+' m='+cs(c).margin+' p='+cs(c).padding+' disp='+cs(c).display);
    if(d<8) walk(c,d+1);}};
  walk(col1,0);
  // textarea specifics
  const ta=document.querySelector('textarea.eb-field-input');
  const wrap=ta.parentElement;
  out.push('TEXTAREA '+D(ta)+' disp='+cs(ta).display+' lh='+cs(ta).lineHeight+' va='+cs(ta).verticalAlign);
  out.push('WRAP     '+D(wrap)+' disp='+cs(wrap).display+' lh='+cs(wrap).lineHeight+' fs='+cs(wrap).fontSize);
  const inp=document.querySelector('input.eb-field-input');
  out.push('INPUT    '+D(inp)+' disp='+cs(inp).display+' va='+cs(inp).verticalAlign);
  out.push('INPWRAP  '+D(inp.parentElement)+' disp='+cs(inp.parentElement).display+' lh='+cs(inp.parentElement).lineHeight);
  return out.join('\n');
}));
await b.close();
