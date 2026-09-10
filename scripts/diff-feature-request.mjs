// Diffs /feature-request/ geometry AND paint against the live site.
//
// The page is the same WordPress shell as /privacy-policy/ plus a two-column
// form block, so it checks the shell, both columns and every field.
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4321';
const VIEWPORTS = [360, 480, 768, 1024, 1280, 1440, 1920];

const b = await chromium.launch();
const ctx = await b.newContext({ reducedMotion: 'reduce' });
const ref = await ctx.newPage(), mine = await ctx.newPage();

/* `domcontentloaded`, NOT `networkidle` — see the note in diff-docs.mjs. */
const settle = async (p, u) => {
  await p.goto(u, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.evaluate(async () => {
    await Promise.race([
      Promise.all([...document.images].filter((i) => !i.complete)
        .map((i) => new Promise((r) => { i.addEventListener('load', r, { once: true });
          i.addEventListener('error', r, { once: true }); }))),
      new Promise((r) => setTimeout(r, 5000)),
    ]);
    await document.fonts.ready;
    let last = -1, stable = 0;
    for (let i = 0; i < 80 && stable < 3; i++) {
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 100)));
      const h = document.documentElement.scrollHeight;
      stable = h === last ? stable + 1 : 0;
      last = h;
    }
  });
  await p.waitForTimeout(300);
};

const read = (page, S) => page.evaluate((S) => {
  const q = (s, root = document) => root.querySelector(s);
  const cs = (e) => e && getComputedStyle(e);
  const g = (e) => { if (!e) return null; const r = e.getBoundingClientRect();
    return { w: +r.width.toFixed(1), h: +r.height.toFixed(1), x: Math.round(r.x), y: +(r.top + scrollY).toFixed(1) }; };
  const glyph = (e) => { if (!e) return null; const r = document.createRange(); r.selectNodeContents(e);
    const b = r.getBoundingClientRect();
    return { w: +b.width.toFixed(1), h: +b.height.toFixed(1), x: Math.round(b.x), y: +(b.top + scrollY).toFixed(1) }; };
  const typ = (e) => { const c = cs(e); if (!c) return null;
    return { family: c.fontFamily.split(',')[0].replace(/"/g, ''), size: parseFloat(c.fontSize),
      lh: c.lineHeight === 'normal' ? 'normal' : parseFloat(c.lineHeight),
      weight: c.fontWeight, color: c.color }; };
  const paint = (e) => { const c = cs(e); if (!c) return null;
    const bw = parseFloat(c.borderTopWidth);
    return [c.backgroundColor, bw > 0 ? bw + 'px ' + c.borderTopColor : 'none', c.borderRadius, c.padding].join(' | '); };

  const main = q(S.main);
  const top = main.getBoundingClientRect().top + scrollY;
  const rel = (e, fn = g) => { const v = fn(e); return v && { ...v, y: +(v.y - top).toFixed(1) }; };
  /* Scoped to the form: the page also carries the footer newsletter's field,
   * which matches the same class and is 0x0 far above. */
  const fields = [...q(S.form).querySelectorAll(S.field)];

  return {
    pageH: document.documentElement.scrollHeight,
    main: g(main),
    title: rel(q(S.title), glyph),
    row: rel(q(S.row)),
    cols: [...document.querySelectorAll(S.col)].filter((e) => e.getBoundingClientRect().width > 0).map((e) => rel(e)),
    h2: rel(q(S.h2), glyph),
    intro: rel(q(S.intro), glyph),
    form: rel(q(S.form)),
    /* Every field, with its label and control measured against the FORM's top
     * so one wrong gap is reported where it happens. */
    fields: (() => {
      const f0 = q(S.form).getBoundingClientRect().top + scrollY;
      const r2 = (e, fn = g) => { const v = fn(e); return v && { ...v, y: +(v.y - f0).toFixed(1) }; };
      return fields.map((f) => ({
        box: r2(f),
        label: r2(q('label', f)),
        control: r2(q('input, textarea', f)),
        labelType: typ(q('label', f)),
        controlType: typ(q('input, textarea', f)),
        controlPaint: paint(q('input, textarea', f)),
        icon: r2(q(S.icon, f)),
        /* Paint per field. The asterisk's red and the one grey glyph are
         * invisible to every box measurement here — the crop caught both. */
        iconColor: (() => { const i = q(S.icon, f); if (!i) return null;
          const c = cs(i); return c.fill && c.fill !== 'none' && c.fill !== 'rgb(0, 0, 0)' ? c.fill : c.color; })(),
        requiredColor: (() => { const r = q(S.required, f); return r && cs(r).color; })(),
        placeholder: (() => { const c = q('input, textarea', f); return c && getComputedStyle(c, '::placeholder').color; })(),
      }));
    })(),
    submitWrap: (() => { const f0 = q(S.form).getBoundingClientRect().top + scrollY; const e = q(S.submitWrap);
      const v = g(e); return v && { ...v, y: +(v.y - f0).toFixed(1) }; })(),
    submit: (() => { const f0 = q(S.form).getBoundingClientRect().top + scrollY; const e = q(S.submit);
      const v = g(e); return v && { ...v, y: +(v.y - f0).toFixed(1) }; })(),
    submitType: typ(q(S.submit)),
    submitPaint: paint(q(S.submit)),
    h2Type: typ(q(S.h2)),
    introType: typ(q(S.intro)),
    titleType: typ(q(S.title)),
  };
}, S);

const REF = {
  main: 'main', title: '.wp-block-post-title',
  row: '.eb-wrapper-i32hz .eb-row-inner',
  col: '.eb-wrapper-i32hz > * > * > * > * > .eb-row-root-container .eb-row-inner > .wp-block-essential-blocks-column',
  h2: '.entry-content h2', intro: '.entry-content p.wp-block-paragraph',
  form: '.eb-form', field: '.eb-field-wrapper', icon: '.eb-input-icon',
  submitWrap: '.eb-form-submit', submit: '.eb-form-submit-button',
  required: '.eb-required',
};
const MINE = {
  main: 'main.plain', title: '.plain__title',
  row: '.frq__row', col: '.frq__col',
  h2: '.frq__title', intro: '.frq__intro',
  form: '.frq__form', field: '.frq__field', icon: '.frq__icon',
  submitWrap: '.frq__submit-wrap', submit: '.frq__submit',
  required: '.frq__required',
};

/* Font size compared to 0.01px: a fluid clamp reproduced from measured values
 * lands within four decimals and string equality calls that a failure. The
 * submit button's FAMILY is not compared — the original never sets one, so it
 * is whatever the browser's default UI face is, and this build does the same. */
/* `normal` leading is not comparable to a number, and does not need to be:
 * where the reference leaves it at `normal` the rendered BOX is what settles
 * it, and that is compared separately. */
const sameLh = (a, c) => a === 'normal' || c === 'normal' ? true : Math.abs(a - c) < 0.01;
const sameType = (a, c, skipFamily = false) => a && c
  && (skipFamily || a.family === c.family) && a.weight === c.weight && a.color === c.color
  && Math.abs(a.size - c.size) < 0.01 && sameLh(a.lh, c.lh);
const fmt = (t) => t && `${t.family} ${t.size}/${t.lh} ${t.weight} ${t.color}`;

let fails = 0, worst = 0;
const cmp = (label, a, c, keys = ['w', 'h', 'x', 'y'], indent = '  ') => {
  if (!a || !c) { console.log(`${indent}${label.padEnd(11)} MISSING ref=${!!a} mine=${!!c}`); fails++; return; }
  const d = keys.map((k) => +(c[k] - a[k]).toFixed(1));
  const bad = d.some((v) => Math.abs(v) > 2);
  if (bad) fails++;
  worst = Math.max(worst, ...d.map(Math.abs));
  console.log(`${indent}${label.padEnd(11)} ref ${a.w}x${a.h}@${a.x},${a.y}  mine ${c.w}x${c.h}@${c.x},${c.y}  Δ${d.join(',')} ${bad ? '✗' : '✓'}`);
};
const cmpType = (label, a, c, skipFamily = false, indent = '  ') => {
  const ok = sameType(a, c, skipFamily);
  if (!ok) { fails++; worst = Math.max(worst, 3); }
  console.log(`${indent}${label.padEnd(11)} ${ok ? '✓' : `✗\n${indent}   ref  ${fmt(a)}\n${indent}   mine ${fmt(c)}`}`);
};

for (const w of VIEWPORTS) {
  await ref.setViewportSize({ width: w, height: 900 });
  await mine.setViewportSize({ width: w, height: 900 });
  await settle(ref, 'https://storefaq.io/feature-request/');
  await settle(mine, BASE + '/feature-request/');
  const r = await read(ref, REF), m = await read(mine, MINE);
  console.log(`\n${w}px  pageH ref ${r.pageH} mine ${m.pageH} Δ${m.pageH - r.pageH}  fields ref ${r.fields.length} mine ${m.fields.length}`);

  cmp('main', r.main, m.main, ['w', 'h', 'x']);
  cmp('title', r.title, m.title);
  cmp('row', r.row, m.row);
  cmp('h2', r.h2, m.h2);
  cmp('intro', r.intro, m.intro);
  cmp('form', r.form, m.form);
  cmpType('titleType', r.titleType, m.titleType);
  cmpType('h2Type', r.h2Type, m.h2Type);
  cmpType('introType', r.introType, m.introType);

  if (r.cols.length !== m.cols.length) {
    console.log(`  cols      COUNT ref ${r.cols.length} mine ${m.cols.length}`); fails++;
  } else r.cols.forEach((a, i) => cmp(`col[${i}]`, a, m.cols[i]));

  if (r.fields.length !== m.fields.length) {
    console.log(`  fields    COUNT MISMATCH`); fails++;
  } else r.fields.forEach((a, i) => {
    const c = m.fields[i];
    console.log(`  field[${i}]`);
    cmp('box', a.box, c.box, ['w', 'h', 'x', 'y'], '    ');
    cmp('label', a.label, c.label, ['w', 'h', 'x', 'y'], '    ');
    cmp('control', a.control, c.control, ['w', 'h', 'x', 'y'], '    ');
    cmp('icon', a.icon, c.icon, ['w', 'h', 'x', 'y'], '    ');
    cmpType('labelType', a.labelType, c.labelType, false, '    ');
    cmpType('ctrlType', a.controlType, c.controlType, false, '    ');
    const pOk = a.controlPaint === c.controlPaint;
    if (!pOk) { fails++; worst = Math.max(worst, 3); }
    console.log(`    ctrlPaint   ${pOk ? '✓' : `✗\n       ref  ${a.controlPaint}\n       mine ${c.controlPaint}`}`);
    for (const k of ['iconColor', 'requiredColor']) {
      const ok = a[k] === c[k];
      if (!ok) { fails++; worst = Math.max(worst, 3); }
      console.log(`    ${k.padEnd(11)} ${ok ? '✓' : `✗ ref ${a[k]} mine ${c[k]}`}`);
    }
    const phOk = a.placeholder === c.placeholder;
    if (!phOk) { fails++; worst = Math.max(worst, 3); }
    console.log(`    placeholder ${phOk ? '✓' : `✗ ref ${a.placeholder} mine ${c.placeholder}`}`);
  });

  cmp('submitWrap', r.submitWrap, m.submitWrap);
  cmp('submit', r.submit, m.submit);
  cmpType('submitType', r.submitType, m.submitType, true);   // family: see note above
  const sOk = r.submitPaint === m.submitPaint;
  if (!sOk) { fails++; worst = Math.max(worst, 3); }
  console.log(`  submitPaint ${sOk ? '✓' : `✗\n     ref  ${r.submitPaint}\n     mine ${m.submitPaint}`}`);
}
console.log(`\nfails ${fails}, worst ${worst}px`);
await b.close();
