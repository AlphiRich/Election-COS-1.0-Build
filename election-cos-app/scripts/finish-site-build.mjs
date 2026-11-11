#!/usr/bin/env node
/**
 * Last step of `npm run build:site`:
 *
 *  - copy the response headers and the explainer videos into dist-site;
 *  - remove the application's service worker and manifest (the shared public/ folder copies them in; the public site
 *    must not carry them);
 *  - add the public site's own manifest and service worker (site-assets/pwa), which make electioncos.co.za
 *    installable and readable offline. The worker's precache list is generated here from the files the build
 *    produced, so it can never name a file that does not exist.
 *
 * Node, not `cp` and `rm`, so the build runs the same on Windows, macOS and Linux.
 */
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const OUT = 'dist-site';
if (!existsSync(OUT)) {
  console.error('dist-site missing: the vite build did not run');
  process.exit(2);
}
cpSync('site-hosting/_headers', `${OUT}/_headers`);
cpSync('site-assets/videos', `${OUT}/videos`, { recursive: true });
for (const f of ['sw.js', 'manifest.webmanifest']) rmSync(`${OUT}/${f}`, { force: true });

cpSync('site-assets/pwa/site.webmanifest', `${OUT}/site.webmanifest`);

/** The shell: the page, what it loads directly, the icons and the manifest. */
const html = readFileSync(`${OUT}/index.html`, 'utf8');
const entry = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g)].map((m) => m[1]);
if (!entry.some((p) => p.endsWith('.js'))) {
  console.error('dist-site/index.html loads no /assets/*.js: the precache list would be empty');
  process.exit(1);
}
const precache = [
  '/index.html',
  ...new Set(entry),
  '/site.webmanifest',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',
];
const missing = precache.filter((p) => !existsSync(`${OUT}${p}`));
if (missing.length) {
  console.error(`site service worker would precache missing files: ${missing.join(', ')}`);
  process.exit(1);
}
const hash = createHash('sha256');
for (const p of precache) hash.update(p).update(readFileSync(`${OUT}${p}`));
const buildId = hash.digest('hex').slice(0, 12);

const sw = readFileSync('site-assets/pwa/site-sw.js', 'utf8')
  .replace("'__SITE_BUILD_ID__'", JSON.stringify(buildId))
  .replace('const PRECACHE = __SITE_PRECACHE__;', `const PRECACHE = ${JSON.stringify(precache)};`);
if (/'__SITE_BUILD_ID__'|= __SITE_PRECACHE__/.test(sw)) {
  console.error('site-sw.js still has an unreplaced placeholder');
  process.exit(1);
}
writeFileSync(`${OUT}/site-sw.js`, sw);

console.log(
  `dist-site finished: headers and videos copied, application service worker removed, ` +
    `site worker ${buildId} precaching ${precache.length} files`,
);
