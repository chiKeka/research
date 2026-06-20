import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const writing = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/writing' }),
  schema: z.object({
    title: z.string(),
    date: z.string(),
    platform: z.string().optional(),
    external_url: z.string().optional(),
    summary: z.string().optional(),
    published: z.boolean().default(true),
  }),
});

export const collections = { writing };
