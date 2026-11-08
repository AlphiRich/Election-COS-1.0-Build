#!/usr/bin/env node
/**
 * Last step of `npm run build:site`: copy the response headers and the explainer videos into dist-site, and remove
 * the application's service worker and manifest (the shared public/ folder copies them in; the public site must not
 * carry them). Node, not `cp` and `rm`, so the build runs the same on Windows, macOS and Linux.
 */
import { cpSync, existsSync, rmSync } from 'node:fs';

const OUT = 'dist-site';
if (!existsSync(OUT)) {
  console.error('dist-site missing: the vite build did not run');
  process.exit(2);
}
cpSync('site-hosting/_headers', `${OUT}/_headers`);
cpSync('site-assets/videos', `${OUT}/videos`, { recursive: true });
for (const f of ['sw.js', 'manifest.webmanifest']) rmSync(`${OUT}/${f}`, { force: true });
console.log('dist-site finished: headers and videos copied, application service worker removed');
