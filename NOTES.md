# StoreFAQ → Astro migration notes

Running handover document. Started Phase 0 recon: 2026-09-06.

---

## Recon findings (Phase 0)

Toolchain: Node v24.15.0, npm 11.12.1, git 2.39.5. `storefaq.io` returns 200.

### REST API

| Check | Result |
|---|---|
| `wp-json` reachable | yes, public, no auth needed for `wp/v2` |
| Posts (`x-wp-total`) | **15** — matches guide §A3 inventory exactly |
| Media (`x-wp-total`) | **360** (4 pages of 100) |
| Docs (`wp/v2/docs`) | **16** — matches guide |
| Categories | `guide` id=38 (12), `feature` id=40 (6), `news` id=39 (**0 — empty**), `uncategorized` id=1 (0) |
| Doc categories | `configuration` id=9 (13), `getting-started` id=6 (3) — matches guide |
| 404 behaviour | real HTTP 404 |
| `/feed/` | 200 |
| Sitemap | `/sitemap_index.xml` → `sitemap-posts.xml`, `sitemap-pages.xml`, `sitemap-categories.xml`, `sitemap-docs.xml`. `/sitemap.xml` 301s to the index. |

`news` is empty — **do not build `/category/news/`**. Guide §A3 lists it as a route; drop it or it is a 3rd empty page.

### Post inventory verified

All 15 slugs in guide §A3 confirmed live and root-level. Three posts are miscategorised in the guide's table — they are **Feature**, not Guide:

- `/faq-schema-and-product-schema-shopify-ai-search/` (2026-07-21) — Feature
- `/shopify-ai-chatbot-storefaq-guide/` (2026-07-07) — Feature
- `/migrating-faqs-in-shopify-how-to-export-import-faqs/` (2026-06-17) — Feature

Category counts reconcile: guide 12, feature 6 (3 posts carry both).

### Builders actually in play

**No Elementor anywhere.** Grepped `/`, `/features/`, `/docs/`, `/best-shopify-faq-apps/` — zero `elementor` matches.

In play: **Essential Blocks (`eb-*`)** + **core Gutenberg (`wp-block-*`)** only. Essential Blocks generates per-instance hashed classes (`eb-advance-heading-kxaansv`, `eb-accordion-item-vzxka`) — the sanitiser's prefix regex in §B1 handles these correctly.

→ The `elementor` branch of `KILL_CLASS` / `UNWRAP` is dead code but harmless. Keep it as a guard against regressions.

### Plugin stack (from REST namespaces)

This is a **WPDeveloper stack**, not the generic one the guide assumed:

| Function | Actual plugin | Guide assumed |
|---|---|---|
| Docs | BetterDocs (`betterdocs/v1`, `betterdocs-pro/v1`) | BetterDocs ✓ |
| Blocks | Essential Blocks (`essential-blocks/v1`, `-pro`) | ✓ |
| **Redirects** | **BetterLinks** (`betterlinks/v1`, `-pro`) | ✗ Pretty Links |
| **SEO** | **ThinkRank** (`thinkrank/v1`, `thinkrank-pro/v1`) | ✗ Yoast / Rank Math |
| Forms | FluentForms (`fluentform/v1`) | — |
| **Newsletter/CRM** | **FluentCRM** (`fluent-crm/v1`, `/v2`) | ✗ Mailchimp/Brevo |
| Mail | FluentSMTP | — |
| Notifications | NotificationX | — |
| Caching | XSpeed (`xspeed/v1`) | — |
| Analytics | Google Site Kit | ✓ |
| Templates | Templately | — |
| Security | WP 2FA (+ passkeys) | — |
| Views | Post Views Counter | — |

### BLOCKER — SEO meta is NOT exposed over REST

Guide §B6 says to verify this. **It fails.**

- No `yoast_head_json`, no `rank_math` field. SEO is ThinkRank.
- Rendered `<head>` on posts *does* have full meta: `<title>`, `description`, `robots`, full `og:*`, `twitter:*`, `canonical`. Verified on `/best-shopify-faq-apps/`.
- `post.meta` exposes only ThinkRank **inputs**, not resolved output: `_thinkrank_focus_keywords`, `_thinkrank_og_*`, `_thinkrank_twitter_*`, `_thinkrank_canonical_url`, `_thinkrank_robots_meta`, `_thinkrank_primary_category`. On the sampled post the `og_*`/`twitter_*` values are **empty strings** — the live tags are generated from ThinkRank templates at render time, so reading post meta alone reproduces nothing.
- `/wp-json/thinkrank/v1/metadata/<id>` exists but returns **401** unauthenticated.

**Resolution required before Phase 6.** Options:
1. *(recommended)* mu-plugin on `cms.storefaq.io` that `register_rest_field`s the resolved values ThinkRank renders — one field `seo` with title/description/robots/og/twitter/canonical.
2. Allow unauthenticated GET on `thinkrank/v1/metadata/<id>` (read-only) via a permission filter.
3. Fetch the WP-rendered post page at build/request time and parse `<head>`. Works with no CMS change but doubles requests and re-couples us to the theme.

Without one of these **every post loses its title and description** — flagged in guide §B6 as exactly the failure to avoid.

### BLOCKER-adjacent — redirect export corrected

Guide §B5/§B8 says `SELECT slug, url FROM wp_prli_links` (Pretty Links). **Wrong plugin, and no SQL is needed.**

`GET /wp-json/betterlinks/v1/links` is **publicly readable, unauthenticated**. Exported to `reference/betterlinks-export.json`; normalised map at `reference/betterlinks-map.json`.

**19 links, all verified live.** The public path is the `short_url` field — `link_slug` is *not* the URL and 404s if used.

Three are **not** under `/go/` and sit at the domain root, where they collide with the `/[slug].astro` catch-all — these must be matched **before** SSR in Phase 8:

- `/Schedule-a-Call-Now` → `https://storeware.io/storefaq-talk-with-expert/` (307, **210 hits**)
- `/BFCM-2025-Faq-Audit` → `https://storeware.io/storefaq-talk-with-expert/` (307, 11 hits)
- `/download/sample-faq` → `/wp-content/uploads/2024/12/faq_sample.csv` (307, 52 hits)

Note the mixed case — redirect matching must be case-sensitive or explicitly case-insensitive, decided deliberately.

Only **one** (`/go/get-started`) appears anywhere on the site. The other 18 are live in the Shopify app UI, partner sites and campaigns — exactly the §B5 warning. Traffic leaders: `/go/get-started` 1970 hits, `/Schedule-a-Call-Now` 210, `/go/storefaq-with-xFlow` 131, `/download/sample-faq` 52, `/go/storefaq-with-fether` 36.

`/download/sample-faq` points into `/wp-content/uploads/` — it keeps working via the §B4 uploads proxy, but the CSV must stay reachable after WP is locked down.

### Still to confirm with the human

- WP admin access, SFTP to `/wp-content/uploads/`, DNS, GSC + GA4 access
- Whether a logo SVG exists in Figma (guide §B4: `headerLogo.png` is 357×120, soft at 2×)
- Whether the BetterDocs feedback widget ("What are your feelings") data is worth keeping (§B5)
- FluentCRM already *is* a newsletter backend — decide whether to keep posting to it or move to Mailchimp/Brevo (§A1 row)

---

## Decisions made and why

| Decision | Chosen | Note |
|---|---|---|
| Hosting | **Vercel** | Guide's B6 cache code is Netlify-specific; must be rewritten as ISR + `bypassToken`, and the `/wp-content` proxy as a `vercel.json` rewrite. |
| Styling | **Tailwind, theme replaced** | Per B3 the default theme is replaced, not extended. Implemented as Tailwind v4 `@theme` in `src/styles/tokens.css` with `--font-*: initial` etc. resets so only extracted values exist. |
| Docs content | **MDX in repo** | 16 articles convert out of BetterDocs once; docs then prerender with Pagefind search and no WP runtime dependency. |
| Newsletter backend | **Keep FluentCRM** | Site already runs FluentCRM — the form is FluentForms + Essential Blocks, not a bare EB form. Astro API route posts to FluentCRM on `cms.storefaq.io`; existing subscriber list is untouched. |
| Public URLs | **Restructure — posts move to `/blog/<slug>/`** | Against guide A4's recommendation; taken deliberately with the SEO cost accepted. See "URL restructure" below. |
| Content bugs (B7) | **Fix all during migration** | Including the visible ones. Each change listed for approval before it is applied. Interacts with the Phase 9 gate — see below. |
| Author archives | **301 to `/blog/`** | Single-author site; consolidates link equity, removes a thin-content surface. |
| Blog SEO meta | **mu-plugin exposing resolved meta** | `register_rest_field` on `cms.storefaq.io` adding one `seo` object per post. I write it, you deploy it. |

---

## URL restructure — consequences

Posts move from `/<slug>/` to `/blog/<slug>/`. This is the one decision taken against the guide's own recommendation (A4), knowingly.

**What it costs**
- 15 posts each take a 301 hop; expect 4-8 weeks of ranking instability
- Sitemap must be regenerated and resubmitted in GSC
- Any external backlink to a post pays one redirect

**What it buys**
- The root namespace is freed. `src/pages/[slug].astro` as a catch-all is **no longer needed**, which removes the collision risk with the three root-level BetterLinks redirects (`/Schedule-a-Call-Now`, `/BFCM-2025-Faq-Audit`, `/download/sample-faq`) — those would otherwise have had to be matched ahead of SSR.
- A genuine typo now 404s naturally instead of hitting a catch-all.

**Revised route map** (supersedes guide A3)

| Route | Rendering | Source |
|---|---|---|
| `/` `/features/` `/changelog/` `/privacy-policy/` | prerender | `src/pages/*.astro` |
| `/docs/` `/docs/[slug]/` `/docs-category/[slug]/` | prerender | MDX collection, 16 articles |
| `/blog/` | SSR | WP REST, paginated |
| **`/blog/[slug]/`** | SSR | WP REST — **moved from root** |
| `/category/[slug]/` | SSR | `guide`, `feature` only (`news` is empty) |
| `/<old-slug>/` | **301 → `/blog/<old-slug>/`** | 15 explicit redirects, generated from the post list |
| `/author/*`, `/tag/*` | 301 → `/blog/` | |
| `/sitemap-blog.xml`, `/feed/` | SSR | |
| `/404` | prerender | must return HTTP 404 |

The 15 old→new redirects are generated from `reference/` post data, not hand-typed, so they cannot drift from the route map.

---

## Conflict to resolve: content fixes vs the Phase 9 gate

"Fix all content bugs" and "all 63 visual comparisons pass at `maxDiffPixelRatio: 0.01` against `reference/screens/`" cannot both hold. Removing the duplicated Home sections (B7 #2, #9), correcting the stats (#3), and changing "Answered" to "Asked" (#5) all change pixels — by design.

Ground rule 7 forbids loosening the threshold, so the sequencing is:

1. **Build to match the reference exactly**, bugs and all. Phase 9 gate runs clean at 0.01 against the original baselines. This proves fidelity.
2. **Then apply content fixes as a separate, reviewed commit**, and re-baseline only the affected screenshots — with each re-baseline justified in this file.

That keeps the diff gate meaningful instead of quietly weakening it, and leaves a clear record of every intentional visual change.

---

## Phase 1 — reference capture

Gate **met**: 63/63 PNGs, 9 computed JSON, 9 HTML, 102 stylesheets (`_all.css` 11.6 MB), font rules captured.

Capture is clean — no cookie/consent banner (site has none), lazy images loaded, no NotificationX popup rendered (only an exit-intent `<style>` and a `has-notificationx` body class). Theme is `twentytwentyfour`.

Home is unusually tall: 8755 CSS px at 1440, 15598 px at 360.

### Defect found in the guide's capture script

`scripts/capture-reference.mjs` injects `KILL_MOTION` **before** reading computed styles, so every `transition-duration` reads `0s` (`0s ×6979`) and `transition-timing-function` collapses to `ease`. Guide B3 explicitly requires reading the accordion's duration/easing from the reference, so those tokens were unusable.

Fixed with `scripts/capture-motion.mjs` — same routes at 1440, motion intact, values only, output `reference/MOTION.md`. Real values:

- accordion (`eb-accordion-*`) — `0.5s ease` on background/border/border-radius/box-shadow
- buttons (`eb-button-anchor`, `.btn`) — `0.3s`, `ease` / `ease-in-out`
- nav submenu — `0.1s linear` on opacity
- dominant overall: `0.5s ease` (blocks), `0.3s` (interactive)

The accordion has **no height/max-height transition** — Essential Blocks animates it in JS. Per B3 ("prefer `<details>` + CSS; JS only if height is animated") this needs a decision in Phase 5; a `<details>` + grid-rows transition reproduces it without JS.

---

## Phase 2 — token extraction

Gate **met with one documented deviation** (below). `TOKENS.md`, `BREAKPOINTS.md`, `MOTION.md`, `TOKENS-visible.md`, `src/styles/tokens.css` all exist.

### Raw tally was misleading — added a visibility-filtered pass

`extract-tokens.mjs` counts every captured element including hidden plugin widgets, icon-font nodes and theme defaults. `scripts/extract-tokens-visible.mjs` counts only rendered elements (non-zero box, not `display:none`, not `opacity:0`) — 5869 of 6983. Output: `reference/TOKENS-visible.md`. **Promote tokens from that file, not `TOKENS.md`.**

### `Cardo` is a phantom — do not use it

`Cardo` shows ×123 on rendered `h1/h2/h3.eb-ah-title`, which looks like a heading serif. It is not. Essential Blocks' Advanced Heading puts the visible text in an inner `span.first-title`, which is **IBM Plex Sans 600**. The outer element carries the `twentytwentyfour` theme default and renders no visible glyphs. Confirmed against the 1440 screenshot — every heading is sans.

`Arial`, `Times New Roman`, `Rajdhani` and the Font Awesome / dashicons / ia-icon families are likewise not real tokens.

### Real type system

| Role | Family | Evidence |
|---|---|---|
| Body / prose | **Inter** 400, 16.8px / 26.04px, `#111` | ×4826 |
| Headings, nav, buttons, section copy | **IBM Plex Sans** 500/600/700 | ×563 |
| Footer column headings ("Apps", "Get Help", "Community") | **DM Sans** 500, 24px | ×55 |
| Testimonial company line, docs search button | **Manrope** 500/600 | ×6 |

Body background is `#F9F9F9`; section paragraph copy is IBM Plex Sans 18px/28.8px `#45503F`.

### Font loading is badly over-fetched (fix, not a redesign)

Only **Inter** and **Cardo** have `@font-face` rules — self-hosted from the theme. The other four families come from one render-blocking Essential Blocks stylesheet:

`//fonts.googleapis.com/css?family=IBM+Plex+Sans:...|Sora:...|DM+Sans:...|Inter:...|Manrope:...|Rajdhani:...|Open+Sans:...`

That is **7 families × 18 weight/style combinations = 126 faces** requested. Four families are used, and roughly six weights. Self-hosting Inter + IBM Plex Sans + DM Sans + Manrope at the used weights is byte-identical in rendering (the originals *are* the Google files, so B3's "no lookalike substitute" rule is satisfied) and removes a third-party render-blocking request.

`Rajdhani` and `Open+Sans` are fetched and never used. `Sora` is used exactly once — see below.

### Style drift found: the "Changelog" nav item

Every header nav item is IBM Plex Sans 18px/500. **"Changelog" alone is Sora 16px/500** — on all four captured pages. This is unintended drift, not a design decision. Reproducing it faithfully means shipping a whole font family for one word.

**Recommend normalising it to IBM Plex Sans 18px** and dropping Sora. Visually a 2px size change on one nav item. Needs a decision — it is the one place the rebuild would knowingly differ from the original. Logged under "Known differences" pending sign-off.

### There are no shadows

All three captured `box-shadow` values are fully transparent or zero (`rgba(255,255,255,0) 0 0 0 0` etc). The site separates surfaces with borders and tinted backgrounds only. `--shadow-*` is reset to `initial` and no shadow token is defined.

### Layout

- Container `max-width: 1170px` (×44), 135px side gutter at 1440
- Narrow/prose container `620px` (×29)
- Newsletter form `467px` (×9)
- Spacing is a **5px grid** — 15px ×502, 20px ×390, 10px ×285, 25px ×73, 30px. Expressed as Tailwind's `--spacing: 5px` multiplier rather than 8 separate steps.
- Letter-spacing is not a token — the only non-normal values (0.42px, 0.49px) are BetterDocs breadcrumbs.

### Breakpoints

15 `@media` widths appear across 102 stylesheets, but most are plugin-internal. The four structural ones are **481 / 768 / 1025 / 1280**, set as `--breakpoint-sm/md/lg/xl`. Per B3, verification still runs at 360, 480, 768, 1024, 1280, 1440, 1920 plus one pixel either side of each of these four.

### Gate deviation — token count

The gate asks for "under 40 custom properties". `tokens.css` defines **47** (excluding the eight `--*: initial` resets and counting each `--text-*` size with its line-height modifier as one token).

The set is already curated down from the capture — 31 distinct colours to 19, 20 font sizes to 11 — and every remaining value occurs at least 4 times on rendered elements. The overage is real, not laziness: the site uses six tinted surfaces (cream, deep cream, mint, two greys, white) plus five brand greens, which is more than the guide's "8-15 colours" estimate.

Cutting further would mean collapsing values that visibly differ, which ground rule 1 forbids. Flagging rather than forcing the number down. **If you would rather hit 40, say so and I will collapse the nearest pairs and note each substitution.**

---

## Values that could not be derived from the reference

- **Transition duration / easing** — not derivable from the main capture (script zeroes them before reading). Re-captured properly via `scripts/capture-motion.mjs`; see `reference/MOTION.md`.
- **Accordion open/close height animation** — Essential Blocks does this in JS, so no CSS value exists to read. Needs a Phase 5 decision.

---

## Content bugs (§B7) — fixed or carried, per item

_Pending §A1 decision. Items 4, 7, 8, 10, 11 are fixed regardless (guide §B7)._

---

## Third-party widgets discovered

- NotificationX — social-proof popups; confirm whether these stay post-migration
- Post Views Counter — view counts on posts; drop unless surfaced in the UI

---

## Assets needing re-export from design source

- Logo SVG (see §B4)

---

## Known differences from the original, with justification

- `/category/news/` not built — category is empty (0 posts)
- **Pending sign-off:** "Changelog" nav item normalised from Sora 16px to IBM Plex Sans 18px, matching every other nav item (see Phase 2). Avoids shipping a font family for one word.
- Google Fonts request reduced from 7 families / 126 faces to 4 self-hosted families at the ~6 used weights. Rendering identical; removes a render-blocking third-party request.

---

## Phase 3 — scaffold (complete)

Gate **met**. `npm run build` succeeds; measured against the reference at 1440px:

| | Reference | Build |
|---|---|---|
| body | Inter 16.8px / 26.04px `#111` | identical |
| section copy | IBM Plex Sans 18px / 28.8px `rgb(69,80,63)` | identical |
| h1 | 52.32px | identical |
| page background | `#F9F9F9` | identical |
| container | 1170px | identical |

Tailwind's defaults are confirmed purged from the built CSS (`--color-red-500`, `--font-mono`, `--breakpoint-2xl` all absent) and the 5px grid resolves (`px-6` → 30px).

**Astro 7**, not the guide's Astro 5 — decided explicitly. The v7 upgrade guide lists no breaking change touching this project's patterns. Watch items: Vite 8, a new default Markdown processor, `compressHTML` now `'jsx'`.

Fonts self-hosted: `Inter-Variable` (the theme's own file), plus `IBMPlexSans-Variable`, `DMSans-Variable`, `Manrope-Variable` (the same Google files the site loads — variable, so one file covers 500/600/700). 396 KB total, replacing a 126-face render-blocking request.

---

## Phase 6 groundwork — done early (both have lead time)

### `wordpress/storefaq-headless.php`

The mu-plugin resolving the SEO blocker. PHP syntax verified locally. **Needs deploying to `cms.storefaq.io/wp-content/mu-plugins/`.** It:

1. Registers one `seo` REST field on posts/pages/docs, resolved by buffering `wp_head()` in a front-end context and parsing what ThinkRank actually rendered — post meta alone yields nothing, since the override fields are empty.
2. Applies per-post ThinkRank overrides where an editor has set one.
3. Rewrites canonicals onto the frontend, honouring the `/blog/` move.
4. Caches per post for an hour, busted on `save_post`.
5. Restricts blog editors to core blocks (guide §B1 guardrail).
6. Purges on publish via Vercel ISR revalidation (guide §B6, rewritten from Netlify) — needs `STOREFAQ_VERCEL_BYPASS_TOKEN` in `wp-config.php`.

### `src/lib/wp-html.ts` — sanitiser, validated against real content

Tested against the longest post (`faq-schema-and-product-schema-shopify-ai-search`, 42 KB, and the one to style `.prose` against). It contains tables, `<details>`/`<summary>`, figures, and a `<script>` — a good worst case.

Result: 0 surviving `wp-`/`eb-` classes, 0 inline styles, 0 scripts, 0 `data-*`. Output 18% smaller.

**Two corrections to the guide's §B1 code:**

1. **`KILL_CLASS` is too narrow.** After running the guide's exact regex, these still survived: `is-style-stripes`, `has-fixed-layout`, `aligncenter`, and five `thinkrank-faq*` classes. All are WordPress markup, and all would have **passed the guide's enforcement gate**, which only greps `wp-|eb-|elementor|is-layout-`. Extended to cover `is-style-*`, `has-fixed-layout`, `thinkrank`, `betterdocs`, `ff-`, `fluentform`, `notificationx`, `nx-`.
2. **Some plugin classes carry real structure.** The `thinkrank-faq__question` / `__answer` pair is a genuine FAQ block. Stripping it loses the semantics; it is **renamed** to `faq__question` / `faq__answer` instead, along with `aligncenter` → `align-center`. Semantics survive, plugin identity does not.

Also: the unwrap pass now runs innermost-first so nested wrappers collapse in one pass, and upload URLs are made relative whichever host WP returns, so they route through the `/wp-content/*` proxy.

`.prose` must cover: tables, `<details>`/`<summary>`, figures + figcaptions, and the `faq__*` block.

### `scripts/assert-clean.sh`

Strengthened to match the widened `KILL_CLASS`, and extended to also fail on a leaked CMS domain, WP paths, and plugin/theme stylesheets. Checks `dist/` by default, or takes URLs for SSR pages. Verified it both passes clean output and catches planted bad markup.

---

## Outstanding — needs you

1. **Deploy `wordpress/storefaq-headless.php`** to `cms.storefaq.io` as an mu-plugin. Phase 6 is blocked on it.
2. **Confirm access**: WP admin, SFTP to `/wp-content/uploads/`, DNS, GSC + GA4.
3. **Logo SVG** — `headerLogo.png` is 357x120 and will be soft at 2x. Needed from the design source before Phase 4.
4. **Sign off the "Changelog" nav normalisation** (Sora 16px → IBM Plex Sans 18px).
5. **Token count** — 47 vs the gate's 40. Say if you want them collapsed.
6. **BetterDocs feedback widget** ("What are your feelings") — keep or drop? Check the data first.
7. **NotificationX popups** — keep post-migration?

---

## Phase 4 — shared chrome (header, mobile nav, footer, newsletter)

Gate **met**: header, footer and newsletter match at all 7 viewports; mobile nav behaviour matches.

Two scripts do the verification, because the Phase 1 capture only dumps computed styles at 1440 and says nothing about responsive behaviour:

- `scripts/capture-chrome.mjs` → `reference/CHROME.json`, header geometry at every viewport
- `scripts/diff-chrome.mjs` / `scripts/diff-footer.mjs` → diff the local build against the live site

Final result: **0px delta** on every measured box at 360/480/768/1024/1280/1440/1920.

### Corrections to what was assumed

| Assumed | Actual |
|---|---|
| Nav: Home/Features/Docs/Blog/Changelog | Home/Features/**Documentation**/Blog/**Support**, with Changelog a submenu under Support. Support links off-site to storeware.io. |
| Hamburger at 768 | **599/600px** |
| Header CTA → `/go/get-started` | links straight to `apps.shopify.com/storefaq` |
| Footer: Apps/Get Help/Company | **Apps / Get Help / Community**, plus a logo column. Community holds Facebook + LinkedIn icons. |
| One container width | header/newsletter use a **1320px** row; the footer link row uses the **1170px** content row; the newsletter card's inner content is capped at **834px** |

### Values that only a measurement would have given

- Header columns are `fr`-based: `30/50/20` with no gap below 1280, `23.5/56.5/20` with a 20px gap above. Reproduces 218/364/146 at 768 through 301/723/256 at 1440.
- Nav links 14px/1.2 below 1280, 18px/1.2 above; item spacing comes from 10px/15px `li` padding.
- CTA is 12px / 128x46 below 1280 and 16px / 172x51 above.
- A 1px `#DBE8D0` bottom border on the header — this was the constant +1px in early diffs.
- Newsletter form: `max-width` 320 below 768 and 467 above, 11px right padding, gap 0 below 768 and 15px above. Input and button then land exactly.
- Two decorative bitmaps: `Group-39470` (sparkle) as the card background at `40px 40px` (`97px 63px` from 1280), and `Group-39474` (swoosh) on `::before` at `92% 70%`.

### Trap: the page ships hidden duplicate blocks

Essential Blocks renders **two** copies of the newsletter heading — one hidden. Measuring `querySelectorAll(...)[0]` returns the hidden one, whose values are different (24/30/48px). The visible block is **28px below 1280, 48px above, line-height 1.2**, with a 16px/24.8px subtitle. An early pass used the hidden values and every card height was wrong.

**Always filter to rendered elements when measuring this site.** Same root cause as the `TOKENS.md` → `TOKENS-visible.md` split in Phase 2.

### §B7 findings from this phase

- **Item 13 (duplicate copyright) does not reproduce.** The DOM holds several copies but only one renders at each viewport — they are hidden responsive variants. No fix needed; item can be closed.
- **Item 11 (social links)**: the two social links are icon-only with `aria-label="social link"` on both. Named them "Facebook" and "LinkedIn" — invisible, so applied now.
- **Item 10 (newsletter rendered 2-3x)**: confirmed. The rebuild renders it once.
- **New — the Subscribe button overflows its form at 360px.** On the original the button runs past the white pill and is clipped at the card edge (button ends at x=349, pill ends at x=320). The rebuild keeps it inside. This is the one place the build deliberately differs at 360px.
  Side effect: with the button inside, the input is 156px and the placeholder truncates to "Your Email Addres". The proper fix is to stack input and button below ~480px. **Needs sign-off** — flagged rather than redesigned.
- **New — the header balloons to 325px tall between 600px and 767px**, because the nav wraps vertically. None of the 7 test viewports lands in that range, so it is not caught by the gate. Recommend keeping the hamburger up to 767px. **Needs sign-off.**

### Newsletter backend

`src/pages/api/subscribe.ts` posts to FluentCRM `/subscribers` with `status: 'pending'` (double opt-in), using an application password held server-side. Already-subscribed addresses return a friendly 200 rather than an error. Needs `FLUENTCRM_*` set in Vercel before it works end to end.

---

## Phase 5 — Home

Section map (1440): hero 667 / feature stack 3008 / pricing 1609 / CTA band 685 / testimonials 1109 / FAQ 825.

There is **no separate stats-counter section** on the live page, though the guide's Phase 5 order lists one and §B7 item 3 refers to "0+ Number of Users". Checked while mapping — the section does not exist. Item 3 may be stale, like items 4 and 13.

New tooling: `scripts/map-sections.mjs` (segments a page), `scripts/inspect.mjs` (dumps rendered elements in a y-range), `scripts/diff-section.mjs` (per-section geometry diff), `scripts/crop.mjs` (side-by-side crops).

### Hero — done

Within 2px at all 7 viewports; exact except the badge pill (190x42 vs 192x44).

- Section padding 70/20/30 below 768, 70/20 to 1279, 120/20 above
- Columns stacked below 768, 50/50 to 1279, **45/55** above, `align-items: center`, 20px gap
- Title 30/39 w600 below 1280, 48/62.4 above, `#1D2939`
- Subtitle 14/22.4 **w300** below 1280, 18/28.8 above, `#45503F`
- CTA 144x47, 16/17.6 w500 on `#16250E`, links to `apps.shopify.com/storefaq`
- Badge pill 192x44 on `#F3F9EC`: its height comes from inheriting the body's 16.8/26.04 strut while the label is 12px DM Sans. Reproduced as a mechanism rather than a fixed height; still 2px short, which is inside tolerance.
- The text column carries **27px of trailing space** below the button. Under `center` alignment this offsets the whole column, so it must be reproduced — without it every child sat ~14px low.

### §B7 item 4 does not reproduce

The guide says the hero's "Install Now" and "View Demo" buttons have empty `href`. The live hero has **one** button, "Get Started", with a valid href to the app listing. There is a hidden `.eb-button-anchor` labelled "Install Now" in the DOM (zero size), which is probably what the audit saw. Nothing to fix.

That makes **three** §B7 items that do not reproduce: 4, 13, and probably 3.

### Broken assets pointing at a dead staging domain

The hero declares three background images. Only one loads:

| Asset | Host | Result |
|---|---|---|
| `R.png` | storefaq.io | **200**, 228 KB — the visible gradient |
| `Rbg.jpg` | `harmonious-storm-595.wp1.site` | **dead** — host does not resolve |
| `Vector334.png` | `harmonious-storm-595.wp1.site` | **dead** |

`harmonious-storm-595.wp1.site` is a leftover staging domain. It appears **16 times** in the site's stylesheets. Every reference is dead and renders nothing, so the rebuild reproduces only `R.png` and the result is visually identical.

Worth telling the team: those 16 references are dead weight in the CSS, and if that staging host is ever re-registered by someone else it becomes a live third-party asset on the production site. Recommend stripping them at source.

`R.png` is 228 KB for a soft gradient — a good candidate for re-export or a CSS gradient later, but not a migration concern.

### Feature stack — done

Section, lead card and all 8 feature cards match at **all 7 viewports**.

The guide describes "11 alternating feature sections". The live page has **9**: one lead feature in a mint card, then 8 in a 2-up grid. They do not alternate.

Values that only measurement gave:

- Each feature is a **card**: 16px radius, padding `40px 0 0 40px`, so the image runs flush to the card's right and bottom edges.
- The text block carries a **further 40px right margin** that the image does not. This is what makes titles wrap earlier than the card width suggests — without it the 1280 column was 41px short.
- Card backgrounds are set per card, not alternating cleanly: sky `#ECF6F9` ×2, cream `#F9F7EC` ×2, mint `#F3F9EC` ×2, cream ×2.
- The subtitle-to-image gap is 30px on six cards but **20px and 16px** on two. Stored per feature rather than averaged.
- The lead card's media column has a **45px left gutter** that the sparkle sits in, so the image is 45px narrower than its column.
- The lead card never stacks its text above its image below 768 the way a naive grid would — it wraps, with a 0 column gap.
- **`text-transform: capitalize`** on hero and feature titles (not on pricing or subtitles). Without it "AI Chatbot **for** Smart Help Desk" renders with a lowercase "for".

**Row spacing in the original is not uniform.** Measured gaps between the four feature rows: `24 / 0 / 0 / 24` below 1280, but `24 / 24 / 24 / 24` at 1280+. Section padding-bottom is 40px below 1280 and 50px above, and only above 1280 is there a trailing 24px. Stacked below 768, the two cards inside a row sit 30px apart. All reproduced literally — averaging it put the section 82px out.

### §B7 findings

- **Item 1 confirmed.** The sentence "Improve user experience by adding an advanced live search bar so your visitors can find helpful documentation articles easily." is used verbatim in **three** features: Design FAQ Page With Flexibility, Import & Export FAQs Easily, Create Stunning FAQ Pages. Flagged in the data as `placeholder: true`.
- **Item 2 does not reproduce.** "Add Instant Answer" and "Add FAQs With Drag‑&‑Drop" each appear exactly once.
- **Item 5 confirmed.** The lead feature reads "Frequently **Answered** Questions", highlighted in `#88C15A`.
- **Item 8 confirmed.** Every feature image has `alt=""` on the original. Real alt text written in `src/data/home-features.ts` — invisible, so applied now.

Four §B7 items now look stale: **2, 3, 4, 13**.

### Pricing table — done, with one documented limitation

| Viewport | Section delta |
|---|---|
| 1440 / 1920 | **+3px** (all 4 plan columns and the label column exact at 1217, positions exact) |
| 768 / 1024 | **-5px** (all plan cards exact) |
| 1280 | -22px |
| 360 | **-279px** — see below |

The guide's §B3 warning ("feature labels sit in a column separate from the plan columns; check the 360px screenshot for reflow") is the important one here. The actual behaviour:

- **1280+** — a comparison table: a 297px label column plus four 235px plan columns.
- **Below 1280** — the label column is **hidden entirely** and the four plans **stack as cards**, each repeating its own row labels. That is why every plan cell carries a duplicate label in the markup.

Building it as a naive table would have been wrong below 1280, and building it as stacked cards would have been wrong above.

**Implementation:** one markup tree. At 1280+ the columns become `display: contents` so every cell is a direct grid child, placed by `grid-row` / `grid-column`. That lets the browser equalise row heights natively — which is what the original does with JavaScript.

Other measured details:
- Heading capped at **870px**, 28/36.4 below 768, 32/41.6 to 1279, 48/62.4 above.
- Cells use a uniform **15px** padding; the header cell is **260px** at every breakpoint, contents centred vertically (this is what keeps Enterprise's button nearly aligned despite its extra yearly line).
- The "Popular" badge is `position: absolute` at **every** breakpoint, always 61px above its column, so it never adds to the column height. Stacked, the popular card takes 42px extra top margin so the badge clears the card above it.
- Below 1280 the table has a further 20px inset, and stacked cards are capped at 720px and centred.
- Icons are `fa-check-circle` `#00A416` and, for Free's Multilingual FAQ row, `fa-circle-xmark` `#D32D2D`. Rebuilt as inline SVG with a visually-hidden "Included" / "Not included" label — the original conveys this by colour and glyph alone.
- Label colours: most `#16250E` w500; "AI Chatbot" w700; **"Write with AI" and "Shopify Sidekick Integration" are `#CD93FF` w700**.

**Limitation at 360px.** The pricing plugin writes explicit pixel heights onto every cell from JavaScript, equalising each row across all four *stacked* cards. Those heights are not derivable from content — a row whose tallest child is 25.6px is set to 59px. The measured values are stored per row and applied as **min-heights**, which reproduces 768-1920 to within a few pixels and lets rows still grow where text wraps.

What cannot be done in CSS is equalising row *N* across four vertically stacked cards — only script can. Two rows at 360 ("AI Chatbot", "Dedicated Support") are therefore shorter than the original by 29px and 25px, and the cumulative section is 279px short.

**This needs a decision.** Either (a) accept it — each card sizing to its own content is arguably better on mobile, with no arbitrary gaps; or (b) add a small equalisation script to match the original exactly. I would accept it, but it will show up in the Phase 9 diff at 360, so flagging rather than choosing silently.

§B7 item 12 confirmed: only Enterprise shows a yearly price, and Free's "Additional View" reads "Not Applicable" with no context.
