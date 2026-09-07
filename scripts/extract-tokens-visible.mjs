// Refines TOKENS.md by counting only *rendered* elements (non-zero box).
// The raw pass counts hidden plugin widgets, icon fonts and theme defaults,
// which pollutes the tally (Cardo, Arial, default link blue etc).
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DIR = 'reference/computed';
const GROUPS = {};
const add = (g, k, v, w = 1) => {
  if (!v || ['none','normal','0px','auto','rgba(0, 0, 0, 0)','0%'].includes(v)) return;
  GROUPS[g] ??= new Map();
  const e = GROUPS[g].get(v) ?? { n: 0, where: new Set() };
  e.n += 1; if (e.where.size < 4 && k) e.where.add(k);
  GROUPS[g].set(v, e);
};

let total = 0, visible = 0;
for (const f of await readdir(DIR)) {
  const page = f.replace('.json', '');
  for (const el of JSON.parse(await readFile(path.join(DIR, f), 'utf8'))) {
    total++;
    const b = el.box;
    if (!b || b.w < 1 || b.h < 1) continue;          // not rendered
    const s = el.styles;
    if (s.opacity === '0' || s.display === 'none') continue;
    visible++;
    const at = `${page}:${el.tag}.${(el.cls || '').split(' ')[0]}`;
    add('font-family', at, s['font-family']);
    add('font-size',   at, s['font-size']);
    add('font-weight', at, s['font-weight']);
    add('line-height', at, s['line-height']);
    add('letter-spacing', at, s['letter-spacing']);
    add('color',       at, s['color']);
    add('background',  at, s['background-color']);
    add('radius',      at, s['border-radius']);
    add('shadow',      at, s['box-shadow']);
    add('gap',         at, s['gap']);
    add('max-width',   at, s['max-width']);
    for (const side of ['top','right','bottom','left']) {
      add('spacing', at, s[`padding-${side}`]);
      add('spacing', at, s[`margin-${side}`]);
    }
  }
}

const px = (v) => parseFloat(v) || 0;
const hex = (v) => {
  const m = /^rgba?\((\d+), *(\d+), *(\d+)(?:, *([\d.]+))?\)$/.exec(v);
  if (!m) return '';
  if (m[4] !== undefined && +m[4] < 1) return ` (alpha ${m[4]})`;
  return ' ' + '#' + [m[1],m[2],m[3]].map(n => (+n).toString(16).padStart(2,'0')).join('').toUpperCase();
};

let md = `# Extracted tokens — rendered elements only\n\n`
  + `${visible} of ${total} captured elements are actually rendered.\n`
  + `Counts below exclude hidden plugin widgets and icon-font nodes.\n`
  + `Count under 3 is usually a one-off, not a token.\n`;

for (const [group, map] of Object.entries(GROUPS)) {
  const rows = [...map.entries()].sort((a, b) => b[1].n - a[1].n).filter(([, e]) => e.n >= 2);
  const sorted = ['font-size','spacing','radius','gap','max-width','line-height'].includes(group)
    ? [...rows].sort((a, b) => px(a[0]) - px(b[0])) : rows;
  md += `\n## ${group} (${rows.length} distinct)\n\n`;
  for (const [v, e] of sorted) {
    const suffix = ['color','background'].includes(group) ? hex(v) : '';
    md += `- \`${v}\`${suffix} — ×${e.n}  _${[...e.where].slice(0,2).join(', ')}_\n`;
  }
}
await writeFile('reference/TOKENS-visible.md', md);
console.log(`rendered ${visible}/${total}; wrote reference/TOKENS-visible.md`);
