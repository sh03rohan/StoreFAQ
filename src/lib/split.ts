/**
 * Wraps each word of a heading for the word-by-word reveal in effects.css.
 * Inline-block per word, with the spaces kept between them, so the line
 * breaks exactly where the plain text did. Inline tags (<mark>, <span>,
 * <br>) pass through untouched, so a highlighted phrase keeps its markup.
 *
 * `delay` is the start of the cascade for a heading that plays on load;
 * headings below the fold play when scrolled into view (Effects.astro adds
 * `is-in`). Each word follows the last by 45ms.
 */
export function splitWords(html: string, delay = 0): string {
  let i = 0;
  return html.trim().split(/(<[^>]+>|\s+|&nbsp;)/).map((t) => {
    if (!t) return '';
    if (/^<[^>]+>$/.test(t) || /^\s+$/.test(t) || t === '&nbsp;') return t;
    return `<span class="fx-w" style="--fx-i:${i++};--fx-d:${delay}s"><span>${t}</span></span>`;
  }).join('');
}
