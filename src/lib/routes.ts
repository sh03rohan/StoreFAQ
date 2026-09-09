/**
 * Guide §B2 — the ONLY place internal URLs are defined.
 * No internal URL may be written as a literal string in a component.
 *
 * Note: posts live under /blog/<slug>/ (A1 decision: restructure).
 * The old root-level URLs 301 here; see scripts/gen-redirects.mjs.
 */
export const routes = {
  home:        () => '/',
  features:    () => '/features/',
  docs:        () => '/docs/',
  doc:         (slug: string) => `/docs/${slug}/`,
  docCategory: (slug: string) => `/docs-category/${slug}/`,
  blog:        () => '/blog/',
  blogPage:    (n: number) => (n <= 1 ? '/blog/' : `/blog/page/${n}/`),
  post:        (slug: string) => `/blog/${slug}/`,
  category:    (slug: string) => `/category/${slug}/`,
  changelog:   () => '/changelog/',
  privacy:     () => '/privacy-policy/',
  feed:        () => '/feed/',
} as const;

/** Where a post used to live, for the generated 301 map. */
export const legacyPost = (slug: string) => `/${slug}/`;

export const external = {
  shopifyApp: 'https://apps.shopify.com/storefaq',
  /* The captured href carried a per-visit `search_id` tracking token; the
   * bare reviews URL resolves to the same page. */
  shopifyReviews: 'https://apps.shopify.com/storefaq/reviews',
  support:    'https://storeware.io/support/',
} as const;

/**
 * Cloaked links (BetterLinks). Exported live from
 * /wp-json/betterlinks/v1/links — see reference/betterlinks-map.json.
 * Referenced by name so a campaign URL is never pasted into a component.
 */
export const go = {
  getStarted:    () => '/go/get-started',
  scheduleACall: () => '/Schedule-a-Call-Now',
  sampleFaqCsv:  () => '/download/sample-faq',
} as const;
