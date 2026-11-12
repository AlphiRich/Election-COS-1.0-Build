import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { COUNCIL_PATH, DETAILS_PATH, SEATS_PATH, COALITION_PATH } from './pages/SiteVoterTools';
import { COUNCIL_ROUTE, MY_WARD_PATH, TRACKER_PATH } from './resultsPaths';
import {
  CANONICAL_ORIGIN,
  PARAM_ROUTES,
  ROBOTS_TXT,
  STATIC_PAGES,
  allPages,
  canonicalUrl,
  councilPages,
  explainerPages,
  renderPage,
  renderSitemap,
} from './seo';

const root = path.resolve(__dirname, '../..');
const app = readFileSync(path.join(root, 'src/site/SiteApp.tsx'), 'utf8');

/** Every `path=` in SiteApp, resolving the named constants it uses. A constant this test does not know fails it. */
function routePaths(): string[] {
  const known: Record<string, string> = { COUNCIL_PATH, DETAILS_PATH, SEATS_PATH, COALITION_PATH, TRACKER_PATH, MY_WARD_PATH, COUNCIL_ROUTE };
  const out: string[] = [];
  for (const m of app.matchAll(/path=(?:"([^"]+)"|\{([A-Z_]+)\})/g)) {
    if (m[1]) out.push(m[1]);
    else {
      expect(known, `SiteApp uses path={${m[2]}}, which seo.test.ts does not know`).toHaveProperty(m[2]);
      out.push(known[m[2]]);
    }
  }
  return out.filter((p) => p !== '*');
}

describe('every route the site serves is accounted for', () => {
  const routes = routePaths();
  it('finds the routes (so the checks below are not vacuous)', () => {
    expect(routes.length).toBeGreaterThan(30);
  });
  it('each fixed route has page metadata, and each parameter route is generated from data', () => {
    const fixed = new Set(STATIC_PAGES.map((p) => p.path));
    for (const r of routes) {
      if (r.includes(':')) expect(PARAM_ROUTES as readonly string[], r).toContain(r);
      else expect(fixed.has(r), `${r} is a route in SiteApp but has no entry in seo.ts STATIC_PAGES`).toBe(true);
    }
  });
  it('and nothing is listed that the app does not serve', () => {
    const served = new Set(routes);
    for (const p of STATIC_PAGES) expect(served.has(p.path), `${p.path} is in seo.ts but is not a route`).toBe(true);
  });
});

describe('page metadata', () => {
  const pages = allPages();
  it('covers all 213 councils and every explainer', () => {
    expect(councilPages()).toHaveLength(213);
    expect(explainerPages().length).toBeGreaterThanOrEqual(3);
  });
  it('gives every page its own title and description, within search-result length', () => {
    const titles = pages.map((p) => p.title);
    expect(new Set(titles).size).toBe(titles.length);
    const descs = pages.filter((p) => !p.path.startsWith('/legal/')).map((p) => p.description);
    expect(new Set(descs).size).toBe(descs.length);
    for (const p of pages) {
      expect(p.description.length, `${p.path} description`).toBeGreaterThan(20);
      expect(p.description.length, `${p.path} description too long for a result`).toBeLessThanOrEqual(260);
      expect(p.title.length, `${p.path} title`).toBeLessThanOrEqual(110);
    }
  });
  it('has no duplicate paths', () => {
    expect(new Set(pages.map((p) => p.path)).size).toBe(pages.length);
  });
});

describe('sitemap, robots and canonical', () => {
  const pages = allPages();
  const xml = renderSitemap(pages);
  it('is real XML naming only indexable pages, by their canonical address', () => {
    expect(xml.startsWith('<?xml')).toBe(true);
    expect(xml).toContain(`<loc>${CANONICAL_ORIGIN}/</loc>`);
    expect(xml).toContain(`<loc>${CANONICAL_ORIGIN}/councils/BUF</loc>`);
    expect(xml).not.toContain('/sign-in');
    expect(xml).not.toContain('/poll');
    expect((xml.match(/<loc>/g) ?? []).length).toBe(pages.filter((p) => p.indexable).length);
  });
  it('robots.txt points at the sitemap on the canonical host and blocks nothing', () => {
    expect(ROBOTS_TXT).toContain(`Sitemap: ${CANONICAL_ORIGIN}/sitemap.xml`);
    expect(ROBOTS_TXT).not.toMatch(/Disallow:\s*\//);
  });
  it('every canonical is https on one host, with no trailing slash except the home page', () => {
    for (const p of pages) {
      const u = canonicalUrl(p.path);
      expect(u.startsWith(`${CANONICAL_ORIGIN}/`)).toBe(true);
      if (p.path !== '/') expect(u.endsWith('/')).toBe(false);
    }
  });
});

describe('renderPage', () => {
  const shell = '<html><head><title>Shared</title><meta name="description" content="shared" /></head><body></body></html>';
  it('replaces the shared title and description and adds a canonical', () => {
    const h = renderPage(shell, { title: 'A & B', description: 'He said "hi"', canonical: 'https://x.test/a' });
    expect(h).toContain('<title>A &amp; B</title>');
    expect(h).toContain('content="He said &quot;hi&quot;"');
    expect(h).toContain('<link rel="canonical" href="https://x.test/a" />');
    expect(h).not.toContain('Shared');
    expect(h).not.toContain('noindex');
  });
  it('marks a page noindex and gives it no canonical', () => {
    const h = renderPage(shell, { title: 'T', description: 'D', noindex: true });
    expect(h).toContain('<meta name="robots" content="noindex" />');
    expect(h).not.toContain('rel="canonical"');
  });
  it('throws rather than leave the shared title when the shell has none', () => {
    expect(() => renderPage('<html><head></head></html>', { title: 'T', description: 'D' })).toThrow(/no <title>/);
  });
});
