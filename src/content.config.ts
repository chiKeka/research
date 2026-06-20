import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { sanitizeUrl } from '../scripts/lib/prep-transforms.mjs';

const writing = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/writing' }),
  schema: z.object({
    title: z.string(),
    date: z.string(),
    platform: z.string().optional(),
    // Sanitized at load: a malformed value (e.g. a URL with a trailing note)
    // becomes undefined rather than rendering a broken "read the original" link.
    external_url: z
      .string()
      .optional()
      .transform((v) => sanitizeUrl(v) ?? undefined),
    summary: z.string().optional(),
    updated: z.string().optional(),
    sources: z
      .array(
        z.object({
          label: z.string(),
          // http(s) only — rejects javascript:/data: hrefs.
          href: z.string().refine((v) => !!sanitizeUrl(v), 'href must be a valid http(s) URL'),
        }),
      )
      .optional(),
    published: z.boolean().default(true),
  }),
});

export const collections = { writing };
