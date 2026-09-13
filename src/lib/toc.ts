import { parse } from 'node-html-parser';

export interface TocEntry {
  id: string;
  text: string;
  level: 2 | 3 | 4;
  children: TocEntry[];
}

/**
 * Builds the "On this page" list from a sanitised body and gives every
 * h2/h3/h4 a stable id to anchor to. The original numbers them `0-toc-title`,
 * `1-toc-title`… in document order; reproduced, so any deep link that already
 * points at `#3-toc-title` keeps working.
 *
 * Three levels, because the docs use h4 and the original lists them.
 */
export function withToc(html: string): { html: string; toc: TocEntry[] } {
  const root = parse(html);
  const toc: TocEntry[] = [];
  let i = 0;
  for (const h of root.querySelectorAll('h2, h3, h4')) {
    const id = `${i++}-toc-title`;
    h.setAttribute('id', id);
    const level = Number(h.tagName[1]) as 2 | 3 | 4;
    const entry: TocEntry = { id, text: h.text.replace(/\s+/g, ' ').trim(), level, children: [] };
    /* Nest under the nearest open ancestor of a shallower level; a heading
     * with no such ancestor becomes a top-level entry. */
    const parentOf = (list: TocEntry[], lvl: number): TocEntry[] => {
      const last = list.at(-1);
      if (!last || last.level >= lvl) return list;
      return parentOf(last.children, lvl);
    };
    parentOf(toc, level).push(entry);
  }
  return { html: root.toString(), toc };
}
