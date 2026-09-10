import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await (await b.newContext({ reducedMotion: 'reduce' })).newPage();
const settle = async (p,u)=>{ await p.goto(u,{waitUntil:'domcontentloaded',timeout:60000});
  await p.evaluate(async()=>{await document.fonts.ready;let l=-1,s=0;for(let i=0;i<60&&s<3;i++){await new Promise(r=>requestAnimationFrame(()=>setTimeout(r,100)));const h=document.documentElement.scrollHeight;s=h===l?s+1:0;l=h;}});
  await p.waitForTimeout(300); };
for (const w of [360, 600, 768, 1024, 1280, 1440]) {
  await p.setViewportSize({width:w,height:900});
  await settle(p,'https://storefaq.io/feature-request/');
  const o = await p.evaluate(() => {
    const cs=e=>getComputedStyle(e);
    const rel=(e,t)=>{const q=e.getBoundingClientRect();return `${q.width.toFixed(1)}x${q.height.toFixed(1)}@${Math.round(q.x)},${(q.top+scrollY-t).toFixed(1)}`;};
    const form=document.querySelector('.eb-form');
    const t=form.getBoundingClientRect().top+scrollY;
    const fields=[...document.querySelectorAll('.eb-field-wrapper')];
    const row=document.querySelector('.eb-wrapper-i32hz .eb-row-inner');
    const cols=row? [...row.children].filter(e=>e.getBoundingClientRect().width>0) : [];
    return {
      row: row? `${row.getBoundingClientRect().width.toFixed(1)}@${Math.round(row.getBoundingClientRect().x)} gap=${cs(row).gap} wrap=${cs(row).flexWrap}` : null,
      cols: cols.map(c=>`${c.getBoundingClientRect().width.toFixed(1)}@${Math.round(c.getBoundingClientRect().x)},${(c.getBoundingClientRect().top+scrollY).toFixed(1)}`),
      formTop: t.toFixed(1),
      fields: fields.map(f=>{
        const lbl=f.querySelector('label'), inp=f.querySelector('input,textarea');
        return `${f.className.split(' ')[0].padEnd(26)} ${rel(f,t)}  label ${lbl?rel(lbl,t):'-'}  input ${inp?rel(inp,t):'-'}  m=${cs(f).margin}`;
      }),
      submitWrap: (()=>{const s=document.querySelector('.eb-form-submit');return `${rel(s,t)} m=${cs(s).margin}`;})(),
      submit: (()=>{const s=document.querySelector('.eb-form-submit-button');return `${rel(s,t)} ff=${cs(s).fontFamily} fs=${cs(s).fontSize} fw=${cs(s).fontWeight} p=${cs(s).padding} bg=${cs(s).backgroundColor} r=${cs(s).borderRadius}`;})(),
      formH: form.getBoundingClientRect().height.toFixed(1),
    };
  });
  console.log('\n== '+w+'px  row '+o.row+'  cols '+JSON.stringify(o.cols)+'  formH='+o.formH);
  o.fields.forEach(f=>console.log('   '+f));
  console.log('   submitWrap '+o.submitWrap);
  console.log('   submit     '+o.submit);
}
await b.close();
