import { parse, HTMLElement } from 'node-html-parser';

/**
 * Guide §B1 — Gutenberg HTML in, clean semantic HTML out.
 *
 * Used twice: at build time to freeze the docs into the repo, and at render
 * time for blog bodies coming from the CMS. One implementation, so the two
 * cannot drift.
 *
 * The guide's KILL_CLASS was too narrow against this site's actual output —
 * `is-style-stripes`, `has-fixed-layout`, `aligncenter` and five `thinkrank-*`
 * classes all survived it, and all of them would have passed the enforcement
 * gate, which only greps for `wp-|eb-|elementor|is-layout-`. Extended, and
 * `scripts/assert-sanitiser.mjs` runs it over every real document.
 */

const CMS = import.meta.env?.CMS_URL ?? 'https://cms.storefaq.io';
const SITE = 'https://storefaq.io';

const KILL_CLASS =
  /^(wp-|eb-|root-eb-|is-layout-|is-style-|has-fixed-layout$|has-.*-(color|background|font-size)$|elementor|essential-blocks|thinkrank|betterdocs|notificationx|nx-|ff-|fluentform|size-|attachment-|align(wide|full|center|left|right)$)/;

const KILL_ATTR = /^(data-(block|eb|id|widget|element|settings|icon|new-tab|link|show-badge)|itemprop|itemscope|itemtype|aria-describedby$)/;

const UNWRAP = ['wp-block-group', 'wp-block-columns', 'wp-block-column', 'eb-wrapper',
  'eb-parent-wrapper', 'eb-row', 'wp-block-buttons', 'wp-container'];

/** Blocks that carry no meaning once the builder is gone. */
const DROP = ['.wp-block-spacer', 'style', 'script', 'noscript', '.screen-reader-text',
  '.wp-block-post-navigation-link', '.betterdocs-entry-footer', '.betterdocs-feedback',
  '#betterdocs-ia', '.notificationx'];

export function cleanWpHtml(html: string): string {
  let root = parse(html, { blockTextElements: { script: false, style: false } });

  // 1. Drop builder-only nodes entirely.
  for (const sel of DROP) root.querySelectorAll(sel).forEach((n) => n.remove());

  // 2. Unwrap layout containers, keeping their children. Repeated, because
  //    these nest — unwrapping once leaves the inner ones behind.
  for (let pass = 0; pass < 8; pass++) {
    let unwrapped = 0;
    for (const el of root.querySelectorAll('div,section,figure')) {
      const cls = (el.getAttribute('class') ?? '').split(/\s+/);
      // A <figure> that holds a caption is meaningful; one that is only a
      // builder wrapper is not.
      if (el.tagName === 'FIGURE' && el.querySelector('figcaption')) continue;
      if (cls.some((c) => c && UNWRAP.some((u) => c.startsWith(u)))) {
        el.replaceWith(el.childNodes.map((n) => n.toString()).join(''));
        unwrapped++;
      }
    }
    if (!unwrapped) break;
    // `replaceWith` takes a STRING, which node-html-parser re-parses into new
    // nodes that the current query result does not know about. Without this
    // re-parse the strip pass below never visits them, and `wp-block-image`,
    // `wp-image-1089` and friends sail straight through. That is what the
    // sanitiser assertion caught on three of the sixteen docs.
    root = parse(root.toString(), { blockTextElements: { script: false, style: false } });
  }

  // 3. Strip builder classes and attributes from everything that remains.
  for (const el of root.querySelectorAll('*')) {
    if (!(el instanceof HTMLElement)) continue;

    const kept = (el.getAttribute('class') ?? '')
      .split(/\s+/)
      .filter((c) => c && !KILL_CLASS.test(c));
    kept.length ? el.setAttribute('class', kept.join(' ')) : el.removeAttribute('class');

    for (const name of Object.keys(el.attributes)) {
      if (KILL_ATTR.test(name)) el.removeAttribute(name);
    }
    // Inline styles are builder spacing artefacts; tokens own spacing now.
    el.removeAttribute('style');
    // WordPress ids are block hashes, except on headings where they are the
    // anchor targets a table of contents and any existing deep link rely on.
    const id = el.getAttribute('id');
    if (id && !/^H[1-6]$/.test(el.tagName)) el.removeAttribute('id');
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
      a.setAttribute('href', u.pathname + u.search + u.hash);
      a.removeAttribute('target');
      a.removeAttribute('rel');
    } else if (/^https?:\/\//.test(href)) {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    }
  }

  // 6. Images — lazy, async, and never without an alt attribute.
  for (const img of root.querySelectorAll('img')) {
    img.setAttribute('loading', 'lazy');
    img.setAttribute('decoding', 'async');
    if (img.getAttribute('alt') === null) img.setAttribute('alt', '');
    for (const junk of ['srcset', 'sizes', 'fetchpriority']) img.removeAttribute(junk);
  }

  // 7. Remove nodes left empty by the unwrapping above.
  for (const el of root.querySelectorAll('p,div,span,figure')) {
    if (!el.textContent.trim() && !el.querySelector('img,iframe,video,svg')) el.remove();
  }

  return root.toString().replace(/\n{3,}/g, '\n\n').trim();
}

/** Rewrites uploads to the local mirror. Phase 7 puts the files there. */
export function localiseMedia(html: string, map: Record<string, string>): string {
  return html.replace(/https?:\/\/(?:cms\.)?storefaq\.io\/wp-content\/uploads\/([^\s"'?)]+)/g,
    (whole, path) => map[path] ?? whole);
}
