import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await (await b.newContext()).newPage();
await p.setViewportSize({width:1280,height:900});
await p.goto('https://storefaq.io/privacy-policy/',{waitUntil:'networkidle',timeout:90000});
await p.evaluate(async()=>{await document.fonts.ready;});
console.log(await p.evaluate(()=>{
  const cs=e=>getComputedStyle(e);
  const h1=document.querySelector('.wp-block-post-title');
  return [
    'body bg='+cs(document.body).backgroundColor,
    'html bg='+cs(document.documentElement).backgroundColor,
    'main bg='+cs(document.querySelector('main')).backgroundColor,
    'h1 rendered family='+cs(h1).fontFamily,
    'Cardo loaded? '+document.fonts.check('400 52px Cardo'),
    'faces: '+[...document.fonts].filter(f=>/Cardo/.test(f.family)).map(f=>f.family+' '+f.weight+' '+f.status).join(', '),
  ].join('\n');
}));
await b.close();
