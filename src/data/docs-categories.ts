/**
 * /docs/ — the two BetterDocs category cards.
 *
 * `count` and `updated` are BetterDocs-derived on the original. They are
 * literals here so the Phase 5 shell renders the measured page exactly; once
 * the 16 articles land as a content collection (Phase A decision: MDX in
 * repo) both become derived — the count from the collection, the date from
 * the newest article's `updated` — and this file keeps only icon + title.
 */
import type { ImageMetadata } from 'astro';
import rocket from '../assets/docs/tabler-icon-rocket.png';
import settings from '../assets/docs/tabler-icon-settings.png';

export interface DocsCategory {
  title: string;
  /** Slug for routes.docCategory() — note "Configurations" lives at /configuration/. */
  slug: string;
  icon: ImageMetadata;
  count: number;
  updated: string;
}

export const docsCategories: DocsCategory[] = [
  { title: 'Getting Started', slug: 'getting-started', icon: rocket,   count: 3,  updated: 'October 8, 2025' },
  { title: 'Configurations',  slug: 'configuration',   icon: settings, count: 13, updated: 'August 27, 2026' },
];
