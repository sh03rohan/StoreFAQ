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
