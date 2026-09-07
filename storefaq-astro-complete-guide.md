# storefaq.io → Astro: complete migration guide

Single source of truth for rebuilding storefaq.io on Astro. Hand this to Claude Code and work through Part C phase by phase.

**Goals**

1. Visually identical frontend — this is a migration, not a redesign
2. **Zero WordPress markup in the output** — no Gutenberg, no Elementor, no Essential Blocks classes, attributes or stylesheets anywhere
3. All links regenerated from a central route map, none copied from WP HTML
4. WordPress stays as the blog CMS; new posts go live immediately with no rebuild
5. No broken links at launch

---

# PART A — Decisions and architecture

## A1. Decisions needed before Phase 3

| Decision | Options | Chosen |
|---|---|---|
| Hosting | Netlify / Vercel / Cloudflare | |
| Styling | Tailwind (theme replaced) / plain CSS + tokens | |
| Public URLs | keep identical / restructure (see A4) | |
| Content bugs (§B7) | fix during migration / copy as-is | |
| Author archives | 301 to `/blog/` / keep noindex | |
| Docs content | MDX in repo / headless from WP | |
| Newsletter backend | Mailchimp / Brevo / other | |

If any row is blank when Phase 3 starts, stop and ask.

## A2. Architecture

```
cms.storefaq.io          WordPress — headless, no theme frontend
        │
        │  REST API  +  /wp-content proxy
        ▼
storefaq.io              Astro 5, hybrid rendering
        │
        ├── prerendered  /, /features/, /docs/*, /changelog/, /privacy-policy/
        └── SSR + edge   /blog/, /[slug], /category/*, sitemaps, /feed/
```

| Layer | Choice |
|---|---|
| Framework | Astro 5, `output: 'static'` + adapter (hybrid) |
| Styling | Own CSS against extracted tokens — **never ported WP CSS** |
| Blog content | WP REST, fetched at request time, sanitised |
| Docs content | Content collection (MDX in repo) |
| Search | Pagefind (docs), WP REST search (blog) |
| Hosting | Netlify or Vercel — both support tag-based cache purge |

```js
// astro.config.mjs
export default defineConfig({
  site: 'https://storefaq.io',
  trailingSlash: 'always',
  build: { format: 'directory' },
  output: 'static',
  adapter: netlify(),
});
```

`trailingSlash: 'always'` is not optional. Every existing WP URL ends in a slash; without it every backlink costs a 301 hop.

## A3. Route map

| Route | Rendering | Source |
|---|---|---|
| `/` | prerender | `src/pages/index.astro` |
| `/features/` | prerender | `src/pages/features.astro` |
| `/changelog/` | prerender | `src/pages/changelog.astro` |
| `/privacy-policy/` | prerender | `src/pages/privacy-policy.astro` |
| `/docs/` | prerender | `src/pages/docs/index.astro` |
| `/docs/[slug]/` | prerender | `docs` collection — 16 articles |
| `/docs-category/[slug]/` | prerender | `getting-started`, `configuration` |
| `/blog/` | SSR | WP REST, paginated |
| `/[slug]/` | SSR | WP REST — **blog posts sit at the domain root** |
| `/category/[slug]/` | SSR | `guide`, `feature`, `news` |
| `/author/[slug]/` | — | 301 to `/blog/`, or noindex |
| `/sitemap-blog.xml` | SSR | must reflect new posts without a rebuild |
| `/feed/` | SSR | same path as WP — not `/rss.xml` |
| `/404` | prerender | must return **HTTP 404**, not 200 |

`src/pages/[slug].astro` catches every unmatched path. Astro prioritises static routes, so `/features/` never reaches it — but a genuine typo must return a real 404, not a blank page.

### Content inventory

**Blog — 15 posts, root-level slugs** (verify against WP export; check whether `news` has any posts)

```
/shopify-faq-builder-app/                              2026-08-10  Guide
/faq-schema-and-product-schema-shopify-ai-search/      2026-07     Guide
/shopify-ai-chatbot-storefaq-guide/                    2026-07     Guide
/search-behavior-keywords-to-question-based-intent/    2026-06-22  Guide
/migrating-faqs-in-shopify-how-to-export-import-faqs/  2026-06     Guide
/ai-faq-app-for-shopify/                               2026-06-04  Guide
/message-shortcuts-in-storefaq/                        2026-05-28  Feature, Guide
/faq-page-vs-qapage-vs-product-schema-shopify/         2026-05-25  Guide
/shopify-instant-answer-app-to-answer-customer-queries/ 2026-05-18 Feature, Guide
/how-to-create-a-shopify-faq-page-using-storefaq/      2026-05-11  Guide
/shopify-ai-faq-builder-create-product-faqs-with-ai/   2026-04-28  Guide
/best-shopify-faq-apps/                                2026-04-21  Guide
/how-shopify-faq-schema-helps-boost-aeo-and-geo/       2026-03-31  Guide
/multilingual-faq-why-does-your-shopify-store-need-it/ 2026-03-24  Feature, Guide
/top-reasons-add-shopify-faq-page/                     2026-03-16  Guide
```

**Docs — 16 articles**

Getting Started (3): `configure-general-settings-on-storefaq`, `how-to-install-storefaq`, `how-to-upgrade-the-storefaq-plan`

Configurations (13): `add-new-faq-group-on-your-shopify-store`, `add-new-faq-on-your-shopify-store`, `configure-ai-chatbot-in-storefaq`, `configure-instant-answer-with-storefaq`, `configure-live-chat-support-in-storefaq`, `configure-message-shortcuts-in-storefaq`, `configure-multilingual-faq-support-in-storefaq`, `design-faq-page-of-your-shopify-store`, `embed-faq-groups-on-specific-pages-on-shopify`, `enable-faq-schema-in-shopify-using-storefaq`, `generate-faqs-using-ai-autowrite`, `import-and-export-faqs-on-your-shopify-store`, `shopify-sidekick-integration-in-storefaq`

The category slug is `configuration` (singular) but the display label is "Configurations". Keep the slug — changing it costs a redirect for no gain.

## A4. Do the public URLs change?

**Recommendation: no.** The 15 posts and 16 docs have accumulated ranking and backlinks. Changing slugs means every one takes a 301 hop and a temporary ranking dip, for zero user benefit.

"All links updated" in this project means **internal links are regenerated from the route map** (§B2), not that public URLs change.

If the human does want restructuring — e.g. blog posts moved from `/slug/` under `/blog/slug/` — that is a separate decision with an SEO cost. Take it only if there is a reason beyond tidiness, and if taken: 301 every old URL, update the sitemap, resubmit in GSC, and expect 4–8 weeks of instability.

---

# PART B — Policies

## B1. Zero WordPress markup

**Rule: no `wp-`, `eb-`, `elementor-` or `is-layout-` class, and no WP plugin stylesheet, may appear anywhere in the built output.**

This applies to two different surfaces, handled differently.

### Static pages — write from scratch

Home, Features, Docs, Changelog, Privacy are rebuilt as Astro components with your own class names against your own tokens. Nothing is copied from the WP DOM.

The reference capture (§C1) is used to **read values from** — fonts, colours, spacing, breakpoints — not to copy markup out of. Never paste a `<div class="wp-block-group is-layout-constrained">` into a component.

Do **not** port the theme's compiled CSS. It is fast and it works, but it drags in every plugin's rules, keeps the class names alive, and makes the "zero WP markup" goal unachievable. Rebuild the CSS.

### Blog bodies — sanitise at render time

WP REST returns `content.rendered` as Gutenberg HTML. It must be transformed to clean semantic HTML before it reaches the page.

`src/lib/wp-html.ts`:

```ts
import { parse, HTMLElement } from 'node-html-parser';

const CMS = 'https://cms.storefaq.io';
const SITE = 'https://storefaq.io';

// Classes that must never survive.
const KILL_CLASS = /^(wp-|eb-|is-layout-|has-.*-(color|background|font-size)$|elementor|essential-blocks|size-|attachment-|alignwide|alignfull)/;

// Attributes carrying builder state.
const KILL_ATTR = /^(data-(block|eb|id|widget|element|settings)|itemprop|itemscope|itemtype)/;

// Gutenberg wrappers that add nothing semantically.
const UNWRAP = ['wp-block-group', 'wp-block-columns', 'wp-block-column', 'eb-wrapper'];

export function cleanWpHtml(html: string): string {
  const root = parse(html, { blockTextElements: { script: false, style: false } });

  // 1. Drop builder-only nodes entirely.
  for (const sel of ['.wp-block-spacer', 'style', 'script', '.eb-parent-wrapper > style']) {
    root.querySelectorAll(sel).forEach((n) => n.remove());
  }

  // 2. Unwrap layout containers, keeping their children.
  for (const el of root.querySelectorAll('div,section')) {
    const cls = [...(el.classNames?.split(' ') ?? [])];
    if (cls.some((c) => UNWRAP.some((u) => c.startsWith(u)))) {
      el.replaceWith(...el.childNodes);
    }
  }

  // 3. Strip builder classes and attributes from everything that remains.
  for (const el of root.querySelectorAll('*')) {
    if (!(el instanceof HTMLElement)) continue;

    const kept = (el.getAttribute('class') ?? '')
      .split(/\s+/)
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
  }

  // 7. Remove nodes left empty by the unwrapping above.
  for (const el of root.querySelectorAll('p,div,span')) {
    if (!el.textContent.trim() && !el.querySelector('img,iframe,video,svg')) el.remove();
  }

  return root.toString();
}
```

Wrap the output in a single `.prose` container and style it there. `.prose` covers: headings, paragraphs, lists, images, figures, figcaptions, blockquotes, tables, inline and block code, links, buttons, hr.

**Style `.prose` against the longest existing post**, not a short one — that is where the unusual element types appear.

### Editor guardrail

Restrict blog editors to core Gutenberg blocks. In `cms.storefaq.io` `functions.php`:

```php
add_filter('allowed_block_types_all', function ($allowed, $ctx) {
  if ($ctx->post?->post_type !== 'post') return $allowed;
  return [
    'core/paragraph','core/heading','core/list','core/list-item',
    'core/image','core/quote','core/table','core/code',
    'core/separator','core/embed','core/buttons','core/button',
  ];
}, 10, 2);
```

This keeps the sanitiser's job small and stops a plugin update from silently introducing new markup.

### Enforcement gate

Sanitisation that is not enforced drifts. Add a build-time assertion:

```bash
# scripts/assert-clean.sh — must exit 0
if grep -rElo 'class="[^"]*(wp-|eb-|elementor|is-layout-)' dist --include='*.html' | head -1 | grep -q .; then
  echo "FAIL: WordPress markup found in build output"
  grep -rEho 'class="[^"]*(wp-|eb-|elementor|is-layout-)[^"]*"' dist --include='*.html' | sort -u | head -20
  exit 1
fi
echo "OK: no WordPress markup in output"
```

For SSR blog pages, run the same check against a rendered preview URL — `dist/` does not contain them.

## B2. Link regeneration

**Rule: no internal URL is ever written as a literal string in a component.**

`src/lib/routes.ts` is the only place URLs are defined:

```ts
export const routes = {
  home:        () => '/',
  features:    () => '/features/',
  docs:        () => '/docs/',
  doc:         (slug: string) => `/docs/${slug}/`,
  docCategory: (slug: string) => `/docs-category/${slug}/`,
  blog:        () => '/blog/',
  post:        (slug: string) => `/${slug}/`,
  category:    (slug: string) => `/category/${slug}/`,
  changelog:   () => '/changelog/',
  privacy:     () => '/privacy-policy/',
} as const;

export const external = {
  shopifyApp: 'https://apps.shopify.com/storefaq',
  support:    'https://storeware.io/support/',
} as const;
```

Every nav item, footer link, card link and CTA reads from this. If the URL structure ever changes, one file changes.

Nav and footer link lists live in `src/data/nav.ts`, built from `routes` — not hardcoded in the header component.

**Checks that must pass on the build output:**

```bash
# No CMS domain leaked into public HTML
grep -rl 'cms\.storefaq\.io' dist --include='*.html' && exit 1

# No WP paths except proxied uploads
grep -rEl '(wp-admin|wp-json|wp-includes|xmlrpc\.php|\?p=[0-9])' dist --include='*.html' && exit 1

# No internal link missing its trailing slash
grep -rEo 'href="/[a-z0-9-]+(/[a-z0-9-]+)*"' dist --include='*.html' | grep -v '\.' | sort -u
```

The last one lists candidates for review rather than failing — some are legitimately files.

## B3. UI fidelity

Extract real values first, then build against them. Never rebuild from a screenshot alone.

**Tokens to derive from the capture** (§C1–C2): font families and `@font-face` sources, type scale (size / line-height / weight / letter-spacing combinations), colours, spacing steps, container max-width and horizontal padding per breakpoint, radii, shadows, transition durations and easings.

Expect roughly 8–15 real colours, 6–10 font sizes, 6–10 spacing steps, 2–4 radii. Anything appearing fewer than three times is a one-off, not a token.

**Self-host the fonts** using the same files as the original. Do not substitute a Google Fonts lookalike — metrics differ and every line wraps differently.

**If using Tailwind, replace the theme, do not extend it.** Tailwind's default scale will not match the WP theme's, and mixing the two produces spacing that is close but never right.

**Breakpoints** come from grepping `@media` in the captured CSS, not from assumption. Verify at 360, 480, 768, 1024, 1280, 1440, 1920 plus each extracted breakpoint and one pixel either side.

### Components needing behaviour, not just markup

| Component | Read from the reference |
|---|---|
| FAQ accordion | `transition-duration` / `transition-timing-function`. Prefer `<details>` + CSS; JS only if height is animated. |
| Pricing table | Feature labels sit in a column separate from the plan columns. Check the 360px screenshot for reflow before writing markup. |
| Testimonials | Carousel — autoplay interval, slides-per-view per breakpoint, loop. Duplicated slides in the reference DOM are clones, not content. |
| Stats counters | Count-up on scroll into view. See §B7 item 3 before copying the values. |
| Mobile nav | Open/close transition; whether it locks body scroll. |
| Blog category filter | Was client-side. With SSR, choose query param (`?category=guide`) or client filter over a preloaded list. |
| Newsletter form | Needs a new backend (§B5). Keep markup and validation states. |

## B4. Media

Originals live at `/wp-content/uploads/`. Files referenced in page HTML are usually **resized** variants — the original has no `-WxH` suffix.

```
Feature-Image-1024x525.jpg   ← what the page uses
Feature-Image.jpg            ← the original
```

A `-scaled` variant means WP downscaled an upload over 2560px; the unsuffixed file is still the true original.

- **Static page assets** — download originals into `src/assets/`, render with `astro:assets` (`<Image>` / `<Picture>`) for automatic AVIF/WebP and `srcset`.
- **Blog images** — served from WP at runtime. Proxy so URLs never change:

```toml
[[redirects]]
  from = "/wp-content/*"
  to = "https://cms.storefaq.io/wp-content/:splat"
  status = 200
  force = true
```

  Build `srcset` from `media_details.sizes` in the REST response.
- **Icons** — the docs category icons are Tabler icons saved as PNG. Use real SVGs from `@tabler/icons`: sharper, smaller, `currentColor`-aware.
- **Logo** — `headerLogo.png` is 357×120 and will be soft at 2×. Get an SVG from the design source; do not upscale.
- Use `download-wp-media.mjs` to pull everything and get a low-resolution report.

## B5. What breaks and must be rebuilt

| Feature | Current | Replacement |
|---|---|---|
| Newsletter form | Essential Blocks | Astro API route → Mailchimp/Brevo |
| `/go/*` links | Pretty Links plugin | Astro `redirects`. **Export `wp_prli_links` before decommissioning WP** — some may be used in the Shopify app UI or email campaigns and appear nowhere on the site. |
| Analytics | Site Kit | GA4 script + GSC verification via DNS TXT |
| Docs feedback widget | BetterDocs | Rebuild, or drop if unused — check the data first |
| Search | WP | Pagefind (docs), WP REST search (blog) |
| Sitemap | WP plugin | `@astrojs/sitemap` for static + SSR endpoint for blog |

## B6. Instant publishing

```astro
---
// src/pages/[slug].astro
export const prerender = false;
import { getPost } from '../lib/wp';
import { cleanWpHtml } from '../lib/wp-html';

const post = await getPost(Astro.params.slug!);
if (!post) return new Response(notFoundHtml, {
  status: 404, headers: { 'Content-Type': 'text/html' },
});

const body = cleanWpHtml(post.content.rendered);

Astro.response.headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
Astro.response.headers.set('Netlify-CDN-Cache-Control',
  'public, s-maxage=31536000, stale-while-revalidate=60, stale-if-error=86400');
Astro.response.headers.set('Netlify-Cache-Tag', `post-${post.id},blog`);
---
<article class="prose" set:html={body} />
```

Long edge TTL means visitors get static-speed responses and WP is never hit. On publish, WP purges the tag:

```php
add_action('transition_post_status', function ($new, $old, $post) {
  if ($new !== 'publish' && $old !== 'publish') return;
  wp_remote_post('https://api.netlify.com/api/v1/purge', [
    'headers' => [
      'Authorization' => 'Bearer ' . NETLIFY_TOKEN,
      'Content-Type'  => 'application/json',
    ],
    'body' => json_encode([
      'site_id'    => NETLIFY_SITE_ID,
      'cache_tags' => ['post-' . $post->ID, 'blog'],
    ]),
  ]);
}, 10, 3);
```

Vercel does the same with ISR + `bypassToken`. Cloudflare needs manual KV/Cache API work — more effort.

`stale-if-error` keeps the site up if WordPress goes down.

Pull SEO meta from the Yoast or Rank Math REST fields — **verify the field is exposed in Phase 0**, or every post loses its title and description.

**Lock WordPress down:** move to `cms.storefaq.io`, disable theme frontend rendering for non-admin requests, `Disallow: /` in its robots.txt, 2FA and IP restriction on `/wp-admin`.

## B7. Content bugs on the live site

Not UI changes. Decide explicitly per item — fix or carry — and record the decision in `NOTES.md`.

| # | Issue | Where |
|---|---|---|
| 1 | Placeholder copy about a "live search bar" reused in three unrelated sections (Design FAQ Page, Import & Export, Create Stunning FAQ Pages) | Home |
| 2 | "Add Instant Answer" and "Add FAQs With Drag-&-Drop" sections duplicated | Home |
| 3 | Stats show "0+ Number of Users" and "0.8% Satisfaction Rate" — likely 99.8% | Home |
| 4 | Hero "Install Now" and "View Demo" buttons have empty `href` | Home |
| 5 | "Frequently **Answered** Questions" — should be "Asked" | Home, Features |
| 6 | "using **an** StoreFAQ app" | FAQ block, multiple pages |
| 7 | No `<h1>`; page starts at `<h2>` | Home, Features |
| 8 | Images have empty `alt` attributes throughout | Site-wide |
| 9 | Testimonials heading sits after three cards in DOM order; three testimonials repeat | Home |
| 10 | Newsletter form rendered 2–3× per page (duplicate IDs) | Site-wide |
| 11 | Social links use raw URLs as link text | Footer |
| 12 | Only Enterprise shows a yearly price; "Not Applicable" floats without context on Free | Pricing |
| 13 | Copyright line duplicated | Footer |

Items 4, 7, 8, 10 and 11 are defects that hurt SEO or accessibility and **change nothing visually** — fix them regardless of the decision above.

---

# PART C — Execution

## Ground rules

1. **Never invent a CSS value.** Everything comes from `reference/`. If a value is not captured, capture it — do not estimate from a screenshot.
2. **This is not a redesign.** Something looks wrong → log in `NOTES.md`, keep building.
3. **Never paste WP markup into a component.** The capture is for reading values, not copying DOM.
4. **One section at a time.** Build, diff against the reference crop, fix, move on. Never build a whole page then compare — errors compound and become impossible to isolate.
5. **Screenshots are for judgement, diffs are for accuracy.** "Looks right" is not a pass.
6. **Stop and ask when:** a value cannot be derived from the capture; an unlisted third-party widget appears; a Decisions row is blank; a section will not reach diff threshold after three attempts.
7. **Never loosen `maxDiffPixelRatio`.** Ask instead.
8. **Secrets never enter the repo.** `.env` gitignored from commit one.
9. **Commit per section**, not per phase.

## Phase 0 — Recon

```bash
mkdir -p storefaq-astro && cd storefaq-astro && git init
node --version    # need 20+
```

Record each result in `NOTES.md`:

```bash
curl -s "https://storefaq.io/wp-json/wp/v2/posts?per_page=1&_fields=id,slug" | head -c 400
curl -sI "https://storefaq.io/wp-json/wp/v2/posts?per_page=100" | grep -i x-wp-total
curl -s "https://storefaq.io/wp-json/wp/v2/categories?_fields=slug,count"
curl -s "https://storefaq.io/wp-json/wp/v2/posts?per_page=1" | grep -o 'yoast_head_json\|rank_math' | head -1
curl -sI "https://storefaq.io/wp-json/wp/v2/media?per_page=100" | grep -i x-wp-total
curl -s https://storefaq.io/ | grep -oE '(elementor|essential-blocks|wp-block|eb-)[a-z-]*' | sort -u
```

The last command tells you which builders are actually in play. Confirm with the human: WP admin, SFTP to `/wp-content/uploads/`, DNS, GSC + GA4, and whether a logo SVG exists in Figma.

**Gate:** `NOTES.md` records real post count, real media count, whether SEO fields are exposed, whether `news` is empty, and which builder classes exist.

## Phase 1 — Reference capture

```bash
npm init -y && npm i -D playwright && npx playwright install chromium && mkdir -p scripts
```

`scripts/capture-reference.mjs`:

```js
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BASE = 'https://storefaq.io';
const OUT = 'reference';
const VIEWPORTS = [360, 480, 768, 1024, 1280, 1440, 1920];
const DEEP = 1440;

const ROUTES = [
  '/', '/features/', '/docs/', '/docs-category/getting-started/',
  '/docs/how-to-install-storefaq/', '/blog/', '/best-shopify-faq-apps/',
  '/changelog/', '/privacy-policy/',
];

const PROPS = [
  'font-family','font-size','font-weight','line-height','letter-spacing',
  'text-transform','text-align','color','background-color','background-image',
  'padding-top','padding-right','padding-bottom','padding-left',
  'margin-top','margin-right','margin-bottom','margin-left',
  'border-top-width','border-color','border-radius','box-shadow','opacity',
  'display','flex-direction','justify-content','align-items','gap',
  'grid-template-columns','width','max-width','height','position','z-index',
  'transition-duration','transition-timing-function',
];

const slug = (r) => (r === '/' ? 'home' : r.replace(/^\/|\/$/g, '').replace(/\//g, '__'));

const browser = await chromium.launch();
const ctx = await browser.newContext({ deviceScaleFactor: 2 });
const page = await ctx.newPage();

const css = new Map();
page.on('response', async (res) => {
  if (!(res.headers()['content-type'] || '').includes('text/css')) return;
  try { css.set(res.url(), await res.text()); } catch {}
});

const KILL_MOTION = `*,*::before,*::after{
  animation-duration:0s!important;animation-delay:0s!important;
  transition-duration:0s!important;transition-delay:0s!important;
  scroll-behavior:auto!important}`;

for (const route of ROUTES) {
  const name = slug(route);
  console.log(`\n${route}`);

  for (const width of VIEWPORTS) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 60000 });

    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) {
        window.scrollTo(0, y);
        await new Promise(r => setTimeout(r, 60));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(600);
    await page.addStyleTag({ content: KILL_MOTION });

    await mkdir(path.join(OUT, 'screens'), { recursive: true });
    await page.screenshot({
      path: path.join(OUT, 'screens', `${name}-${width}.png`),
      fullPage: true,
    });
    console.log(`  ${width}px`);

    if (width !== DEEP) continue;

    await mkdir(path.join(OUT, 'html'), { recursive: true });
    await writeFile(path.join(OUT, 'html', `${name}.html`), await page.content());

    const computed = await page.$$eval('[class]', (els, props) =>
      els.slice(0, 4000).map((el, i) => {
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {
          i, tag: el.tagName.toLowerCase(),
          cls: [...el.classList].join(' '),
          text: (el.textContent || '').trim().slice(0, 60),
          box: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
          styles: Object.fromEntries(props.map(p => [p, s.getPropertyValue(p)])),
        };
      }), PROPS);

    await mkdir(path.join(OUT, 'computed'), { recursive: true });
    await writeFile(path.join(OUT, 'computed', `${name}.json`), JSON.stringify(computed, null, 2));

    const fonts = await page.evaluate(() =>
      [...document.styleSheets]
        .flatMap(ss => { try { return [...ss.cssRules]; } catch { return []; } })
        .filter(r => r.constructor.name === 'CSSFontFaceRule')
        .map(r => r.cssText));
    await writeFile(path.join(OUT, `fonts-${name}.txt`), fonts.join('\n\n'));
  }
}

await mkdir(path.join(OUT, 'css'), { recursive: true });
let i = 0;
for (const [url, text] of css) {
  await writeFile(
    path.join(OUT, 'css', `${String(i++).padStart(2, '0')}-${url.split('/').pop().split('?')[0]}`),
    `/* ${url} */\n${text}`);
}
await writeFile(path.join(OUT, 'css', '_all.css'), [...css.values()].join('\n\n'));

await browser.close();
console.log(`\nDone. ${css.size} stylesheets, ${ROUTES.length} routes.`);
```

```bash
node scripts/capture-reference.mjs
```

**Gate:** 63 PNGs in `reference/screens/`; 9 JSON files in `reference/computed/`; `_all.css` non-empty; `fonts-home.txt` lists real `@font-face` rules. **The human reviews the screenshots** — if lazy images did not load, a cookie banner overlays, or a carousel is mid-transition, recapture now. Everything downstream builds on this baseline.

Commit `reference/`. It is the contract for the whole project.

## Phase 2 — Token extraction

`scripts/extract-tokens.mjs`:

```js
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
```

Then promote the real tokens into `src/styles/tokens.css` by hand.

**Gate:** `TOKENS.md`, `BREAKPOINTS.md` and `tokens.css` exist. `tokens.css` has under 40 custom properties, every one traceable to the capture.

## Phase 3 — Scaffold

```bash
npm create astro@latest . -- --template minimal --typescript strict --no-install --no-git
npm install
npx astro add netlify        # or vercel, per Decisions
npx astro add mdx sitemap
npm i -D @playwright/test lychee-bin
npm i node-html-parser
```

```
src/
  styles/tokens.css        imported once in BaseLayout
  layouts/BaseLayout.astro
  layouts/BlogPost.astro
  components/
  data/nav.ts              nav + footer link lists, built from routes
  lib/routes.ts            §B2 — single source of URLs
  lib/wp.ts                REST fetch
  lib/wp-html.ts           §B1 sanitiser
  content.config.ts
  pages/
public/fonts/              self-hosted, same files as original
scripts/
reference/                 committed
NOTES.md
.env.example
```

Download the font files from the URLs in `reference/fonts-home.txt` and reproduce the `@font-face` blocks with `font-display: swap`.

**Gate:** `npm run build` succeeds on an empty index. Fonts render and match the reference at 1440px.

## Phase 4 — Shared chrome

Build and verify in order: header → mobile nav → footer → newsletter block.

Crop the matching region from the reference screenshot, screenshot your build at the same viewport, diff, iterate.

Apply §B7 items 10 and 11 here — neither changes the rendered result.

**Gate:** header and footer match at all 7 viewports; mobile nav behaviour matches.

## Phase 5 — Pages

Order: **Home → Features → Docs → Changelog → Privacy.** Home first — it has the most components and everything else reuses them.

Home, section by section: hero → 11 alternating feature sections → pricing table → CTA band → stats counters → testimonials → FAQ accordion.

Behaviour details: §B3.

Docs additionally needs: search field, category cards with counts and dates, sidebar category list, breadcrumb, and the "What are your feelings" widget (confirm with the human whether it stays).

**Gate:** each page matches at all 7 viewports before the next one starts. `scripts/assert-clean.sh` passes.

## Phase 6 — Headless WordPress

Implement `src/lib/wp.ts`, `src/lib/wp-html.ts` (§B1), and the routes in §A3. Cache headers and purge hook: §B6. Editor block restriction: §B1.

Style `.prose` against the longest existing post.

**Gate:** publish a draft in WP → live on staging within 60 seconds. A nonexistent slug returns HTTP 404 with the styled page. `assert-clean.sh` passes against a rendered blog URL — not just `dist/`.

## Phase 7 — Media

```bash
node download-wp-media.mjs https://storefaq.io ./media
```

Follow §B4. Review `media/report.txt` and log anything under 1600px wide.

**Gate:** no image is served at lower resolution than on the original site.

## Phase 8 — Links and redirects

Redirect map:

| From | To | Status |
|---|---|---|
| `/go/get-started` | `https://apps.shopify.com/storefaq` | 302 |
| `/?p=:id` | canonical URL (SSR resolver) | 301 |
| `/index.php/*` | `/:splat` | 301 |
| `/blog/:slug/` | `/:slug/` | 301 |
| `/tag/*`, `/author/*` | `/blog/` | 301 |
| `/wp-json/*`, `/wp-admin/*`, `/xmlrpc.php` | — | 410 |
| `/wp-content/*` | `cms.storefaq.io/wp-content/:splat` | **200 rewrite** |

Export Pretty Links before anything is decommissioned:

```sql
SELECT slug, url FROM wp_prli_links;
```

URL diff:

```bash
curl -s "https://storefaq.io/wp-json/wp/v2/posts?per_page=100&_fields=link" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>JSON.parse(d).forEach(p=>console.log(p.link)))" \
  > old-urls.txt

grep -oP '(?<=<loc>)[^<]+' dist/sitemap-0.xml > new-urls.txt

while read u; do
  echo "$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' "$u") $u"
done < old-urls.txt | grep -v '^200' > redirect-check.txt

npx lychee --no-progress --max-concurrency 8 './dist/**/*.html'
```

Also run the §B2 link checks.

**Gate:** `redirect-check.txt` contains only single-hop 301s to live URLs. `lychee` exits 0. No `cms.storefaq.io` or WP paths in `dist/`.

## Phase 9 — Visual regression

Seed baselines from `reference/screens/`.

```ts
// tests/visual.spec.ts
for (const route of ROUTES) {
  for (const width of VIEWPORTS) {
    test(`${route} @ ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveScreenshot(`${slug(route)}-${width}.png`, {
        fullPage: true,
        animations: 'disabled',
        maxDiffPixelRatio: 0.01,
        mask: [page.locator('[data-live]')],
      });
    });
  }
}
```

Mark live or animated data `data-live` so it is masked — otherwise these fail for the wrong reason.

**Gate:** all 63 comparisons pass at `maxDiffPixelRatio: 0.01`. Do not loosen the threshold — ask instead.

## Phase 10 — Launch

**Before DNS switch**
- [ ] Phase 8 and 9 gates green in CI
- [ ] `assert-clean.sh` green on static build **and** on rendered SSR pages
- [ ] No literal internal URLs outside `routes.ts` (grep the components)
- [ ] Newsletter form tested end to end against the real provider
- [ ] `/feed/` returns valid RSS at the same path
- [ ] FAQPage JSON-LD on `/`, `/features/`, `/docs/`; Article schema on posts
- [ ] Blog SEO meta from WP SEO plugin fields, spot-checked on 3 posts
- [ ] WP on `cms.storefaq.io`, theme frontend disabled, `Disallow: /`, 2FA + IP restriction on `/wp-admin`
- [ ] `.env` set in hosting dashboard, nothing secret in git
- [ ] Lighthouse recorded as the new baseline

**After**
- [ ] Old sitemap path redirected; new sitemap submitted in GSC
- [ ] GSC ownership re-verified via DNS TXT
- [ ] GA4 firing
- [ ] 404 log checked daily for two weeks — any path getting hits is a missed redirect
- [ ] Weekly scheduled `lychee` against production (build-time checks miss SSR pages)
- [ ] Core Web Vitals compared against the pre-migration baseline

---

## NOTES.md template

Keep this running from Phase 0. It is the handover document.

```markdown
## Recon findings
## Decisions made and why
## Values that could not be derived from the reference
## Content bugs (§B7) — fixed or carried, per item
## Third-party widgets discovered
## Assets needing re-export from design source
## Known differences from the original, with justification
```
