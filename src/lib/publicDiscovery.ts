import { site } from '../data/site.ts';
export const publicOrigin = `https://${site.primaryDomain}`;
/** Only factual marketing entrypoints approved for this launch appear in the sitemap. */
export const publicMarketingPaths = ['/', '/about/', '/approach/', '/services/', '/contact/'] as const;
export function publicMetadata(pathname: string, search: string, title: string, description: string) {
  const normalized = pathname === '/' ? '/' : `${pathname.replace(/\/+$/, '')}/`;
  const canonical = new URL(normalized, publicOrigin);
  if (canonical.origin !== publicOrigin) throw new Error('Canonical must use the approved primary domain.');
  canonical.search = ''; canonical.hash = '';
  const indexable = (publicMarketingPaths as readonly string[]).includes(normalized) && !new URLSearchParams(search).has('mode');
  const robots = indexable ? 'index,follow' : 'noindex,follow';
  const graph = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'Organization', '@id': `${publicOrigin}/#organization`, name: site.name, url: `${publicOrigin}/` },
    { '@type': 'WebSite', '@id': `${publicOrigin}/#website`, name: site.name, url: `${publicOrigin}/`, publisher: { '@id': `${publicOrigin}/#organization` }, inLanguage: 'en' },
    { '@type': 'WebPage', '@id': `${canonical.href}#webpage`, url: canonical.href, name: title, description, isPartOf: { '@id': `${publicOrigin}/#website` } },
  ] };
  return { canonical: canonical.href, robots, structuredData: indexable ? JSON.stringify(graph).replace(/</g, '\\u003c') : null };
}
export const publicRobots = `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /auth/\n\nSitemap: ${publicOrigin}/sitemap.xml\n`;
export const publicSitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${publicMarketingPaths.map(path => `  <url><loc>${publicOrigin}${path}</loc></url>`).join('\n')}\n</urlset>\n`;