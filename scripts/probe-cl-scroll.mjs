// Does the timeline behave the same as the original as you scroll?
import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ reducedMotion: 'reduce' });
const ref = await ctx.newPage(), mine = await ctx.newPage();
const settle = async (p,u)=>{ await p.goto(u,{waitUntil:'domcontentloaded',timeout:90000});
  await p.evaluate(async()=>{await document.fonts.ready;}); await p.waitForTimeout(500); };
const rd = (p, sel) => p.evaluate((s)=>{
  const rows=[...document.querySelectorAll(s.entry)];
  const line=document.querySelector(s.line);
  const op=rows.map(r=>+getComputedStyle(r).opacity);
  return { active: op.findIndex(o=>o>0.9), lit: op.filter(o=>o>0.9).length,
    dim: op.filter(o=>o<0.4).length, linePos: getComputedStyle(line).position,
    lineTop: Math.round(line.getBoundingClientRect().top),
    // x as well: a fixed bar with `left` set jumps to the viewport edge while
    // `position` still reads "fixed". Caught once already.
    lineX: Math.round(line.getBoundingClientRect().left) };
}, sel);
const R={entry:'.timeline-row',line:'.timeline-line'}, M={entry:'.cl__entry',line:'.cl__line'};
await ref.setViewportSize({width:1280,height:900}); await mine.setViewportSize({width:1280,height:900});
await settle(ref,'https://storefaq.io/changelog/'); await settle(mine,'http://localhost:4321/changelog/');
for (const y of [0, 600, 1500, 4000, 9000, 17000]) {
  for (const p of [ref, mine]) { await p.evaluate((y)=>scrollTo(0,y), y); await p.waitForTimeout(350); }
  const r=await rd(ref,R), m=await rd(mine,M);
  const ok = r.active===m.active && r.lit===m.lit && r.dim===m.dim && r.linePos===m.linePos && r.lineTop===m.lineTop && r.lineX===m.lineX;
  console.log(`scrollY ${String(y).padStart(6)}  ref active=${r.active} lit=${r.lit} dim=${r.dim} line=${r.linePos}@${r.lineX},${r.lineTop}`
    + `   mine active=${m.active} lit=${m.lit} dim=${m.dim} line=${m.linePos}@${m.lineX},${m.lineTop}  ${ok?'✓':'✗'}`);
}
// no-JS: nothing may be dimmed
const nojs = await b.newContext({ javaScriptEnabled: false });
const p2 = await nojs.newPage(); await p2.setViewportSize({width:1280,height:900});
await p2.goto('http://localhost:4321/changelog/',{waitUntil:'networkidle'});
await p2.waitForTimeout(800);
const d = await p2.evaluate(()=>[...document.querySelectorAll('.cl__entry')].filter(e=>+getComputedStyle(e).opacity<0.99).length);
console.log(`no-JS: entries below full opacity -> ${d} ${d===0?'✓':'✗'}`);
await b.close();
