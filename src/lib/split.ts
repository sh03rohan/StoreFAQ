/**
 * Wraps each word of a heading for the word-by-word reveal in effects.css.
 * Inline-block per word, with the spaces kept between them, so the line
 * breaks exactly where the plain text did. `delay` is the start of the
 * cascade; each word follows the last by 45ms.
 */
export function splitWords(text: string, delay = 0): string {
  return text.trim().split(/\s+/).map((w, i) =>
    `<span class="fx-w" style="--fx-i:${i};--fx-d:${delay}s"><span>${w}</span></span>`).join(' ');
}
