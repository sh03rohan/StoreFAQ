import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await (await b.newContext()).newPage();
await p.setViewportSize({width:1280,height:900});
await p.goto('https://storefaq.io/feature-request/',{waitUntil:'domcontentloaded',timeout:60000});
await p.evaluate(async()=>{await document.fonts.ready;}); await p.waitForTimeout(600);
console.log(await p.evaluate(()=>{
  const cs=e=>getComputedStyle(e);
  const out=[];
  document.querySelectorAll('.eb-form .eb-field-wrapper').forEach((f,i)=>{
    const ic=f.querySelector('.eb-input-icon');
    const lb=f.querySelector('label');
    const req=f.querySelector('.eb-required');
    out.push(`field[${i}] icon color=${ic?cs(ic).color:'-'} fs=${ic?cs(ic).fontSize:'-'} fw=${ic?cs(ic).fontWeight:'-'} ff=${ic?cs(ic).fontFamily:'-'}`);
    out.push(`          label color=${lb?cs(lb).color:'-'}  required=${req?cs(req).color:'(none)'} reqFs=${req?cs(req).fontSize:'-'}`);
  });
  return out.join('\n');
}));
await b.close();
