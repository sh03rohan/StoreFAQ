import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * The 16 docs, frozen into the repo by scripts/fetch-docs.mjs (A1 decision:
 * MDX in repo, no WordPress runtime dependency). Bodies are already through
 * the §B1 sanitiser; the page renders them with set:html.
 */
const docs = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/docs' }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    category: z.string(),
    categoryName: z.string(),
    order: z.number().default(0),
    published: z.string(),
    updated: z.string(),
    excerpt: z.string().default(''),
  }),
});

export const collections = { docs };
