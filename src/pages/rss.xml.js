import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
  const posts = (await getCollection('writing'))
    .filter((p) => p.data.published !== false)
    .sort((a, b) => (b.data.date || '').localeCompare(a.data.date || ''));

  return rss({
    title: 'Bruno Chikeka — Writing',
    description:
      'Essays and posts on AI infrastructure, agentic systems, governance, and public epistemics.',
    site: context.site,
    items: posts.map((p) => ({
      title: p.data.title,
      pubDate: p.data.date ? new Date(p.data.date) : undefined,
      description: p.data.summary,
      link: `/writing/${p.id}`,
    })),
  });
}
