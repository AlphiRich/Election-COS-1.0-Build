#!/usr/bin/env node
/**
 * Public-site size budget (white paper: home < 500 KB, JS < 50 KB per page).
 * Run after `npm run build:site`. Home weight = entry JS + CSS + html, gzipped.
 * FAILS above the hard budget (500 KB). WARNS above the 50 KB JS target,
 * because a React SPA cannot reach it without the Astro rebuild (see
 * docs/website-reconciliation.md); the number is printed so it is never hidden.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';

const DIR = path.resolve('dist-site');
if (!existsSync(DIR)) {
  console.error('dist-site missing: run npm run build:site first');
  process.exit(2);
}
const gz = (f) => gzipSync(readFileSync(f)).length;
const assets = readdirSync(path.join(DIR, 'assets'));
const entry = assets.filter((f) => /^site-.*\.(js|css)$/.test(f));
const js = entry.filter((f) => f.endsWith('.js')).reduce((n, f) => n + gz(path.join(DIR, 'assets', f)), 0);
const other = entry.filter((f) => f.endsWith('.css')).reduce((n, f) => n + gz(path.join(DIR, 'assets', f)), 0);
const html = gz(path.join(DIR, 'index.html'));
const home = js + other + html;
const kb = (n) => (n / 1024).toFixed(1) + ' KB';
console.log(`home (gzip): ${kb(home)}  | entry JS: ${kb(js)}`);
if (js > 50 * 1024) console.warn(`WARN entry JS ${kb(js)} exceeds the 50 KB target`);
if (home > 500 * 1024) {
  console.error('FAIL home page exceeds 500 KB');
  process.exit(1);
}

// Structure guard: the public site must carry its headers and videos, and must not carry the application's service worker.
const must = ['_headers', 'index.html', 'videos/roles.mp4', 'videos/roles.vtt', 'videos/roles.jpg'];
const missing = must.filter((f) => !existsSync(path.join(DIR, f)));
const stray = ['sw.js', 'manifest.webmanifest'].filter((f) => existsSync(path.join(DIR, f)));
if (missing.length || stray.length) {
  if (missing.length) console.error(`FAIL dist-site is missing: ${missing.join(', ')}`);
  if (stray.length) console.error(`FAIL dist-site carries the application's ${stray.join(', ')}`);
  process.exit(1);
}
console.log('structure ok: headers, index, videos present; no application service worker');
