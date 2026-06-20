import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  // Canonical origin. Drives <link rel="canonical">, the sitemap, and RSS.
  // Currently the live Vercel host; repoint to a custom domain once DNS is attached.
  site: 'https://research-azure-omega.vercel.app',
  // Match the no-trailing-slash canonical URLs (and vercel.json cleanUrls) so the
  // sitemap and <link rel="canonical"> agree on every route.
  trailingSlash: 'never',
  integrations: [sitemap()],
  // Output a fully static site (Vercel/Netlify/GitHub Pages friendly).
});
