import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await (await b.newContext({ reducedMotion: 'reduce' })).newPage();
const settle = async (p,u)=>{ await p.goto(u,{waitUntil:'domcontentloaded',timeout:60000});
  await p.evaluate(async()=>{await document.fonts.ready;let l=-1,s=0;for(let i=0;i<60&&s<3;i++){await new Promise(r=>requestAnimationFrame(()=>setTimeout(r,100)));const h=document.documentElement.scrollHeight;s=h===l?s+1:0;l=h;}});
  await p.waitForTimeout(300); };
for (const w of [360, 768, 1280, 1440]) {
  await p.setViewportSize({width:w,height:900});
  await settle(p,'https://storefaq.io/feature-request/');
  const o = await p.evaluate(() => {
    const cs=e=>e&&getComputedStyle(e);
    const B=e=>{if(!e)return null;const q=e.getBoundingClientRect();return `${q.width.toFixed(1)}x${q.height.toFixed(1)}@${Math.round(q.x)},${(q.top+scrollY).toFixed(1)}`;};
    const F=e=>{const c=cs(e);return c?`${c.fontFamily.split(',')[0].replace(/"/g,'')} ${c.fontSize}/${c.lineHeight} ${c.fontWeight} ${c.color}`:null;};
    const M=e=>{const c=cs(e);return c?`m=${c.margin} p=${c.padding} bg=${c.backgroundColor} r=${c.borderRadius} bd=${c.border}`:null;};
    const q=s=>document.querySelector(s);
    const rows=[...document.querySelectorAll('.eb-form-fields .eb-row-inner')];
    return {
      pageH: document.documentElement.scrollHeight,
      main: B(q('main')),
      h1: B(q('.wp-block-post-title'))+' | '+F(q('.wp-block-post-title')),
      ec: B(q('.entry-content'))+' | '+M(q('.entry-content')),
      outer: B(q('.eb-wrapper-i32hz'))+' | '+M(q('.eb-wrapper-i32hz')),
      col: B(q('.eb-column-pabkd'))+' | '+M(q('.eb-column-pabkd')),
      h2: B(q('.entry-content h2'))+' | '+F(q('.entry-content h2'))+' | '+M(q('.entry-content h2')),
      intro: B(q('.entry-content p.wp-block-paragraph'))+' | '+F(q('.entry-content p.wp-block-paragraph'))+' | '+M(q('.entry-content p.wp-block-paragraph')),
      form: B(q('.eb-form'))+' | '+M(q('.eb-form')),
      fieldRows: rows.map(r=>B(r)+' gap='+cs(r).gap+' wrap='+cs(r).flexWrap),
      field0: B(q('.eb-field-wrapper'))+' | '+M(q('.eb-field-wrapper')),
      label: B(q('.eb-field-wrapper label'))+' | '+F(q('.eb-field-wrapper label'))+' | '+M(q('.eb-field-wrapper label')),
      inputWrap: B(q('.eb-field-input-wrap'))+' | '+M(q('.eb-field-input-wrap')),
      icon: B(q('.eb-input-icon'))+' | '+F(q('.eb-input-icon'))+' | '+M(q('.eb-input-icon')),
      input: B(q('input.eb-field-input'))+' | '+F(q('input.eb-field-input'))+' | '+M(q('input.eb-field-input'))+' ph='+cs(q('input.eb-field-input'),'::placeholder').color,
      textarea: B(q('textarea.eb-field-input'))+' | '+M(q('textarea.eb-field-input')),
      submitWrap: B(q('.eb-form-submit'))+' | '+M(q('.eb-form-submit'))+' align='+cs(q('.eb-form-submit')).textAlign+' just='+cs(q('.eb-form-submit')).justifyContent,
      submit: B(q('.eb-form-submit-button'))+' | '+F(q('.eb-form-submit-button'))+' | '+M(q('.eb-form-submit-button')),
    };
  });
  console.log('\n===== '+w+'px pageH='+o.pageH);
  for (const [k,v] of Object.entries(o)) if(k!=='pageH') console.log('  '+k.padEnd(11), Array.isArray(v)?v.join('\n              '):v);
}
await b.close();
