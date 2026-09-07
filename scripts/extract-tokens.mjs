import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DIR = 'reference/computed';
const tally = {};
const add = (k, v) => {
  if (!v || ['none','normal','0px','auto','rgba(0, 0, 0, 0)'].includes(v)) return;
  tally[k] ??= new Map();
  tally[k].set(v, (tally[k].get(v) || 0) + 1);
};

for (const f of await readdir(DIR)) {
  for (const el of JSON.parse(await readFile(path.join(DIR, f), 'utf8'))) {
    const s = el.styles;
    add('color', s['color']);
    add('background', s['background-color']);
    add('font-family', s['font-family']);
    add('font-size', s['font-size']);
    add('font-weight', s['font-weight']);
    add('line-height', s['line-height']);
    add('letter-spacing', s['letter-spacing']);
    add('radius', s['border-radius']);
    add('shadow', s['box-shadow']);
    add('gap', s['gap']);
    add('max-width', s['max-width']);
    add('duration', s['transition-duration']);
    add('easing', s['transition-timing-function']);
    for (const side of ['top','right','bottom','left']) {
      add('spacing', s[`padding-${side}`]);
      add('spacing', s[`margin-${side}`]);
    }
  }
}

const px = (v) => parseFloat(v) || 0;
let md = '# Extracted tokens\n\nSorted by usage. Count under 3 is usually a one-off, not a token.\n';

for (const [group, map] of Object.entries(tally)) {
  const rows = [...map.entries()].sort((a, b) => b[1] - a[1]).filter(([, n]) => n >= 2);
  const sorted = ['font-size','spacing','radius','gap','max-width'].includes(group)
    ? [...rows].sort((a, b) => px(a[0]) - px(b[0])) : rows;
  md += `\n## ${group} (${rows.length} distinct)\n\n`;
  for (const [v, n] of sorted) md += `- \`${v}\`  ×${n}\n`;
}
await writeFile('reference/TOKENS.md', md);

const cssText = await readFile('reference/css/_all.css', 'utf8');
const bps = [...new Set([...cssText.matchAll(/@media[^{]*?(\d+(?:\.\d+)?)px/g)].map(m => +m[1]))]
  .sort((a, b) => a - b);
await writeFile('reference/BREAKPOINTS.md',
  '# Breakpoints in stylesheets\n\n' + bps.map(b => `- ${b}px`).join('\n'));

console.log('Wrote reference/TOKENS.md and reference/BREAKPOINTS.md');
