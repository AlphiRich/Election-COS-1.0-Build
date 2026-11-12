/**
 * The public site is installable, and its worker stays narrow.
 *
 * Proved by injection, then reverted clean:
 *  - removing the manifest link from site.html fails "site.html links the site's own manifest";
 *  - adding `if (url.pathname.startsWith('/videos/'))` caching to site-sw.js fails "never caches videos";
 *  - dropping the no-cache rule from nginx.conf fails "the worker file is never cached".
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { installMode } from './installApp';

const ROOT = path.resolve(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(path.join(ROOT, p), 'utf8');

const ANDROID = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Mobile Safari/537.36';
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const IOS_CHROME = IPHONE.replace('Version/18.0', 'CriOS/130.0');

describe('install button', () => {
  it('uses the browser prompt where there is one', () => {
    expect(installMode({ standalone: false, userAgent: ANDROID, maxTouchPoints: 5, hasPrompt: true })).toBe('prompt');
  });
  it('explains Add to Home Screen on iPhone and iPad Safari', () => {
    expect(installMode({ standalone: false, userAgent: IPHONE, maxTouchPoints: 5, hasPrompt: false })).toBe('ios');
    expect(installMode({ standalone: false, userAgent: IPAD, maxTouchPoints: 5, hasPrompt: false })).toBe('ios');
  });
  it('offers nothing where installing is not possible, or already done', () => {
    expect(installMode({ standalone: false, userAgent: IOS_CHROME, maxTouchPoints: 5, hasPrompt: false })).toBe('unavailable');
    expect(installMode({ standalone: false, userAgent: IPAD, maxTouchPoints: 0, hasPrompt: false })).toBe('unavailable');
    expect(installMode({ standalone: true, userAgent: ANDROID, maxTouchPoints: 5, hasPrompt: true })).toBe('installed');
  });
});

describe('manifest', () => {
  const manifest = JSON.parse(read('site-assets/pwa/site.webmanifest')) as {
    name: string;
    start_url: string;
    scope: string;
    display: string;
    icons: { src: string; sizes: string; purpose: string }[];
    shortcuts: { url: string }[];
  };

  it('site.html links the site’s own manifest, not the application’s', () => {
    const html = read('site.html');
    expect(html).toContain('<link rel="manifest" href="/site.webmanifest" />');
    expect(html).not.toContain('manifest.webmanifest');
  });

  it('meets the install criteria: standalone, a start URL in scope, 192 and 512 icons, a maskable icon', () => {
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url.startsWith(manifest.scope)).toBe(true);
    const sizes = manifest.icons.map((i) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
    expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true);
    for (const icon of manifest.icons) expect(existsSync(path.join(ROOT, 'public', icon.src)), icon.src).toBe(true);
  });

  it('shortcuts open public pages, never the staff application', () => {
    for (const s of manifest.shortcuts) expect(s.url).toMatch(/^\/(?!.*app\.)/);
  });
});

describe('the site worker', () => {
  const sw = read('site-assets/pwa/site-sw.js');

  it('leaves other origins and non-GET requests alone', () => {
    expect(sw).toContain("if (request.method !== 'GET') return;");
    expect(sw).toContain('if (url.origin !== self.location.origin) return;');
  });

  it('never caches videos (range requests) and is not the application worker', () => {
    expect(sw).not.toMatch(/startsWith\('\/videos\//);
    expect(sw).toContain("'ecos-site-shell-'");
    expect(sw).not.toContain('ecos-shell-');
  });

  it('the worker file is never cached, so a deploy reaches installed copies at once', () => {
    const nginx = read('site-hosting/gcp/nginx.conf');
    expect(nginx).toMatch(/location = \/site-sw\.js \{\s*add_header Cache-Control "no-cache" always;/);
    expect(nginx).toMatch(/location = \/site\.webmanifest \{[\s\S]*?default_type application\/manifest\+json;/);
  });
});
