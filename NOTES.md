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
- **Feature card gaps normalised on mobile.** The original's card gaps are `30/0/30/0/30/24/30` below 768 and `13/22/24` between rows at 768-1279, so several pairs of cards touch with no gap at all while others have 30px. Reproduced literally at first, then normalised as a content fix: **30px** between cards in the single column, **24px** between rows once there are two columns (matching the 1280+ value). Adds 65px at 360, 64px at 480, 48px at 768/1024; 1280 and above are unchanged.
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

**Exact at all 7 viewports** (corrected — see "Hero: two errors the section diff reported and I did not read", below).

- Section padding 70/20/30 below 768, 70/20 to 1279, 120/20 above
- Columns stacked below 768, 50/50 to 1279, **45/55** above, `align-items: center`, 20px gap
- Title 30/39 w600 below 1280, 48/62.4 above, `#1D2939`
- Subtitle 14/22.4 **w300** below 1280, 18/28.8 above, `#45503F`
- CTA 144x47, 16/17.6 w500 on `#16250E`, links to `apps.shopify.com/storefaq`
- Badge pill 192x44 on `#F3F9EC` with a **1px `#DBE8D0` outline**. Its height comes from inheriting the body's 16.8/26.04 strut while the label is 12px DM Sans — reproduced as a mechanism rather than a fixed height — and the border is the remaining 2px in each direction.
- The text column carries trailing space below the button: **30px while stacked**, where it doubles as the gap to the image (the original's row gap is 0 there), and **28px from 768 up**, where `align-items: center` makes it offset the whole column. Without it every child sat ~14px low.

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

### Correction pass after review

A screenshot of the live section showed detail the geometry-only extraction had missed. The first pass measured boxes and type but not paint, and read `border-top/left/right` while the rules live on `border-bottom`. Added:

- **Row and column rules**, `#E3E3E3`. Painted as **inset box-shadows, not borders** — as real borders each row grew 1px and the column ran 10px long.
- **The popular column is a gradient**, `linear-gradient(#FFFEEC 28%, #FFFFFF 100%)` over `#F9FCFF`, with its own rule colour `#EFE0A1` on both sides.
- **Table shell**: `1px solid #E3E3E3`, radius `12px 0 0 12px`.
- **Growth CTA shadow**: `rgba(0,0,0,.4) 0 8px 12px 1px`.
- **A star glyph** before "Popular".
- **Sparkle and info glyphs** on the AI labels and the Additional View row. These are **background images with matching padding**, exactly as on the original — as inline `<img>` they wrapped onto a second line.
- **"AI Chatbot" is gradient-filled text** (`background-clip: text`, `#CD93FF → #A741FF`), not a flat colour. "Write with AI" and "Shopify Sidekick Integration" are flat `#CD93FF`.
- Check glyphs are Font Awesome's **regular (outlined)** circle, not the solid one.

Result after the correction: plan columns **exact** at 768/1024, +2px at 1280, +4px at 1440/1920. The 360 shortfall improved from -279px to -147px, since rows now grow naturally the way the original's do.

**Lesson for the remaining sections:** measure paint (backgrounds, borders on all four sides, gradients, pseudo-element and background-image glyphs) alongside geometry. A section can match to the pixel on boxes and still look wrong.

### Second correction pass — the plan header band

A second review pointed at the band between the heading and the first feature row. Two more things were wrong:

1. **The header content is left-aligned, not centred.** Plan name, price, yearly note and button all sit at the column's left padding edge, and the button is **full width** of the content box (209 of a 249px column). I had centred all of it.
2. **The table's border starts at the header row, not the badge row.** The "Popular" badge sits *outside* the bordered shell. My border wrapped the badge band too, drawing an empty bordered strip across the full table width above the header. Fixed with a `.pricing__frame` grid item spanning rows 2..19 that draws the border and radius, leaving row 1 (the badge band) outside it.
   `grid-row: 2 / -1` does **not** work here — `-1` resolves against the *explicit* grid, and these rows are implicit, so it spanned from row 1. The end line has to be named explicitly.

Measured header offsets within the 260px cell, now reproduced exactly for the three plans without a yearly line (name +30, price +60, button +179) and within 6px for Enterprise, whose block is centred lower to make room for its extra line.

Two metric bugs found while fixing this:
- The price box is **37px** tall — line-height **1.32**, not the 1.2 I had assumed from the font size.
- The header cell was inheriting `gap: 16px` from `.pricing__cell`, which silently added 16px under the plan name and pushed the cell to 292px. Flex `gap` on a shared cell class is easy to inherit by accident.

Section deltas after this pass: **-1px** at 768, 1024, 1440 and 1920; -3px at 1280; -151px at 360 (the JS row-equalisation limitation above).

**Third pass — the table's top border.** The frame drew the border but sat *below* the cells, so the plan columns' backgrounds covered its top edge and the rule was only visible across the empty label column. The frame now carries the border alone (no background — the section is already white) and paints **above** the cells.

One further detail: on the original the "Popular" badge and the Growth column meet as a single continuous tint with **no rule between them**, while the border is visible across every other column. Reproduced by raising that one header cell above the frame.

§B7 item 12 confirmed: only Enterprise shows a yearly price, and Free's "Additional View" reads "Not Applicable" with no context.

### Button audit (all buttons, 1600px)

Compared every button against the live site. Two bugs found and fixed:

1. **Pricing outline buttons had the wrong border colour** — I had used the light rule colour `#EAECF0`; the original uses **`#16250E`**, the brand dark. Clearly visible: the buttons read as barely-outlined boxes instead of crisp dark outlines.
2. **Newsletter "Subscribe" had no padding** — fixed size only. The original is `10px 20px`.

Verified matching after the fix:

| Button | Size | Border | Radius | Background | Padding |
|---|---|---|---|---|---|
| Header "Install Now" | 172x51 | none | 8px | `#548B2F` | 15px 30px |
| Hero "Get Started" | 144x47 | none | 8px | `#16250E` | 15px 30px 14px |
| Pricing "Get Started" | 209x43 | 1px `#16250E` | 8px | white | 12px 30px |
| Pricing (popular) | 208x43 | 1px `#16250E` | 8px | `#16250E` | 12px 30px |
| Newsletter "Subscribe" | 113x46 | 1px `#548B2F` | 8px | `#548B2F` | 10px 20px |

The scan also picked up two buttons in sections not yet built, recorded here so they are not missed:

- **"Read More Reviews"** (testimonials) — 185x44, 1px `#16250E`, radius 8px, background `#16250E`, padding 12px 20px
- **"Try StoreFAQ Today"** (CTA band) — 163x24, no border, transparent background, padding `0 0 5px` — a text link with an underline rule, not a filled button

### Feature card gaps — reported and fixed

Flagged in review: on mobile some feature cards touched with no gap.

Verified against the live site first — the original does the same thing, so the build was faithful. But it is clearly drift rather than design: the same grid uses 30px between some pairs and 0 between others, and at 768-1279 the row gaps are 13/22/24. Normalised per the A1 "fix content bugs" decision.

Card cells still match the reference exactly at every viewport; only the gaps between them changed.

**Near-miss worth recording:** the edit that replaced the row-spacing block was anchored on a start and end string, and the `.feature` card rule (background, radius, padding) sat between them — so it was silently deleted and every card lost its background. Caught by the crop, not by the geometry diff, which still reported cells as exact. Anchor block edits on their own boundaries, and re-check a crop after any range-based CSS replacement.

### CTA band — done

**1px worst delta at all 7 viewports**, verified with a crop comparison as well as geometry.

- Section padding 30/20 below 1280, 60/20/70 above.
- Card is `#2F4621` with a **32px** radius, padding 30px below 768 and 50px above; two equal columns, `align-items: center`, gap 0 stacked / 20px side by side.
- Title 26/33.8 w600 white below 1280, 48/62.4 above, `text-transform: capitalize` (same as hero and features).
- The **swoosh is centred in the text column and offset 10px right** — constant at every width (verified at 360/480/768/1024/1280/1440). Note this differs from the feature-lead swoosh, which sits at ~48.7% from the left; they are not the same rule.
- Title, swoosh and link stack with **no gaps at all** — the swoosh starts the pixel after the title ends.
- The text column carries **20px of trailing space below 768** and none above.

"Try StoreFAQ Today" is a **text link with a 1px white rule beneath it**, not a filled button: 16/16 w600 below 1280, 18/18 above, padding `0 0 5px`, linking to the app listing.

Two bugs found while building it:

1. The link was `inline-block`, so the container's line-box strut added ~5px of leading beneath the swoosh and pushed the whole column 5px long. Fixed with `display: block; width: fit-content`, which also keeps the underline to the text width.
2. An orphaned dev server from an earlier session was still holding port 4321, so the diff was measuring stale output while the new server sat on 4322. Worth checking the port when a component renders in `dist/` but not in the diff.

### Feature card image alignment — reported and fixed

Flagged in review: card images were not aligned to the bottom.

Measured the gap below each image (card bottom minus image bottom), 8 cards across 5 viewports:

| | ref | mine (before) |
|---|---|---|
| 360 / 768 | all `0` | `0` / up to 30 |
| 1024 | all `0` | up to **59** |
| 1280 | all `0` | up to 56 |
| 1440 | all `0` | up to 30 |

The original keeps every image flush to its card's bottom edge. Cards in a row stretch to the tallest, so when one card's title wraps to fewer lines the slack has to go **above** the image, not below it. Mine let the slack fall to the bottom.

Fixed by making `.feature` a flex column and giving `.feature__sub` `margin-bottom: auto`, which absorbs the slack between the copy and the image. All tails are now `0` at all 7 viewports.

Section and cell geometry is unchanged by this — the earlier diff had been comparing *column* heights, which matched, while the card inside still had a tail. Another case of a passing geometry diff hiding a visual problem; the measurement had to target the card, not the column.

The per-card `gap` values in `home-features.ts` now act as **minimums** rather than fixed gaps — the driving card in each row still sets the row height, which is why 1280/1440 cells continue to match exactly.

### Testimonials — done

**0 failures, 1px worst delta at all 7 viewports**, verified with crops at 1440 and 360 as well as geometry.

Section: padding 30/20 below 1280, 60/20 above; heading centred, 28 → 32 → 48px, line-height 1.3 throughout, colour `#000131` (the same ink as the pricing "Popular" badge), margin-bottom 40px → 65px.

Six cards, three columns of two from 768 up, one column below. **The columns pack independently** — the cards do not line up row by row — so this is three flex columns, not a grid.

- Column gap 20px, card gap 24px, columns are `flex: 1 1 0`.
- Card: 16px radius; padding `25px` below 768, `40px 32px 40px 15px` between 768 and 1279 (asymmetric on purpose — measured), `40px 32px` above.
- Name IBM Plex Sans 600 at 18 → 16 → 24px, line-height 1.55 throughout, `#16250E`.
- Location Manrope 500 at 14 → 18px, line-height 1, `#444565`.
- Quote Inter 400 at 14/22.4 → 18/28.8, `#4A4F48`, margin-top 14 → 18px.
- Stars sit in a 24.8px line box; 16px below 1280, 21px above, `#000131`, 5px margin-right on **all five** including the last (it sets the name block's max-content width).
- Button "Read More Reviews" is filled `#16250E`, 8px radius, IBM Plex Sans 500 16/17.6 white — 185x48 (`14px 20px`) below 768, 205x52 (`16px 30px`) to 1279, 185x44 (`12px 20px`) above. Centred, 56px below the stack and 32px once the cards sit in columns.

#### Four things only a measurement would have given

1. **Every card has its own tint.** `#F4F9FF` blue, `#F7F7FF` periwinkle, `#F6FFFF` cyan, `#FFFAF6` peach, `#FBF5FF` lilac, `#FAFFF5` leaf-green. Each card also carries a 1px border in its own fill colour — invisible, but 2px of the content box.

2. **The row is 24px taller than its tallest column at some widths.** The 24px between stacked cards is a *bottom margin on each card*, not a column gap — including on the last card, where it collapses out of the column block and is then trapped by the flex item, lifting the row. Exactly one card (Plentiful Earth, bottom of column 1) has that margin zeroed, which is why the effect appears at 1440/1920 but not at 768/1024/1280. Reproduced with a real `margin-bottom` on the cards and a `flush` flag in the data rather than a `gap`, so the arithmetic works out the same way.

3. **The stacked order reads across the columns, not down them** — Vegas, Moore, Vida Pura, then Plentiful, SitnStand, PK. The original does this by shipping a *second, mobile-only row* holding copies of the lower three cards (byte-identical text, verified against the captured HTML). One list plus `display: contents` and `order` on the columns reproduces it without the duplication.

4. **Those mobile-only copies were left on the 16px name from the tablet range** while the three beside them use 18px — 3px per card, 9px of page height. Reproduced rather than normalised, since the brief is a migration. **Decided (2026-09-09): keep it reproduced.**

#### Deviation: Font Awesome

The stars were a `Font Awesome 6 Free` webfont glyph. Replaced with the same icon inlined as SVG at `1.125em` wide (the glyph's own advance width, which is why the measurements line up exactly). Drops a font request; icon is Font Awesome Free 6, CC BY 4.0.

#### Deviation: the review link

The captured href carried a per-visit `search_id` tracking token. `external.shopifyReviews` uses the bare `https://apps.shopify.com/storefaq/reviews`, which resolves to the same page.

#### The geometry diff missed the tints

Every box matched to 1px and the section still looked wrong, because the paint check compared only the *first* card's background. `scripts/diff-testimonials.mjs` now checks background, border and all four text colours **per card**, at every viewport. Fourth time in this phase that a passing geometry diff hid a visual problem — the crop is what caught it, again.

### FAQ accordion — done

**0 failures, 1px worst delta at all 7 viewports**, verified with a crop at 1440 and an interaction test against the live site.

The whole section sits on a **cream card** (`#F9F7EC`) — radius 20px and padding `40px 30px` below 1280, radius **60px** and padding `80px` above. Section padding is `30px 20px` / `50px 20px 60px`.

Two columns, `align-items: center`: intro then accordion, stacked below 1280 and 40/60 above with a 30px gap. The columns are `width`-sized, not flex-sized — between 768 and 1279 the original leaves each column **15px (half the gap) narrower than the row**, and at 1280 up they are 40/60 of what remains *after* the gap, which a flex-basis percentage does not give.

- Title IBM Plex Sans 700, 26/33.8 → 48/62.4, `capitalize`, `#16250E`, **`padding: 0 0 15px`**.
- Subtitle Inter 400 16/27.2, `#45503F`, **`padding: 0 0 30px`**. Both spacings are padding on the text, not gaps — worth knowing, because a gap would have put the same pixels in a place that measures the same but reflows differently.
- The intro column carries **`padding-bottom: 40px` only between 768 and 1279**, where the swoosh is hidden. Not at 360, not at 1280.
- Swoosh: hidden below 1280; above it, centred in what is left of the column after a 50px indent, 58x53.8, 20px of clearance beneath.

Accordion:

- Item: 1px `#E2DDC2`, radius 6px, `overflow: hidden`, `margin-bottom: 20px` on **every** item. The list needs `overflow: hidden` too — that is what stops the last item's margin escaping, and it is why the list is 20px taller than its items and the column height comes out right. Same shape of trap as the testimonial row.
- Header: `padding: 25px 20px`, flex **`row-reverse`** so the icon is first in source and right in paint, `align-items: center`. Background `#F9F7EC` closed, `#F3EED6` open, 0.5s transition.
- The title sits in a `flex: 1` box and is itself shrink-to-fit, so it only wraps once it runs out of room. IBM Plex Sans 500, 16/19.2 → 20/24, `#172B4D`.
- **The answer panel is `#F3EED6` at all times**, not only when open — which is why the open item reads as one solid block rather than a tinted header over a lighter body.
- Panel padding `0 20px 20px 25px` below 1280, `0 20px 24px` above. Body Inter 400 16/25.6, `#45503F`.

#### §B3 decision: `<details name>` and no JavaScript

Built as `<details name="home-faq">` + `<summary>`, which gives the original's behaviour natively. Verified against the live site, same script:

| | live site | mine |
|---|---|---|
| on load | `[open, –, –, –, –]` | same |
| click item 3 | `[–, –, open, –, –]` | same |
| click it again | all closed | same |

So: one open at a time, the first open on load, and clicking the open one closes it. **The section ships zero JavaScript** (the built page still contains only the pre-existing mobile-nav and newsletter scripts).

The one thing CSS cannot fully cover is the 500ms slide (`data-transition-duration="500"` on the original block, animated from JS). It is reproduced with `interpolate-size: allow-keywords` + `::details-content`, behind an `@supports` guard: the animation runs in Chrome/Edge and the panel toggles instantly in Safari and Firefox until they ship it. **Decided (2026-09-09): keep it CSS-only.** The section ships no JavaScript; the slide animates in Chrome/Edge and toggles instantly elsewhere until Safari and Firefox ship `interpolate-size`, at which point it starts animating there with no change to this code.

#### Deviation: Font Awesome

The chevron was a `Font Awesome 6 Free` glyph, swapped between `angle-down` and `angle-up` from JS. Inlined as SVG and rotated 180deg from the `[open]` state instead — one path, no font request, no script. Icon: Font Awesome Free 6, CC BY 4.0.

#### The duplicate-block trap, again

The first measuring pass anchored on `document.querySelector('.eb-infobox-wrapper .title')` and silently measured **a different infobox further up the page** — DM Sans 12px at `y≈162` instead of IBM Plex Sans 48px at `y≈7428`. Everything downstream was wrong and nothing looked obviously wrong. `scripts/diff-faq.mjs` anchors on `.eb-accordion-container` and walks up from there; nothing in it starts from a bare `document.querySelector`.

### Whole-page check — `scripts/diff-home-page.mjs`

With all six sections built, the page is now compared end to end: each section band's height and offset, plus the total height of `main`. Sections that pass individually can still drift once stacked, and a per-section diff cannot see that.

Result at 1280 / 1440 / 1920: **every section within 3px, total within 3px** (1440 and 1920 are within 1px).

Below 1280 exactly two deltas remain, both already accounted for:

| | 360 | 480 | 768 | 1024 |
|---|---|---|---|---|
| feature stack | +65 | +64 | +47 | +48 |
| pricing | −151 | −100 | −1 | −1 |
| everything else | 0/−1 | 0/+1 | 0/+1 | 0 |

The feature-stack delta is the **mobile card gap normalisation you asked for** — the original leaves two rows touching on small screens and this build does not. The pricing delta is the documented row-equalisation limitation. **Decided (2026-09-09): accept it** — the rows sit at their natural height on phones, so the table is more compact than the original; nothing overlaps or misaligns, and no script is added.

### Hero: two errors the section diff reported and I did not read

Running the page end to end surfaced a hero that was 25px too tall at 360/480 and 3px short from 768 up. Re-running `scripts/diff-section.mjs hero` showed it had been reporting `section ✗` all along — every *named* box passed, I read those, and I wrote "within 2px at all 7 viewports" without looking at the section row itself. That claim was wrong.

Two real causes:

1. **The badge is missing a 1px `#DBE8D0` border.** Not a rounding gap — a visible pale-green ring around the mint fill, and 2px in each direction. My earlier button-border audit did not cover it because the badge is not a button.
2. **The trailing space below the button is 30px stacked and 28px side by side, not a flat 27px** — and while stacked it *is* the gap: the original's hero row has `gap: 0` there. Mine had both a 27px pad and a 30px gap, so the image sat 25px too low.

Both fixed; the hero is now 0px on every box at every viewport.

Lesson, and the fourth variant of the same one in this phase: a diff that prints a ✗ is only useful if every line of it gets read. "The parts I looked at passed" is not "it passed".

## Decisions taken 2026-09-09

| Question | Decision |
|---|---|
| FAQ accordion open/close animation | **CSS only, no JavaScript.** Animates where `interpolate-size` is supported, instant elsewhere. |
| Pricing table 151px short at 360 (100px at 480) | **Accept.** Natural row heights on phones; no equalising script. |
| Testimonial names 16px vs 18px on mobile | **Reproduce** the original's inconsistency. |

Still open, all from earlier phases: the "Changelog" nav item's type (Sora 16px in the original vs IBM Plex Sans 18px on its neighbours), `tokens.css` carrying 47 custom properties against the gate's 40, the newsletter's stacked layout at 360, and the header ballooning to 325px between 600 and 767.

## Phase 5 — Home is complete

All six sections built and verified: hero, feature stack, pricing, CTA band, testimonials, FAQ. Page total within 3px at 1280 and above, within 1px at 1440/1920. The two deltas below 1280 are both decided above.

### Pricing: the "Popular" badge outline — reported and fixed

Flagged in review with the badge band boxed. The badge was missing its **1px `#EFE0A1` border** — the same rule colour the popular column uses down its sides — with `border-radius: 10px 10px 0 0`. Not a rounding gap: a visible ring, and the 2px the badge was short in each direction (248x61, not 251x61). It is inset 1px from the column edge so its side borders continue the column's own rules; the bottom edge is covered by the header cell, so it reads as a three-sided cap.

Checking that led to four more differences in the same section, none of which the geometry diff had been looking at:

1. **The four prices are three different inks.** Free `#272541`, Professional `#101828`, Growth `#111111`, Enterprise `#272541`. Mine painted all four `#111111`. Stored per plan in `home-pricing.ts` rather than averaged, since there is no system to derive.

2. **Header cells pack from the top, not centred.** Mine used `justify-content: center`, which landed correctly for three of the four plans purely because their content summed to exactly the 200px content box. Now `flex-start` with the measured spacing: name +0, price +32, button +149.

3. **Enterprise's header block starts 15px lower and is indented 5px**, with its button pulled in 5px on both sides. Nothing in the content asks for it — it is how that block was authored — but it is visible against its neighbours, so it is reproduced (`offset: true` in the data). Mine had been getting a 9px drop by accident, from the centring above.

4. **Below 1280 the plan headers are centred** — name and price both — **except Enterprise, which stays left-aligned.** Mine left-aligned all four. This one is plainly visible on a phone.

Result: 768, 1024, 1440 and 1920 are now **completely clean**; 1280 has only the pre-existing 3px; 360 has only the accepted row-equalisation shortfall.

#### Four bugs in the pricing diff itself

The reason none of the above showed up is that `scripts/diff-pricing.mjs` was comparing the wrong things:

- It measured **boxes, never text**. The Enterprise indent is `padding-left` — it moves the glyphs, not the box — so it was invisible. It now measures a `Range` over each element's contents on my side against the reference's inline text.
- It read **no colours at all**, so three different price inks passed.
- `heads.slice(1)` assumed the label column's header is always present. It is only there from 1280 up, so below that **every plan was compared against its neighbour** — which is why the Growth column appeared to have a yearly line.
- `content` compared two different wrappers: the reference's excludes the absolutely-positioned badge band, mine included the 61px grid row. That produced a constant +59 that had been sitting in the output as accepted noise, exactly the kind of permanent ✗ that trains you to stop reading.

It now also checks the badge's border, radius and fill, and reports a hidden label column as absent rather than as a zero-sized box.

## Phase 5 — Features page (`/features/`)

**0 failures, 1px worst delta at all 7 viewports**, geometry and paint, verified with crops at 1440 as well.

Three sections: a centred page header, the feature list, and the same FAQ block as Home. `src/components/home/Faq.astro` moved to `src/components/Faq.astro` — the two are byte-identical in content, verified against the captured HTML.

### Page header — `src/components/PageHead.astro`

Section padding `50px 0` below 1280 and `88px 0` above. The content is a **fixed-width centred column**, not a fraction: `min(100%, 390px)` below 1280 and `min(100%, 630px)` above. Title 28/36.4 → 48/62.4 w600 `#16250E` with `margin-bottom: 16px`; subtitle 16/25.6 → 18/28.8 `#45503F` with `margin-bottom: 20px`. Reusable for the remaining pages if they measure the same.

### Lead block

Sits on a **`#F3F9EC` card with a 16px radius** and `padding: 30px 0 0 30px` while stacked, `50px` all round once the columns are side by side. The vertical padding is load-bearing: `align-items: center` measures against the padded box, and without it the text column sat 22px high.

- 40/60 split at 1280+, 50/50 at 768–1279, stacked below.
- Swoosh first, then title (40/52 w600 `#1D2939`, `capitalize`, the phrase "Frequently Answered Questions" in `#88C15A`), then subtitle, then a "Learn More →" link.
- The media column has a **45px left gutter with the sparkle in it** — `Group-39470.png` at `0% 50% / 60px auto` — so the screenshot is 675 wide in a 720 column. Identical to the home page's lead card.

### The eleven cards

- Shell: 1px `#F0F0EE`, 8px radius, `overflow: hidden`, no fill.
- Image band: per-card tint (`#F2F9F7`, `#F9F7EC`, `#F3F9EC` in threes), `padding: <top> 30px 0` where top is 20px on two cards and 30px on the rest, and a **1px `#F0F0EE` rule along its bottom edge**.
- Body `padding: 30px`. Title 22/28.6 w600 `#16250E` with `padding-bottom: 16px`. Description **Inter** 16/24 `#45503F` — the only body copy on the page that is not IBM Plex Sans, and it changes where two of the eleven descriptions wrap. Its `padding-bottom` is 22px except on two cards (32px and 34px).
- "Learn More →" 16/20.8 **w500** `#45503F`, `display: flex` (as an inline box it picks up the body's 24px strut and gains ~3px above and below).
- One per column below 1280, three above, `gap: 24px` / `40px 24px`.

Two structural details:

1. **The original does not equalise card heights within a row** — each card is as tall as its own screenshot and copy make it. `align-items: start`, not the grid default.
2. **The last row has an empty third column.** It paints nothing, but while the cards are stacked it still contributes a 24px gap, and the section's height depends on it. Reproduced as an empty grid cell.

### The measurement was lying, twice

**The lead block's green ground and its sparkle were both missing** and the geometry diff passed anyway — every box was within 1px because the ground and the sparkle are paint, not layout. The crop caught it. Same shape as the pricing badge; the diff now reads the lead's background and the sparkle's position and size.

**The reference itself was varying run to run.** One card measured 3 description lines on one run and 4 on the next, a 24px swing, and the "failure" moved with it. Cause: measuring mid font-swap. Neither fix that looks right actually works —

- `await page.evaluate(() => document.fonts.ready)` is a **no-op**: it resolves to a `FontFaceSet`, which Playwright cannot serialise, so the promise is never awaited.
- `document.fonts.check('16px Inter')` returns **true before the face is applied**, so gating on it still measures the fallback.

What works is waiting for the page height to stop changing — three consecutive equal readings, 100ms apart. Applied to all nine `scripts/diff-*.mjs`. Every measurement taken before this is suspect to about one line of text; the sections re-run since (Home end to end, pricing, features) all hold.

Also fixed in the features diff: comparing background-image **filenames** across a migration fails by construction, since assets are renamed. It compares "has an image" plus position and size.

### Newsletter + footer — reported and fixed

Flagged in review with a screenshot of the live section. Seven differences, and the largest was invisible to every box measurement.

**The newsletter band is a hard-stop 50/50 gradient** — `linear-gradient(#FFFFFF 50%, #16250E 50%)` on the section — so the footer's dark ground begins **147px into the 324px card** and the card appears to straddle the boundary. There is no negative margin and no overlap in the box model: the section, the card and the footer all measure identically with and without it. My build painted the page's `#F9F9F9` above the card and started the dark at the footer element, 36px *below* it.

The rest:

| | original | mine |
|---|---|---|
| newsletter padding-bottom | 30px | 60px |
| footer padding-bottom | 0 | 20px |
| footer heading | 18px/1 below 1280, 24px/1 above | 24px/1.55 throughout |
| footer links | 14px below 1280, 16px above, **w500**, `display: block`, `line-height: 1.6` | 16px w400 inline, 9px li margins |
| footer links + headings | `text-transform: capitalize` — "BetterDocs for Shopify" renders as "BetterDocs **F**or Shopify" | as authored |
| social icons | 32px/5px gap below 1280, 36px/15px above | 36px/33px throughout |
| bottom bar | 40px below the columns, 30px padding each side, 1px `rgb(255 255 255 / 0.1)` rule | 50px, no padding, no rule |

All fixed. `scripts/diff-footer.mjs` now reads paint as well as boxes: the band's `background-image`, the link and heading type, the social geometry and the bar's rule. It had been passing on all six of its boxes the whole time.

#### Still open: the form at 360

`input ref 196 mine 156`. On the original the Subscribe button **overflows the white pill by 29px** at 360 — the input is 196 wide and the button 113, in a 280px pill. Mine shrinks the input so the button sits inside. Reproducing it would mean reproducing an overflow; it stays on the open list.

#### How the probe misled me first

My first pass measured the *element* whose computed background is `#16250E` and concluded the live site has a 30px gap and never overlaps — at fifteen viewport widths from 1024 to 2560. That contradicted the screenshot, and I nearly wrote it off as not-the-live-site. What settled it was sampling **rendered pixels** down the left gutter: dark begins at card-top + 147 on the original and + 354 on mine. Computed styles describe elements; only pixels describe the page.

## Re-verification under the stabilised measurement

Every section built before the font-settling fix was re-run:

| | result |
|---|---|
| hero | 0 failures |
| CTA band | 0 failures, 1px |
| testimonials | 0 failures, 1px |
| FAQ | 0 failures, 1px |
| chrome (header/footer) | 0 failures, **0px** |
| pricing | only the accepted 360 shortfall and the pre-existing 3px at 1280 |
| feature stack | see below |

Nothing was hiding behind the old settle. The one thing it did surface was in the feature stack, and it turned out to be two separate problems.

### Feature stack: the diff was comparing a card against a column

`cells[0]` read 30px short at 360 and 480. The card matched exactly (423.8 vs 424) — but `diff-features.mjs` was measuring the reference's **column**, which also contains the card's 30px bottom margin, against my **card**, which expresses that margin as a grid row-gap. Two different boxes. It now measures the card on both sides.

### Feature stack: the original does not equalise cards in a row

With that fixed, `cells[1]` was 13–56px too tall from 768 up. The reference leaves the two cards in a row at their **own** heights — the bottoms are ragged — while my grid stretched them to match.

This is the other half of the alignment problem reported earlier. The fix then was `margin-bottom: auto` on the subtitle, which pushed the slack above the image so the image stayed flush; correct as far as it went, but it was compensating for stretching that should not have been happening. `align-items: start` removes the stretch, so each card is its natural height, the bottoms are ragged as on the original, and every image is still flush.

Verified: card heights match at all 7 viewports, and the tails are `[0,0,0,0,0,0,0,0]` on both sides at all 7. The tails check is now part of `diff-features.mjs` rather than something I ran by hand.

The four remaining section deltas (+65/+64/+47/+48 below 1280) are the mobile card-gap normalisation you asked for, unchanged.

### Card heights equalised — reported and fixed

Flagged in review with the /features/ cards boxed: the three cards in a row end at different heights, and it reads as a mistake.

The original leaves them ragged — each card is as tall as its own screenshot and copy make it. I had reproduced that faithfully on both card grids (and had just changed the home feature stack *to* be ragged for exactly that reason, one commit earlier). **This is now a deliberate departure**: `align-items: stretch` on both grids, so cards in a row match the tallest.

Applied to both, not just the page in the screenshot: the home feature stack has the same raggedness, and it shows more there because those cards carry a background colour.

- `/features/` — the slack lands below the "Learn More" link, inside the card's border.
- Home — the slack lands **above the image**, never below it, because `.feature__sub` keeps its `margin-bottom: auto`. Tails verified `[0 x 8]` at all 7 viewports, so the images are still flush.

Neither grid's row heights change (a grid row is already as tall as its tallest item); only where each card sits inside its row. Section heights are unchanged.

#### The diffs now encode the deviation rather than reporting it forever

Both `diff-features.mjs` and `diff-features-page.mjs` compare each card's height against **the tallest card in its reference row**, not against its own. Width, x, y, the image band, the text positions and the paint still compare card to card, so a genuinely wrong card still fails. Result: 0 failures on both, with the deviation stated in the code rather than sitting in the output as noise to be scrolled past — which is how the `content` +59 went unread on the pricing diff for weeks.

## Entrance animations (GSAP) — requested addition

**This is a departure from the migration brief, not a fidelity fix.** The original has no entrance animation; asked for in review, so it is additive and reversible (delete `Motion.astro`, `motion.css`, the `<head>` snippet and the `data-anim` attributes).

Scope is `<main>` only. Header, newsletter band and footer are excluded and are interactive from first paint, as asked.

### How it is put together

Targets are marked in the markup as `data-anim="heading|text|media|card|chip"`, not matched by a selector list in the script — so the set the script animates and the set CSS hides beforehand cannot drift apart. 39 elements on Home, 26 on /features/. Cards animate as a unit rather than per child; staggering the inside of a card as well reads as noise, not polish.

Presets: heading rises 24px over 0.7s, body copy 16px/0.6s, media 20px + a 0.985 scale over 0.8s, cards 28px/0.7s, chips 12px/0.5s — all `power3.out`, staggered 0.09s within a section. Each section gets its own ScrollTrigger at `top 85%`, `once: true`; without per-section grouping a long page staggers sixty elements off one trigger and the last cards are still waiting long after they have been scrolled past.

### Four things that had to be got right

1. **`prefers-reduced-motion` is honoured at the source.** The `<head>` snippet only adds `.js-anim` when motion is welcome, so for anyone who has asked for less there is no class, no hiding rule and no dependency on JavaScript arriving to make the page readable. Verified with `reducedMotion: 'reduce'`: everything is at opacity 1 from first paint.

2. **The LCP element does not wait on the bundle.** An element at `opacity: 0` does not count as painted, so driving the hero from a 43KB bundle would put the page's largest paint behind that download on every cold visit. Above-the-fold elements carry `data-anim-intro` and animate from CSS keyframes instead — no JavaScript in that path at all. The module skips them.

3. **Failure modes are covered.** With JavaScript entirely off, nothing is ever hidden (screenshot-checked — the page renders complete). If the bundle is merely slow, a 2.5s failsafe reveals everything and sets a flag; a late-arriving module sees the flag and does *not* re-hide the content to animate it, which would read as content vanishing.

4. **Nothing moves the layout.** Only `opacity` and `transform` are animated. Measured **CLS 0** over a full scroll of the home page, and the section offsets are byte-identical with and without motion — so every measurement recorded above still holds.

### The cost, plainly

| | before | after |
|---|---|---|
| JS shipped | 1.4 KB gzip | **44.6 KB gzip** (43.2 GSAP + ScrollTrigger, 1.4 existing) |
| inline script | ~1.3 KB | ~2.0 KB |

That is roughly 30x the site's previous JavaScript, on a site that until now shipped none of consequence. GSAP + ScrollTrigger is the right tool if the animation is going to grow; if this stays as-is — fades and rises on scroll — the whole thing is expressible in ~2KB with `IntersectionObserver` and the same CSS keyframes already written for the hero. Worth revisiting before launch.

### All diffs run in reduced motion

Every `scripts/diff-*.mjs` and `crop.mjs` now opens its context with `reducedMotion: 'reduce'`, so measurements are taken with elements at their final position — and the accessibility path gets exercised on every run. Re-verified after the change: hero, CTA, testimonials, FAQ, features-page and chrome all 0 failures; features, pricing and footer show only their documented deviations.

## Phase 5 — /docs/ (index shell)

Built from `reference/html/docs.html` and measured live. Four sections: search
hero, category card, the shared FAQ, then chrome.

`diff-docs.mjs` reports **0 geometry failures at all 8 viewports** (360, 480,
600, 768, 1024, 1280, 1440, 1920), worst 3px, and every paint property equal.
The crops are indistinguishable.

### What was measured

| | below 768 | 768–1279 | 1280+ |
|---|---|---|---|
| hero padding | 70px 0 | 70px 0 | 100px 0 |
| heading | 22/28.6 w600 | 22/28.6 | 48/62.4 |
| heading margin-bottom | 20px | 20px | 32px |
| search box | 316px wide | 690px | 690px |
| search padding | 4px 4px 4px 10px | 8px 8px 8px 24px | same |
| placeholder | 14px | 18px | 18px |
| mint card padding | 40px 20px | 40px 20px | 88px 80px |
| category grid | 1 col to 500px, 2 from 501 | 2 col | 2 col |
| card padding | 28px 16px | 28px 16px | 40px 20px |

New tokens: `--color-search-rule #DAE2EF`, `--color-search-icon #98A2B3`,
`--color-placeholder #7D7E9D`, `--color-icon-tile #F9FBF6`,
`--color-stamp #F5F8F3`.

The category grid's 501px breakpoint is BetterDocs' own (`max-width: 500px` in
its stylesheet) and is none of this site's four. It is reproduced as measured
rather than rounded to the nearest house breakpoint.

### Two things in the original that paint nothing, and are not reproduced

1. **The hero heading declares Cardo at a fluid clamp** — 30.03px at 360 rising
   to 40px at 1280 — and `line-height: 0`. None of it reaches a pixel: every
   glyph sits in an inner `<span>` that re-declares family, size and weight
   (IBM Plex Sans 22/28.6 600, 48/62.4 at 1280). Copying the outer declaration
   would have pulled a whole extra webfont onto the page for text that never
   uses it. The only observable effect of `line-height: 0` is that the h2's box
   equals the span's line box, which one element with the right line-height
   gives directly.
2. **The heading sits in a wrapper with `margin-bottom: 20px` while the heading
   itself carries 15px.** Nothing separates them, so the two collapse and only
   the larger is ever visible. One margin here measures the same as their two.

### Departures

- The heading is the page's `<h1>`. The original marks it `<h2>` and the page
  therefore has no `<h1>` at all — the same §B7 item as the home hero.
- The search is a real `<form>` with a labelled `<input type="search">`, not the
  original's pair of `<span>`s. It stays inert until the docs collection and its
  index exist (Phase 7); the action is the docs index, so a submit before then
  lands on a real page rather than a 404.
- `docs-categories.ts` holds the doc counts and "Last Updated" dates as
  literals so the shell renders the measured page. Once the 16 articles land as
  a content collection both become derived and the file keeps only icon + title.
- `Faq.astro` now takes `entries`, `sub` and `name`. Home and /features/ carry
  the same five questions and the same subtitle, so those stay the defaults;
  /docs/ has its own five and its own subtitle ("Stuck on something? …").

### The diff had to be taught three things

All three are repeats of mistakes made earlier on this migration, so they are
now written into the script rather than remembered:

1. **Compare glyphs, not boxes, when the two sides nest text differently.** The
   heading read 827px wide on the reference's inline `<span>` against my
   centred block. `Range.getBoundingClientRect()` on both sides put it at 0.
2. **Report only paint that can reach a pixel.** The reference's category card
   is a bare `<a>`, so its `color` is the browser's default link blue and its
   border colour is a transparent 0px border — neither observable, because every
   text child sets its own colour. A border colour on a 0px border and a text
   colour on an element with no text are now suppressed, and the type is read
   off whichever pass-through wrapper actually holds the words.
3. **"Has an image", not which file.** Comparing background-image filenames
   fails by construction across a migration, forever, while telling you nothing.

## Chrome: the footer was 47px out and every box passed

Chasing the /docs/ page total — exact in every section, 47px out overall at 360
— led into the footer, which `diff-footer.mjs` had been reporting clean.

It was clean, on everything it looked at. It compared the newsletter card, the
form, the input, the submit, the brand logo and the column widths, and none of
those had moved. **Nothing measured the distance between them.** The errors were
all in vertical rhythm, which no box in the list could see.

`diff-footer.mjs` now measures three structural spans — newsletter card bottom
→ bottom-bar top, the bar's own height, and bar bottom → document bottom. Those
are found by background colour and by the bar's 1px white-10% rule, so they pick
the same thing on both sides.

Four real defects, all sitewide:

1. **`.footer__list` and `.footer__social` were 27px** where the original is 20px
   stacked and 25px side by side. Three stacked columns made that 21px at 360.
2. **The bottom bar's type was 16px/1.55** where the original is 14px/1.5 below
   1280 and 16px/1.5 above, and the two lines are centred and separated by 20px
   of padding under the copyright — not by a gap on the row.
3. **The bar was a flex row** where the original is a sentence with two logos set
   into it. As a flex row the words could not wrap around the images, the line
   broke in the wrong places, and the block ran a line too tall. It is ordinary
   inline flow now, with `flex: none` on the two lines above 768 — left to
   shrink, the copyright wraps and the bar grows by a whole line.
4. **The copyright sentence was wrong.** It read "A Storeware Product from
   [Storeware] [logo] family" — the word twice, once as text and once as the
   link. The original is "A **[Storeware]** Product from [logo] family". The
   extra link made the line 60px too wide to fit at 480, which is the whole of
   that viewport's 21px discrepancy.

Also: Astro trims whitespace at element boundaries across a line break, which
had silently run "from", the link and "family" together with no spaces at all —
and the same for "Hosted with" and the xCloud logo. Both paragraphs are one
source line now, with a comment saying why.

Result: **every span 0px at 360, 480, 1280, 1440 and 1920, and 1px at 768 and
1024.** The only remaining ✗ is the documented 360px newsletter deviation (the
original's Subscribe button overflows its white pill by 29px; mine shrinks the
input so it fits).

### DM Sans was a static file pretending to be variable

The bottom-bar link is bold on the original. Setting `font-weight: 700` changed
the computed style and **not one pixel** — the crop still showed regular weight.

`public/fonts/DMSans-Variable.woff2` was 14KB and had no usable weight axis:
the same string measured 419.1px at 300, 400, 500, 600, 700 and 800. So every
DM Sans weight on the site had been rendering as one — the footer column
headings (500), the copyright line (400) and this link (700), all identical.

Replaced with the wght-only latin variable from Google Fonts, which is
**byte-for-byte the file the reference itself serves**
(`dmsans/v17/rP2Yp2ywxg089UriI5-g4vlH9VoD8Cmcqbu0-K6z9mXg.woff2`, 37KB). The
opsz variant is 62KB and the site does not use optical sizing. "Storeware" now
measures 70.0px on both sides, against 66.7px before.

Inter, IBM Plex Sans and Manrope were checked the same way and all three vary
correctly. `scripts/probe-font-axes.mjs` is that check, kept: a static font
masquerading as variable is invisible to every other test in this repo —
computed styles report the weight you asked for, and only the glyphs disagree.

**Lesson, alongside "a passing geometry diff hides paint":** a diff that
measures only boxes hides *rhythm*. Both footer defects and the /docs/ page
total were spacing between boxes that were each individually correct.

### Dangling links, to close before launch

Three routes are linked from built pages and do not exist yet. All three are
filled by the docs content collection, so they close together:

| linked from | target | closed by |
|---|---|---|
| /docs/ category cards | `/docs-category/getting-started/`, `/docs-category/configuration/` | the collection's category pages |
| /features/ "Learn More" (×11) | `/docs/<slug>/` | the 16 article pages |
| header + footer nav | `/blog/`, `/changelog/`, `/privacy-policy/` | Phase 5 remainder |

Ground rule 8 is "no broken links **at launch**", so these are expected now;
they belong on the Phase 10 checklist, and `assert-clean.sh` should grow a
link-resolution pass once the collection exists.

## Phase 5 — /changelog/

A page header on a mint card, then a 33-entry release timeline. `diff-changelog.mjs`
reports **0 failures at 7 viewports**, worst 1.6px, and the page total is
**exactly equal at 1280, 1440 and 1920** (17,909px on both).

### The content is scraped, not captured

`reference/html/changelog.html` was already a release behind — it has 32
entries, the live page has 33. Building from the capture would have put the
page ~600px out with nothing in the layout to blame, so
`scripts/scrape-changelog.mjs` pulls the entries from the live page into
`src/data/changelog.ts`. It keeps only `<strong>`, `<em>`, `<a>`, `<code>` and
`<br>`, drops every attribute, and discards the builder's wrappers at scrape
time — so no WordPress class can reach the output (§B1). Re-run it when a
release ships, until the changelog moves into the CMS.

### What was measured

| | below 768 | 768–1024 | 1025+ |
|---|---|---|---|
| columns | 30% / 70%, no gap | `calc(27% - 10px)` / `calc(73% - 10px)`, gap 20 | `calc(27% - 5.4px)` / `calc(73% - 14.6px)`, gap 20 |
| entry card radius | 10px | 30px | 30px |
| date type | Sora 12/14.4 | Sora 14/16.8 | Sora 14/16.8 |
| page h1 | 26/33.8 | 26/33.8 | 40/52 |

Fixed everywhere: 60px below each entry, the version at `padding: 40px` with a
`1px solid rgb(0 0 0 / 0.06)` bottom rule, the notes block at `padding: 40px`,
`h3 { margin-bottom: 14px }`, `ul { padding-left: 14px; margin-bottom: 30px }`,
`li { margin-bottom: 5px }` — the last of which collapses through the list's own
bottom edge, which is why the space under a list is 30px and not 35.

The two column formulas differ because the original compensates for the 20px
gap differently either side of 1025: half of it per column below, and each
column's own share of it above. Both are reproduced as measured.

**`<strong>` in an entry is `font-weight: 400` against the list's own 300** — a
lift, not a bold. Setting it to 600 (the obvious guess) made every item with a
bold phrase 5–7px wider, which is how it was caught.

### Sora, and what it costs

The 33 entry dates are Sora — genuinely, not a failed fallback: the reference
loads it from Google Fonts. The wght-only latin variable is 37KB and is
declared in `fonts.css`, which costs nothing on the other pages: a face is only
fetched when a rendered element asks for it.

This settles the open "Changelog nav item" question rather than reopening it.
That item is Sora 16px in the original header, on *every* page — so reproducing
it would pull 37KB onto Home, /features/ and /docs/ for one word. The
normalisation to IBM Plex Sans 18px stands; the cost is now quantified.

### Two entries deliberately normalised

Entries [31] and [32] — v1.1.0 and v1.0.0, the two oldest — were authored with
a different row: 50/50 columns at 768–1024, stacked below that, and their own
widths at 1280+ (301/849 and 308/842 against every other entry's 310.5/839.5).
That is authoring drift from before the pattern settled, and it shows only at
the very bottom of a 17,909px page. **They are normalised to match the other
31.** The cost is the page total below 1280: 47px at 360, −42 at 480, −43 at
768, −22 at 1024. At 1280 and above it is 0.

`diff-changelog.mjs` names them in a `NORMALISED` set, prints their deltas and
does not count them — so the deviation is stated in the code rather than left
in the output as noise to be scrolled past.

### The timeline's scroll behaviour

The original holds every entry at `opacity: 0.3` and lifts whichever ones are
at least 30% on screen, and pins a 500px gradient bar to the viewport once it
has scrolled past. Both are reproduced from the original's own rules, read out
of its inline script: an `IntersectionObserver` at `threshold: 0.3`, and a
latched scroll check (the bar goes fixed when its own top reaches 0 and only
lets go when the first entry's date column is back on screen — latched because
once fixed its top is pinned and the entry condition can never read false
again). Verified against the live site at six scroll positions: the lit set,
the topmost lit entry and the bar's position all match at every one.

**One deliberate difference.** The original's dim is the CSS default, so with
JavaScript off all 33 entries sit at 30% opacity — the body copy (#475467 on
#F9FAFB) lands far below AA and the page is effectively unreadable. Here the
dim only ever arrives from the script: the class is set by a tiny inline
`<script>` before the entries are parsed, so there is no flash, and a reader
without JavaScript gets every entry at full contrast instead of none.
Screenshot-verified: 0 entries below full opacity with JS off.

**Still worth a decision:** 30% opacity is the original's design, and it is
reproduced — but it is a real contrast failure for the 32 entries you are not
currently looking at. Say the word and the resting opacity comes up.

### The card's ground — the sixth time

`diff-changelog.mjs` passed with every box exact while the entry card had no
background at all. The cream `#F9F7EC` and its radius are the whole visual
identity of an entry and **nothing in the geometry depends on them**. Caught by
the crop, again, not the diff.

The diff now reads paint per sampled entry, and it had to be pointed at the
right element on each side: the reference paints the card on a wrapper *inside*
its column — the same size, so every box matched either way — while this build
paints it on the column itself. Comparing the column on both sides compares a
transparent box against a cream one and reports nothing useful.

Running tally of "a passing geometry diff hides paint": testimonial tints,
pricing badge and its three price inks, the features lead's ground and sparkle,
the feature band rule, the newsletter gradient, and now the changelog card.

## Phase 5 — /privacy-policy/ (and Phase 5 closes)

`diff-privacy.mjs` reports **0 failures at 7 viewports, worst 0.1px**, with all
**26 blocks** matching on size, position, rendered type, `id` and text.

### The one page with none of the design system on it

`sections-privacy-policy-1440.json` is an empty array: zero Essential Blocks
sections. The page is a WordPress post title and a block of prose, rendered in
the **twentytwentyfour theme's own type** — which is why its headings are a
serif (Cardo) while every other page is IBM Plex Sans, and why everything on it
is fluid rather than stepped at the site's four breakpoints:

| | value |
|---|---|
| page inset | `min(8vw, 104px)` |
| column | 620px (`--container-narrow`), centred |
| h1 | Cardo `clamp(40.51px, 35.894px + 1.283vw, 52.32px)` / 1.15, weight 400 |
| h3 | Cardo `clamp(22.55px, 19.786px + 0.767vw, 29.6px)` / 1.2, weight 700 |
| body | Inter 16.8/26.04 |
| block rhythm | 1.2rem between every sibling |

Cardo is real, not a failed fallback — the reference loads weights 400 and 700,
and it has no variable cut, so both are shipped (15KB + 19KB). Like Sora on the
changelog, the `@font-face` costs nothing elsewhere: a face is only fetched when
a rendered element asks for it.

**Reproduced rather than normalised.** Restyling this page to IBM Plex Sans
would make the site more consistent than it is, which is a redesign, not a
migration. Flagged here rather than decided: if the intent is that the policy
should look like the rest of the site, that is a one-line change and 34KB back.

### Generated, not transcribed

`scripts/extract-privacy.mjs` pulls the prose out of the capture into
`src/data/privacy.ts`. It is a legal document that has to be reproduced word
for word, and the generator is also what enforces §B1 — it keeps a fixed list
of block and inline tags, drops every attribute except `href` and `id`, and
throws if any `class=`, `wp-`, `eb-` or `is-layout-` survives.

Two details it preserves deliberately:

- **The heading ids are kept verbatim**, including `id="data-collected-by-betterdocs"`
  on a heading that reads "Data Collected By StoreFAQ" — a leftover from the
  policy this one was copied from. It is wrong, and correcting it would break
  any link that already points at it. Left alone; worth a redirect if it is ever
  changed.
- **The redundant `<strong>` inside each heading is dropped.** The original's
  `<h3>` computes to weight 400 and every glyph in it renders at 700 because of
  the inner `<strong>`; here the heading carries the 700. The diff compares the
  element that actually holds the words on each side, so this is verified as
  identical rather than assumed.

### A margin that escaped

First run was exact everywhere and 121.6px out on every single y. The top inset
was a `margin-top` on the title, and with nothing on `<main>` to stop it, it
collapsed straight out and moved `<main>` itself down — which is why the page
total was right and every offset was wrong. It is `padding-top` on the page
now, which is what the original's spacer `<div>` amounts to.

The same shape as the row-height mysteries earlier in this migration: a margin
escaping a block that has no border, padding or BFC to hold it.

---

## Phase 5 is complete

| page | result |
|---|---|
| `/` | 3px at 1280+, 1px at 1440/1920 |
| `/features/` | 0 failures, 1px |
| `/docs/` | 0 failures, 1px |
| `/changelog/` | 0 failures, 1.6px; page total exact at 1280+ |
| `/privacy-policy/` | 0 failures, 0.1px |

Build passes, the §B1 gate passes on all five, JS is 44.3KB gzip.

### Not migrated, and nobody has decided to drop it: Crisp live chat

The live site loads **Crisp** (`client.crisp.chat/l.js`, website id
`57c11e5d-…`) on **every one of the eight captured pages**. This build has no
chat widget at all. That is a functional regression, not a styling one, and it
is not recorded anywhere earlier in these notes — I went looking only because
the widget's green bubble showed up in the privacy-policy crop.

It is deliberately **not** added here: it loads a third-party script on every
page and opens a support channel, which is a decision for the team rather than
something to switch on from a migration task. It is a launch blocker either
way — either it goes back, or someone decides it is gone.

The BetterDocs "Instant Answer" widget is in the same category and is partly
tracked already (the "What are your feelings" feedback question, above). Both
should be settled together, since they are two support surfaces on the same
pages.

### Still open, carried forward

- **The GSAP bundle.** 43.2KB of the 44.3KB total, for fades and rises on
  scroll. The changelog's timeline — an IntersectionObserver and one scroll
  listener, matching the original's behaviour exactly — came to well under 1KB
  and is the argument that the entrance animations do not need a library.
- **Crisp and Instant Answer**, above.
- The changelog's 30% resting opacity (a real contrast failure while JS runs).
- The newsletter form's stacked layout at 360.
- `tokens.css` now carries 54 custom properties against the gate's 40.
- The header ballooning to 325px between 600 and 767 — present in the
  reference, so reproduced, but it looks like a fault in the original.
- A ~4px drift between the newsletter and the footer columns, sitewide, found
  while chasing the /docs/ page total. `diff-footer.mjs` compares boxes and
  column widths but never the vertical rhythm between the two, which is why it
  reports 0 while the gap is real. Small, but it is a measurement blind spot as
  much as a layout one.

## The measurement harness, twice bitten

Two faults surfaced right after Phase 5 closed, both in the harness rather than
the build, and both of the same kind: **a check that cannot run is not a check
that passed.**

### `networkidle` is the wrong readiness signal for this site

`diff-docs.mjs` started dying on a 60s timeout: `https://storefaq.io/docs/` no
longer reaches `networkidle` at all. It runs Crisp live chat and the BetterDocs
Instant Answer widget, and those hold connections open — so "the network went
quiet" never happens, and never will.

Every script now waits for `domcontentloaded` and relies on the settled page
height that was added earlier, which is the signal that actually made these
measurements stable. Images are waited for explicitly, since `networkidle` was
what used to guarantee them and a late image changes where text wraps.

That image wait then hung the whole run with both servers responding fine: a
`loading="lazy"` image that never enters the viewport fires neither `load` nor
`error`, so waiting on it unconditionally waits forever. It is raced against a
5s timeout now.

### The reference is a production site, and the suite was hammering it

Running all thirteen diffs back to back is roughly **100 page loads of
storefaq.io in a few minutes**, and the last few scripts started timing out —
which looks exactly like a regression and is not one. The site answers in ~2s
again the moment the load stops.

`scripts/diff-all.sh` now paces the suite (10s between scripts, one retry after
60s) and — more importantly — **reports a script that produced no summary line
as a failure**, printing its last few lines. The old inline loop printed a blank
line, which is how a timed-out `diff-docs` read as a pass twice in a row.

Use an individual diff while iterating; the suite is for checking the whole
thing, and it is deliberately slow.

## /feature-request/ — a published page nothing had built

Found while starting Phase 8: `wp/v2/pages` lists **six** published pages, and
one of them — `/feature-request/` — was never captured in Phase 1, is not in the
header or footer nav, and was not in the guide's route list. It is a live page
with a working four-field form. Migrating without it would have been a 404 on a
URL that is presumably linked from inside the Shopify app and from support
replies.

It is built now: `diff-feature-request.mjs` reports **0 failures at 7
viewports, worst 0.1px**, page total exact at 768 and 1024 and within 2px
elsewhere.

Because it was not captured, it also was not in `reference/html/`. It is now.

### It shares the privacy page's shell

Both are plain WordPress pages — a post title and a content block, no Essential
Blocks — so `privacy.css` became `plain-pages.css` and `.policy*` became
`.plain*`. The privacy diff was re-run after the rename and is unchanged at
0 failures / 0.1px.

### What the form's geometry actually is

| | |
|---|---|
| block | `alignfull` — escapes the page inset, row back to the 1170 container |
| columns | `calc(100% - 40px)` stacked, `calc(50% - 20px)` from 768, gap 40 |
| form wrapper | `padding: 30px 0` |
| fields | 15px above the first and 15px between |
| label | Inter 15/18 #1D2939, 10px above its control |
| control | 48.8 tall, `padding: 15px 15px 15px 39px`, #F9FAFB on a 1px #98A2B3 rule, 4px radius |
| textarea | the same, but `line-height: 19.2px` — four rows plus 30px padding and 2px border is the 108.8 height |
| submit | full width, #101828, 4px radius, `padding: 15px 30px` |

Three of these took a measurement to find rather than a guess:

- **The stacked column is a full gap narrower than the row**, not the row's
  width — the same quirk the FAQ columns have. It changes where the intro
  wraps, which is why the page was 78px short at 360 until it was right.
- **The textarea's field is 7px taller than label + gap + control.** It is an
  inline-block sitting on the wrapper's baseline, and those 7px are the line
  box's descender space. A `display: flex` wrapper removes them and the whole
  form comes out short — so the wrapper is a block, and the input inside it is
  `display: block` precisely so it does *not* pick the same space up.
- **The submit button renders in the browser's default UI face**, because the
  original never sets a font-family on it. Tailwind's preflight sets
  `font-family: inherit` on form controls, so leaving it alone would have
  rendered Inter. It is `font-family: revert`.

### Two paint differences the geometry could not see — again

The diff passed to 0.1px while the required asterisks were the wrong colour and
one icon was the wrong grey. The crop caught both, as it has every time.

- The `*` on a required label is **#D92D20**, not inherited ink.
- **The envelope glyph alone is #B8C2D2** while the other three are #101828.
  Nothing distinguishes the email field; it is drift in the original. It is
  plainly visible, and reproducing it costs one rule, so it is reproduced.
  Flagged here rather than tidied silently.

`diff-feature-request.mjs` now reads the icon fill and the asterisk colour per
field, so this class of miss is caught on the page where it happened.

The four glyphs are extracted from `@fortawesome/fontawesome-free` 6.4.2 into
`src/data/form-icons.ts` — the package was installed for the extraction and
removed again, so nothing ships but the four paths.

### The form has no backend yet

It posts to `/api/feature-request/`, which forwards to the CMS and, until the
Phase 6 wiring exists, returns a plain "temporarily unavailable" rather than
accepting a submission it would silently drop. Same posture as the newsletter
form and the docs search. The status line is rendered empty at its full height
from the start, as on the original, so a message appearing does not shift the
page.

## Phase 8 — links and redirects

`scripts/wp-inventory.mjs` pulls every URL WordPress serves into
`reference/wp-inventory.json` — **44**: 16 posts, 6 pages, 16 docs, 4
categories, 2 doc categories. `scripts/gen-redirects.mjs` turns that plus the
BetterLinks export into `src/lib/redirects.ts`, and an integration in
`astro.config.mjs` writes it into the built Vercel routing table.

**41 rules**: 16 posts moving under `/blog/`, 19 BetterLinks, 1 empty category,
and 5 platform rules (`/index.php/*`, `/tag/*`, `/author/*`, and 410s for
`/wp-json`, `/wp-admin`, `/wp-includes`, `/xmlrpc.php`).

The generator refuses to emit if a rule would shadow a path this build serves,
if two rules share a `from`, or if WordPress publishes a page this build neither
serves nor redirects. That last check is what surfaced `/feature-request/`.

### The direction is the opposite of the guide's table

Guide §Phase 8 lists `/blog/:slug/ → /:slug/`. That predates the A1 decision
recorded here, which moves posts the other way — `/<slug>/ → /blog/<slug>/`.
The map follows the decision.

### The first version of this map was entirely dead

Astro's own `redirects` looked like the obvious home for the one-to-one rules.
It emitted, for `trailingSlash: 'always'`:

```
{"src":"^/best-shopify-faq-apps$", "headers":{"Location":"/blog/…/"}, "status":301}
```

Slash-less — and **every real old WordPress URL ends in a slash**, so that rule
can never match the URL anybody actually has. Worse, the adapter puts the 308
slash-normaliser *ahead* of it, so the slash-less form gets rewritten to the
slashed one first and then matches nothing either. Both forms 404. All 36
redirects were dead on arrival and nothing in the source said so.

Every rule now goes into the platform table with `/?$`, prepended so it runs
before the normaliser.

**`scripts/assert-redirects.mjs` is the check that caught it**, and it reads the
rules back out of `.vercel/output/config.json` rather than out of the source —
because the source looked completely correct. It replays all 44 WordPress URLs
plus the wildcards, in both slash forms, through a simulation of Vercel's route
phases, and fails on a 404, a chain, or a destination nothing serves. It is
wired into `assert-clean.sh`.

Its own first run reported 47 failures that were not real: it treated Vercel's
`{"src":"/.*","status":404}` catch-all as a match, because it ignored the
`handle` phase boundaries. Only the routes before the first `handle` entry run
ahead of the filesystem.

### Known and accepted

- **`/index.php/<post>/` takes two hops** — one to strip `index.php`, one for
  the post's move. Collapsing it would mean duplicating all 16 post rules with
  an `index.php` prefix, for a URL form WordPress itself already redirected.
  Named in `TWO_HOPS_OK` so it passes deliberately rather than silently.
- **41 of the 68 checked URLs resolve to routes Phase 6 has still to build** —
  the blog, the 16 docs, the categories. The script says so on every run rather
  than reporting a flat green. Re-run when those land.
- `/wp-content/*` is **not** rewritten to the CMS yet. The guide asks for a 200
  rewrite; Phase 7 downloads the media into the repo instead, so the rewrite is
  only a fallback for anything missed, and pointing it at a host that is not up
  would turn a 404 into a 502. Add it once `cms.storefaq.io` exists.

## The `<head>` — the half no pixel diff can see

`scripts/diff-head.mjs` compares every built page's head against the original:
title, every meta, the non-asset links and the JSON-LD types. It reports only
differences that are **not** accounted for, and classifies the rest. It is in
`assert-clean.sh`.

First run: **20 differences on the home page alone**, and the worst of them was
mine.

### I had silently rewritten the SEO copy of every page

Phase 5 pages passed `title` and `description` I had written. The live site's
are authored, and they are what ranks:

| | original | what Phase 5 shipped |
|---|---|---|
| `/` | StoreFAQ: Ultimate Shopify FAQ Builder App | StoreFAQ - Shopify FAQ Builder App |
| `/features/` | StoreFAQ Features: AI-powered FAQ Builder for Shopify | Features - StoreFAQ |
| `/changelog/` | StoreFAQ Changelog | StoreFAQ Changelog: Releases, Fixes and Improvements |

Every description differed too. Launching that would have changed the title and
meta description of the entire site on the same day the URLs moved — two
variables at once, and no diff in the project could see either.

`src/data/seo.ts` is generated from the captures by `scripts/extract-seo.mjs`,
and pages now pass only `route`.

**Three routes keep an override**, because the original's copy there is a
WordPress placeholder rather than authored: `/docs/` is the default "Add new
doc from here"; `/privacy-policy/` and `/feature-request/` are the first 160
characters of the body cut mid-sentence. Each override quotes the string it
replaces in the generated file, so the change is auditable instead of invisible
(§B7).

### What else was missing

- **No JSON-LD at all.** The original carries `WebSite` + `Organization` on the
  home page and a `WebPage` (or `CollectionPage` on /docs/) on each. Reproduced,
  minus the `WebSite`'s `potentialAction`: it advertises `/?s={term}`, a
  WordPress search endpoint this build does not have, and pointing crawlers at
  a 404 is worse than saying nothing.
- **No `og:image` anywhere** — every social share was imageless. The three
  images are mirrored into `public/social/` rather than hotlinked out of
  `/wp-content/`, which §B1 keeps out of the output.
- `og:site_name`, `og:image:width/height/type`, `og:image:alt` — all absent.
  The dimensions are read off the mirrored files with a small PNG/JPEG header
  parse rather than a dependency.
- `meta:keywords` — reproduced. Search engines have ignored it for years, but
  it is the client's authored content, and dropping authored content silently
  is exactly the mistake above.
- **The feed link is per-route.** `/docs/` advertises the site feed *and* its
  own `/docs/feed/`. Emitting one `/feed/` on every page dropped the specific
  one.

### Correctly not reproduced

WordPress plumbing, listed in the script so it is stated once rather than
reported forever: the REST record for the page
(`link:alternate:application/json`), both oEmbed discovery links,
`link:shortlink` (`/?p=91`), and `msapplication-TileImage`.

### Two bugs in the checker itself

Both would have let a real difference through:

1. **A differing value did not count.** Only an *absent* key incremented the
   failure count, so the script printed "1 UNEXPLAINED" for the docs feed and
   then "0 unexplained differences" and exited 0.
2. **Two links of the same type collapsed into one.** The head map was keyed by
   rel+type, so /docs/'s second feed overwrote the first and the difference was
   invisible from both sides. The key carries the link title now.

And the extractor had the matching bug — it took the *first* rss link rather
than all of them.

### A 404 in the structured data

The home page's `WebPage` schema references a different upload from its
`og:image` (`image-1.png`, not `headerLogo.png`), so mirroring only the
og:images left the schema pointing at `/social/image-1.png`, which was not
there. `extract-seo.mjs` now fails if any referenced social file is missing
from `public/social/`.

## Phase 6 (the part that needs no WordPress) — 16 docs articles and 2 category pages

`/docs/<slug>/` × 16 and `/docs-category/<slug>/` × 2 are built from the
content collection and verified against the live site:

| | result |
|---|---|
| `/docs/how-to-install-storefaq/` | 0 failures, 1.1px; page total exact at 1280/1440/1920 |
| `/docs/configure-ai-chatbot-in-storefaq/` (74 blocks) | exact at 1280; two knife-edge wraps elsewhere (below) |
| `/docs/design-faq-page-of-your-shopify-store/` (h4s, 28 blocks) | exact at 1280+ |
| `/docs-category/getting-started/` | 0 failures, 1px |
| `/docs-category/configuration/` (13 entries) | 0 failures, 1.1px |

The article template is the richest page on the site: a sticky, viewport-capped
sidebar with live search and a category tree; a breadcrumb; a numbered
three-level table of contents; the sanitised body; a right-aligned "Updated on"
rule; a feedback widget; a share widget. `diff-doc.mjs` measures every one of
those plus every block of the body, and reads the paint of the parts the crop
kept catching.

### What `.prose` had to learn, block by block

The first doc passed; the second and third did not, and each failure was a
block type the first one did not contain. §B1 says to style `.prose` against
the longest post for exactly this reason.

- **List items carry no margin.** `.prose p, .prose li { margin: 16px 0 }` made
  a nine-line list 48px taller than nine lines.
- **A flex group of two screenshots side by side is layout, and the guide's
  sanitiser unwrapped it** — stacking them and adding 800px to the page. The
  sanitiser now keeps `wp-block-group.is-layout-flex` as `<div class="row">`;
  each figure's flex basis is its image's intrinsic width and both shrink to
  share the column 19.2px apart.
- **Images render at their `width` attribute, capped at the column.** An 880px
  screenshot in a 972px column stays 880px; `width: 100%` stretched it.
- **h4 is fluid** like the theme's other headings: `clamp(17.9px, 15.1456px +
  0.767vw, 24px)`, the same slope as h3.
- **Headings are weight 400 with a `<strong>` inside.** Setting 700 on the
  heading rendered 900. The sanitiser keeps the `<strong>`; the heading stays
  400.
- **Links are `#0000EE` and underlined** — the UA defaults, because the
  original never styles a link in a doc body. Tailwind's preflight strips the
  underline; it is put back.
- **The table of contents lists h4s** as a third level, numbered by CSS
  counter (`1.`, `1.1.`, `1.1.1.`), which is also what pushes most entries onto
  two lines.

### The sidebar's states

Hidden below 1280 on an article, but on a category page the original *reserves
its column from 768* and only shows the sidebar from 1024 — a blank third of
the row to the left of the content at tablet. Reproduced as found. Below 1280
it is packed tighter (search 16 below, list 6 above, 12 between categories,
against 24/10/16 above). From 1280 it is `position: sticky; top: 36px;
max-height: calc(100vh - 45px); overflow-y: auto` — a 13-entry category scrolls
inside the sidebar rather than pushing the page.

The category tree is `<details>`; this Chromium still lays out a closed
`<details>`' children with real boxes, so they are also hidden explicitly.
Same for the contents list, which is collapsed to its title on a phone by
removing `open` from an inline script before first paint — open by default so
it is readable without JavaScript.

### Paint the geometry could not see, on this page

Six things, all from crops: the breadcrumb uses a 4x12 **slash** and clips its
current title to 100px with an ellipsis; breadcrumb links carry 0.49px of
letter-spacing (the only letter-spacing on the site) and are `#566E8B`
between 768 and 1279 but `#7D7E9D` on either side of that band; the open
category has a 1px `#D0D5DD` rule down it with the active entry's 4px
`#548B2F` bar over it; "Updated on" is right-aligned; the contents list has a
1px `#E8ECF4` rule down its left. The diff reads all of these now.

### Knife-edge wraps, and an Inter experiment that regressed three pages

Two paragraphs — one at 1024, one at 1440 — sit within a pixel of their column
width and break onto a different number of lines on each side. Same text, same
family, same size. Swapping my Inter for the Google Fonts v20 latin file the
reference declares moved *which* paragraphs did it and fixed the 1440 case —
and regressed testimonials, the features page and privacy (1→23, 1→49,
0.1→235px). So the reference does not render with the file it declares either,
or not that cut of it. Reverted. The original Inter matched ten pages to the
pixel; two knife-edge lines on two long docs are the ceiling of what can be
measured against a live site whose own 360px total swung 137px between runs
(a lazy image slipping the 5s cap).

### Phase 7 for the docs, and the gate that had a hole in it

The doc bodies referenced **94 screenshots hotlinked from `/wp-content/uploads/`**,
and `assert-clean.sh` passed — it grepped class names, not URLs.
`scripts/download-media.mjs` mirrors every upload the content references into
`public/media/<year>/<month>/`, rewrites the sources, and writes
`media/report.txt` (14 under 1600px, all of them the original's own downscales,
so nothing is served at lower resolution than before — the Phase 7 gate). The
social images moved there too; `public/social/` is gone. The gate now fails on
any `src`, `href`, `content` or `srcset` that mentions `wp-content`,
`wp-json`, `wp-includes` or the CMS host.

The docs index's category counts and "Last Updated" dates are derived from the
collection now, so the cards cannot drift from the articles they front.

`/api/doc-feedback/` is the same posture as the other forms — a clear
"temporarily unavailable" until the CMS exists — and the question of whether
the BetterDocs reaction data is worth keeping is still open (§B5).

### Changelog: the pinned bar was jumping to the window's edge — reported and fixed

Reported from the browser: once the timeline scrolls, the green bar should stay
at the top. It did go `position: fixed` at the right moment — and then
appeared at x=4 of the *viewport* instead of x=59 in the date column, because
the rule set `left: 4px`. While absolute that resolves against the wrapper;
the instant the bar is fixed it resolves against the window. The original
never sets `left` at all: `margin-left: 4px` with `left: auto`, so the fixed
bar keeps its static horizontal position — the column it started in.
Reproduced the same way. Verified at 1440/1280/768/360: x and top now match
the live site in both states.

`probe-cl-scroll.mjs` had passed six scroll positions on this bug because it
compared `position` and not where the bar *was*. It compares x and top now.

## Phase 6 — the blog, on demand from WordPress

`/blog/`, `/blog/page/N/`, `/blog/<slug>/` (16), `/category/<slug>/` (3, with
`/page/N/`), `/blog/search/?s=`, `/feed/`, `/docs/feed/`, `/sitemap-blog.xml`,
and a `/404`. All of it against the **public** REST API on the live site —
`WP_URL` defaults to `https://storefaq.io` because that is where the content
is; the day `cms.storefaq.io` exists it is one environment variable.

Measured against `/blog/` and `/best-shopify-faq-apps/` at 360/768/1024/1280/
1440/1920 by `diff-blog.mjs` and `diff-post.mjs`: **0 failures each**. The
post diff normalises two deliberate differences (below) so that everything
else is held to 2px.

### Rendering, caching, publishing (§B6, rewritten for Vercel)

The blog routes are `prerender = false` and Vercel ISR holds them — a day's
expiry as the safety net, and `VERCEL_BYPASS_TOKEN` for the mu-plugin's purge
on publish. Three things the adapter does that would have shipped broken:

1. **ISR keys on the path and drops the query string.** A search on
   `/blog/?s=…` would have been answered with the cached index, silently. The
   search is its own route, `/blog/search/`, excluded from ISR and cached at
   the edge by full URL for five minutes; `/blog/?s=` bounces to it.
2. **The non-ISR on-demand routes are emitted slash-less** (`^/api/subscribe$`)
   under a `trailingSlash: 'always'` config whose own rule 308s every request
   to the slashed form first. The slashed request matched nothing and fell to
   the 404 catch-all — every API endpoint dead on deploy, since Phase 5, and
   the build said nothing. The same defect as the redirect map in Phase 8,
   and the same fix: the platform-routes integration rewrites those patterns
   to accept the slash either way.
3. `exclude` takes regexes, not globs — `'/api/*'` became `^/api/\*$`.

`assert-redirects.mjs` now also walks ten on-demand paths through the
post-filesystem rules and requires each to land on a function — the search
and the API routes on the plain function, never ISR. It is the check that
found (2) and (3).

### Media without a mirror

A post published tomorrow has images nothing mirrored at build time. They are
served through **`/media/`** — the same URL space the mirrored docs images
already live in: what is on disk is served from disk (Vercel's filesystem
phase), and a rewrite after it proxies anything missing from
`${WP_URL}/wp-content/uploads/`. The dev server does the same with a Vite
proxy that bypasses for files in `public/`. So the output never contains a
WordPress URL, in either mode, and the gate now checks the **rendered** blog
pages (index, page 2, a category, a search, the longest post, the feed)
through the dev server as well as `dist/` — §B1's "not just `dist/`".

Old root-level post links inside bodies are pointed straight at `/blog/…/`
at render time (from the redirect map), so no reader pays the 301.

### What the page is made of — facts the diff had to be taught

- The listing's hero card has **no bottom padding side by side**: the 72px
  under the heading column is the card's bottom and the image column sits on
  it (bottom-aligned — 33px down at 1440, 86 at 1280; both the remainder of
  the heading column). Below 1280 the card is `40px 20px` all round and the
  columns stack. A soft green blur (`hero-bg-ovrly.png`) sits in the card's
  bottom-left corner over the gradient, on both heroes — hotlinked on the post
  hero from a **Templately demo host**, as are the two 18px meta icons.
  Mirrored.
- The post's columns are halves until 1280 and 66/34 after, with **12px of
  air inside each until 1280 and 48 after**, and a **1px `#EAECF0` rule down
  the main column's right edge** — inside its width, which is why the body
  measured one pixel narrower than the column's padding could explain and
  every paragraph under the first wrapped differently until it was found.
- The date is 16px until 1280 and 18px after; the category beside it is
  18px throughout. Below 768 each stacks its icon *centred* over left-aligned
  text — ugly, and the original's. Reproduced.
- Sidebar titles are cut to their **first seven words with no ellipsis**
  ("Shopify FAQ Builder App: Why Do You"); the full title is on the link's
  `title` and the page it goes to. The three-tab row draws a full-width rule
  as a pseudo-element with the active tab's darker rule over it. "Share this
  Story" is `text-transform: capitalize`. Share tiles carry 10px of margin
  only from 1280.
- The comparison table's cells are `word-break: break-word` — without it a
  six-column table at 360 is 440px shorter than the original, and the
  difference reads as a wrap bug rather than a missing rule. Applied to every
  `.prose` table.
- The pager shows `< 1 2 ... >` for two pages — the "..." tile is
  unconditional on the original. Reproduced as the tile it is.

### Deliberate differences (three), and two content bugs

1. **"Post Views: 659" is dropped.** Post Views Counter appends it to every
   body; a number only WordPress can count is not content. The sanitiser
   drops `.post-views`, and the post diff subtracts its height from the
   original's boxes below the body (the 44px the page totals differ by).
2. **The contents list is built from the article's actual headings.** The
   original's block stores a *snapshot* of the headings from when the post
   was last edited, and on the sample post lists two of five h3s and three of
   five h2s. The diff compares the first two entries' geometry and the card
   by width only.
3. **The "Visit & Follow Us In" row shows two networks, not six.** Four of the
   original's six link to `#`. The two with destinations are the footer's
   two.
- The feed keeps WordPress's `?p=ID` as each item's `<guid>` — an opaque id,
  not a link; changing it would make every subscribed reader re-deliver the
  last ten posts as new. The gate exempts `<guid>` and nothing else.
- The "Popular" tab is ranked by Post Views Counter's public endpoint, one
  request per post (it sums when given a list). It falls back to recency if
  the plugin goes.

### Still blocked on the mu-plugin

Per-post **title and description** are ThinkRank overrides that the public
API does not expose (`_thinkrank_*` meta is present but the resolved
title/description are not). Until `storefaq-headless.php` is deployed the
post `<title>` is `<title> | storefaq.io` (the site's own pattern) and the
description is the excerpt; the sample post's live description ("Looking for
the best Shopify FAQ apps? …") is therefore not reproduced yet. The `seo`
field is read the moment it appears.

### Also in this batch

- A YouTube embed in a doc rendered at 300x150: the sanitiser had stripped
  `wp-embed-aspect-16-9` and left `is-type-video is-provider-youtube` behind —
  two more class prefixes the gate did not know. Embeds keep their ratio under
  a class of this build's own; `is-type-` and `is-provider-` are in both
  KILL_CLASS and the gate. Two docs affected; the docs refetched and
  re-mirrored.
- `/404` is the theme's own — Cardo "Page Not Found", its sentence, a search
  box (which now searches the blog) — served with HTTP 404 by Vercel for any
  unmatched path and by the on-demand routes for an unknown post or category.
- `sitemap-index.xml` lists the static sitemap and `/sitemap-blog.xml`;
  `robots.txt` points at the index.
- While re-checking the docs: `configure-instant-answer-with-storefaq` at 1440
  has one paragraph that wraps to four lines on the original and three here —
  the same knife-edge as the two long docs noted before. And the live docs
  sidebar sometimes reads with a category collapsed at 1920; it is the
  original's script, not a regression.

**Decisions still open** (unchanged): Crisp, Instant Answer, GSAP vs IO,
changelog resting opacity, the six empty alts, BetterDocs reaction data —
plus, new: whether the two `#` social links should instead get real
destinations (X, YouTube, Instagram, Pinterest exist for Storeware?).

### The media mirror was never in the repo — found and fixed

`.gitignore` had `media/` for the Phase 7 report directory; an unanchored
pattern matches at any depth, so `public/media/` — the 99 mirrored uploads
and the social images — had been untracked since Phase 7 while every check
passed against the working copy. Anchored to `/media/`; the mirror (50MB) is
committed. A fresh clone or a Vercel build now has every image the static
pages reference, rather than depending on the `/media/` proxy for all of them.

### Focus rings off, sidebar sticky — reported and done (2026-09-14)

Two focus rings removed at the client's request: the footer newsletter field
(a 2px dark outline of this build's own — the original shows none) and the
blog search field (the browser's default ring). Both fields now show nothing
on focus, as the original does. Worth knowing: a keyboard user tabbing
through the page gets no indication of which field is active on these two;
the docs search already behaved this way.

The post sidebar is taller than a screen, so it sticks by its bottom: it
scrolls with the article until its last card reaches the bottom of the
viewport, holds there while the article carries on, and leaves with the end
of the row. `position: sticky; bottom: 0` on a column aligned to the row's
end — at the top of the page that resolves to the row's top, so nothing
measured moves.

### Header dropdown: hover colour and smoothness — reported and fixed (2026-09-14)

Measured the original's open panel for the first time in three states. Two
things this build had invented: a **dark-green ground under a hovered item**
(the original changes nothing on hover — white on green stays white on
green), and items 41px tall on a 24.8px line where the original's are 35px
on a 19.2px line, which made the panel 51px instead of 45. Both corrected;
the panel now measures 127x45 at 886,66 with a 122x35 item, exactly the
original's. The one deliberate deviation: the original snaps in with a
0.1s linear fade and was reported as not smooth, so this one eases in over
0.16s with a 4px rise (and no rise under `prefers-reduced-motion`). The
panel also opens on keyboard focus now, which the original's does not.

### Changelog: the white band above the newsletter — reported and changed (2026-09-14)

The newsletter section paints its upper half white so the card straddles
the boundary into the footer. On every page but the changelog the section
above is white too, so the join is invisible; the changelog's timeline sits
on slate (#F9FAFB), so a 60px white band appeared between them. **The
original has the same band** — measured, it is the same gradient on the
same element — but it reads as a mistake, and the client asked for it to go.
The upper half now takes `--newsletter-above`, white by default and slate
when the section follows the timeline. Known difference from the original,
by request.

### Blog speed, and an active colour in the header (2026-09-14)

**The blog was slow.** WordPress answers a REST call in one to three seconds
and a post page needs four of them plus one per post for the view counts —
5.5s a page in development, every reload. In production ISR holds the
finished page, so only the first visitor after a purge pays; but the first
visitor should not pay 5s either. `wp.ts` now has a per-process cache with
stale-while-revalidate (lists 60s, terms and view counts 10 minutes, stale
served for up to 30 minutes while it refreshes behind), and identical
concurrent calls share one request. Second hit on any blog page: ~10ms.
The trade: in development a post edited in WordPress can take up to a
minute to show; in production the purge-on-publish bypasses ISR but this
cache still answers from memory for up to 60s on a warm instance.

**The header now marks the current section** in the brand green (the hover
colour): a post or category lights "Blog", a doc or docs category lights
"Documentation", the changelog lights "Support" and underlines "Changelog"
inside the panel; cream in the phone overlay. The original marks nothing —
this was deferred from Phase 5 and is added at the client's request. The
chrome diff does not read `aria-current`, so it still measures 0px.

### Deploy: the first row of /blog/ came up broken — found and fixed (2026-09-14)

First Vercel deploy (storefaq.vercel.app): the three eager featured images on
/blog/ showed as broken while the lazy ones below loaded. The URLs were
answering 200 with image bodies by the time they were checked, so it was not
the rewrite itself. What it was: nothing had mirrored the BLOG's images (the
docs' were mirrored in Phase 7; the blog is on demand), so every one went
through the `/media/` proxy to WordPress — which rate-limits under a burst,
as every diff script here has found — and the proxy route forced
`cache-control: … immutable` onto whatever came back, including a failure.
A one-off refusal, cached for a year in the browser that saw it.

Two changes. `scripts/mirror-blog-media.mjs` (`npm run media:blog`) pulls
every post's featured image and every upload its body references into
`public/media/` — 487 files, 145MB, committed — so the proxy is reached only
by a post newer than the last run. And the proxy route sets no cache header
of its own: a served image already carries the origin's year-long
`immutable`; a failed one now carries nothing and is retried. Anyone who saw
the broken row needs a hard reload once, since the failure is in their
browser's cache, not the edge's.

## Effects layer — approved and shipped (2026-09-14)

At the client's request, motion beyond the original's: `src/styles/effects.css`
and `src/components/Effects.astro`, gated on `html.fx` (set with `js-anim`
only when motion is welcome; every rule and script is off under
`prefers-reduced-motion`). Everything animates transform, opacity, filter,
clip-path, box-shadow or background — never a layout property — so the
measured geometry is unchanged at rest; the only thing the diffs now read
differently is a title's glyph range, 3px taller from the word wrappers'
descender padding, at the same position.

What it does: two colour fields drift behind the home hero; every heading
reveals word by word (`Words.astro` / `splitWords`; page titles on load,
section headings when they scroll into view); scroll reveals de-blur;
the header sticks and frosts once scrolled, with a drawn underline on nav
links and a cascading dropdown; buttons are magnetic with a hover sweep;
cards lift with a pointer-following spotlight and a zooming image; testimonial
stars pop; free-standing images parallax slightly; posts and docs get a
reading-progress bar, a contents list that follows the reader, and smooth
in-page anchors; changelog entries drift in and the lit dot breathes; the
newsletter card carries a slow sheen. Reviewed and adjusted: the home hero
image keeps only its original entrance (no tilt, float, shadow or unmask),
and the footer's hover underline fits the words rather than the column.

### CTA band: the screenshot's 8px radius — reported and fixed (2026-09-14)

The original clips the app-store screenshot in the CTA band to an 8px radius
(a wrapper with `overflow: hidden`); this build had it square. The only
rounded image block on the home and features pages, so the one place it was
missed. Crop-verified against the live site.
