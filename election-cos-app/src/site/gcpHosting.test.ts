import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '../..');
const headers = readFileSync(path.join(root, 'site-hosting/_headers'), 'utf8');
const nginx = readFileSync(path.join(root, 'site-hosting/gcp/nginx.conf'), 'utf8');

describe('GCP hosting (nginx) matches the Cloudflare headers file', () => {
  const wanted = [...headers.matchAll(/^\s+([A-Za-z-]+): (.*)$/gm)]
    .filter(([, k]) => k !== 'Cache-Control')
    .map(([, k, v]) => [k, v] as const);
  it('sets every security header from _headers, with the same value, at every location', () => {
    expect(wanted.length).toBeGreaterThanOrEqual(5);
    for (const [k, v] of wanted) {
      const line = `add_header ${k} "${v}" always;`;
      expect(nginx.split(line).length - 1, k).toBeGreaterThanOrEqual(4); // server, /assets/, /videos/, captions
    }
  });
  it('serves real pages and real 404s, never the home page for an unknown path', () => {
    // The old rule answered every path with index.html and status 200: duplicates and soft 404s in Search Console.
    expect(nginx).not.toMatch(/try_files[^;]*\/index\.html;/);
    expect(nginx).toContain('try_files $uri $uri/index.html =404;');
    expect(nginx).toContain('error_page 404 /404.html;');
    expect(nginx).toMatch(/location = \/404\.html \{\s*internal;/);
  });
  it('has one address for the home page and one for each page with or without a slash', () => {
    expect(nginx).toMatch(/if \(\$request_uri ~\* "\^\/index\\\.html[^"]*"\) \{\s*return 301 \/;/);
    expect(nginx).toContain('rewrite ^/(.+)/$ /$1 permanent;');
  });
  it('still serves poll links (issued per person, not in the sitemap) as the app shell', () => {
    expect(nginx).toMatch(/location ~ \^\/poll\/\[\^\/\]\+\$ \{\s*rewrite \^ \/poll-shell\.html break;/);
  });
  it('caches hashed assets as immutable', () => {
    expect(nginx).toMatch(/location \/assets\/[\s\S]*immutable/);
  });
  it('serves captions as text/vtt', () => {
    expect(nginx).toMatch(/\.vtt\$ \{\s*default_type text\/vtt;/);
  });
  it('allows no third-party script', () => {
    const csp = wanted.find(([k]) => k === 'Content-Security-Policy')![1];
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
  });
});
