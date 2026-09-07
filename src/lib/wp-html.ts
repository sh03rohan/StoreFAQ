import { parse, HTMLElement } from 'node-html-parser';

const CMS = import.meta.env?.WP_URL ?? 'https://cms.storefaq.io';
const SITE = 'https://storefaq.io';

/** Posts moved from /<slug>/ to /blog/<slug>/ (A1 decision). */
const POST_SLUGS = new Set<string>();
export function registerPostSlugs(slugs: Iterable<string>): void {
  for (const s of slugs) POST_SLUGS.add(s);
}

// Classes that must never survive (guide §B1).
//
// The guide's regex leaves real WordPress markup behind. Verified against the
// longest post, these also survived it and are added here:
//   is-style-*, has-fixed-layout   core Gutenberg block styles
//   thinkrank-*                    SEO plugin's FAQ block
//   betterdocs-*, ff-*, fluentform-*, nx-*  other plugins in the stack
const KILL_CLASS =
  /^(wp-|eb-|is-layout-|is-style-|has-fixed-layout$|has-.*-(color|background|font-size)$|elementor|essential-blocks|thinkrank|betterdocs|ff-|fluentform|notificationx|nx-|size-|attachment-|alignwide|alignfull)/;

// A few plugin classes carry real structure. Renaming beats stripping: the
// semantics survive under our own names and no plugin identity ships.
const RENAME_CLASS: Record<string, string> = {
  'thinkrank-faq': 'faq',
  'thinkrank-faq__heading': 'faq__heading',
  'thinkrank-faq__item': 'faq__item',
  'thinkrank-faq__question': 'faq__question',
  'thinkrank-faq__answer': 'faq__answer',
  aligncenter: 'align-center',
  alignleft: 'align-left',
  alignright: 'align-right',
};

// Attributes carrying builder state.
const KILL_ATTR = /^(data-(block|eb|id|widget|element|settings)|itemprop|itemscope|itemtype)/;

// Gutenberg wrappers that add nothing semantically.
const UNWRAP = ['wp-block-group', 'wp-block-columns', 'wp-block-column', 'eb-wrapper'];

export function cleanWpHtml(html: string): string {
  const root = parse(html, { blockTextElements: { script: false, style: false } });

  // 1. Drop builder-only nodes entirely.
  for (const sel of ['.wp-block-spacer', 'style', 'script', 'noscript', '.eb-parent-wrapper > style']) {
    root.querySelectorAll(sel).forEach((n) => n.remove());
  }

  // 2. Unwrap layout containers, keeping their children.
  //    Iterate innermost-first so nested wrappers collapse in one pass.
  for (const el of [...root.querySelectorAll('div,section')].reverse()) {
    const cls = el.getAttribute('class')?.split(/\s+/) ?? [];
    if (cls.some((c) => UNWRAP.some((u) => c.startsWith(u)))) {
      el.replaceWith(...el.childNodes);
    }
  }

  // 3. Strip builder classes and attributes from everything that remains.
  for (const el of root.querySelectorAll('*')) {
    if (!(el instanceof HTMLElement)) continue;

    const kept = (el.getAttribute('class') ?? '')
      .split(/\s+/)
      .map((c) => RENAME_CLASS[c] ?? c)
      .filter((c) => c && !KILL_CLASS.test(c) && c !== 'screen-reader-text');
    kept.length ? el.setAttribute('class', kept.join(' ')) : el.removeAttribute('class');

    for (const name of Object.keys(el.attributes)) {
      if (KILL_ATTR.test(name)) el.removeAttribute(name);
    }
    // Inline styles are builder spacing artefacts; tokens own spacing now.
    el.removeAttribute('style');
  }

  // 4. Semantic normalisation.
  for (const b of root.querySelectorAll('b')) b.tagName = 'strong';
  for (const i of root.querySelectorAll('i')) i.tagName = 'em';

  // 5. Links — rewrite to canonical, mark external.
  for (const a of root.querySelectorAll('a[href]')) {
    let href = a.getAttribute('href') ?? '';
    if (href.startsWith(CMS)) href = SITE + href.slice(CMS.length);

    if (href.startsWith(SITE) || href.startsWith('/')) {
      const u = new URL(href, SITE);
      const last = u.pathname.split('/').pop() ?? '';
      if (!u.pathname.endsWith('/') && !last.includes('.')) u.pathname += '/';

      // Old root-level post URLs now live under /blog/.
      const seg = u.pathname.split('/').filter(Boolean);
      if (seg.length === 1 && POST_SLUGS.has(seg[0]!)) {
        u.pathname = `/blog/${seg[0]}/`;
      }

      a.setAttribute('href', u.pathname + u.search + u.hash);
      a.removeAttribute('target');
      a.removeAttribute('rel');
    } else if (/^https?:\/\//.test(href)) {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    }
  }

  // 6. Images — lazy, async, keep intrinsic dimensions for CLS.
  for (const img of root.querySelectorAll('img')) {
    img.setAttribute('loading', 'lazy');
    img.setAttribute('decoding', 'async');
    if (!img.getAttribute('alt')) img.setAttribute('alt', '');
    // Uploads are served through the /wp-content/* proxy (guide §B4), so the
    // host is stripped whichever domain WP hands back.
    for (const attr of ['src', 'srcset']) {
      const v = img.getAttribute(attr);
      if (!v) continue;
      const rewritten = v.replaceAll(CMS, '').replaceAll(SITE, '');
      if (rewritten !== v) img.setAttribute(attr, rewritten);
    }
  }

  // 7. Remove nodes left empty by the unwrapping above.
  for (const el of root.querySelectorAll('p,div,span')) {
    if (!el.textContent.trim() && !el.querySelector('img,iframe,video,svg')) el.remove();
  }

  return root.toString();
}
