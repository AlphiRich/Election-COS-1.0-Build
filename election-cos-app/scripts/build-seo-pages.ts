/**
 * Election Campaign OS — public site: one real HTML page per URL, a sitemap, robots.txt and a 404.
 * Runs inside `npm run build:site`, after the vite build and before `finish-site-build.mjs`. Why, and what each file is
 * for: src/site/seo.ts. Writes into dist-site/:
 *   index.html                      the home page, with its own canonical and metadata
 *   <path>/index.html               every other page (static, explainers, all 213 councils)
 *   404.html                        served with a real 404 for any other address (nginx error_page)
 *   poll-shell.html                 the app shell for /poll/<id>, which is issued per person and not searchable
 *   sitemap.xml, robots.txt
 * Fails loudly instead of skipping: a page that cannot be written, or a route that would overwrite a real file, stops the build.
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  NOT_FOUND_FILE,
  POLL_SHELL_FILE,
  ROBOTS_TXT,
  allPages,
  canonicalUrl,
  renderPage,
  renderSitemap,
} from '../src/site/seo';

const OUT = 'dist-site';
const shellPath = path.join(OUT, 'index.html');
if (!existsSync(shellPath)) {
  console.error('dist-site/index.html is missing: the vite build did not run');
  process.exit(2);
}
const shell = readFileSync(shellPath, 'utf8');
const pages = allPages();

const seen = new Set<string>();
for (const p of pages) {
  if (seen.has(p.path)) throw new Error(`seo.ts lists ${p.path} twice`);
  seen.add(p.path);
}

for (const p of pages) {
  const html = renderPage(shell, { title: p.title, description: p.description, canonical: p.indexable ? canonicalUrl(p.path) : undefined, noindex: !p.indexable });
  if (p.path === '/') {
    writeFileSync(shellPath, html);
    continue;
  }
  const dir = path.join(OUT, p.path);
  if (existsSync(dir) && !statSync(dir).isDirectory()) throw new Error(`${dir} is a file; ${p.path} would overwrite it`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'index.html'), html);
}

// The 404 and the poll shell must not be indexed, and must not carry the home page's metadata.
const plain = (title: string, description: string) => renderPage(shell, { title, description, noindex: true });
writeFileSync(path.join(OUT, NOT_FOUND_FILE), plain('Page not found | Election Campaign OS', 'That page is not here.'));
writeFileSync(path.join(OUT, POLL_SHELL_FILE), plain('Poll | Election Campaign OS', 'A short poll. Your answer is counted, not linked to you.'));
writeFileSync(path.join(OUT, 'sitemap.xml'), renderSitemap(pages));
writeFileSync(path.join(OUT, 'robots.txt'), ROBOTS_TXT);

console.log(`SEO: ${pages.length} pages (${pages.filter((p) => p.indexable).length} in the sitemap), 404.html, poll-shell.html, sitemap.xml, robots.txt`);
