/**
 * /docs/ — the two BetterDocs category cards.
 *
 * `count` and `updated` are derived from the docs collection, so the cards
 * cannot drift from the articles they front. Title, slug and icon come from
 * docs-taxonomy.json (scripts/fetch-docs.mjs), in the original's order.
 */
import type { ImageMetadata } from 'astro';
import { getCollection } from 'astro:content';
import taxonomy from './docs-taxonomy.json';
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

const ICONS: Record<string, ImageMetadata> = { 'getting-started': rocket, configuration: settings };
const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

export async function getDocsCategories(): Promise<DocsCategory[]> {
  const docs = await getCollection('docs');
  return taxonomy.map((c) => {
    const mine = docs.filter((d) => d.data.category === c.slug);
    const newest = mine.map((d) => d.data.updated).sort().at(-1) ?? '';
    return { title: c.name, slug: c.slug, icon: ICONS[c.slug], count: mine.length, updated: fmt(newest) };
  });
}
