import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const h = readFileSync(path.resolve(__dirname, '../../site-hosting/_headers'), 'utf-8');

describe('public-site headers', () => {
  it('carry the CSP and hardening headers', () => {
    expect(h).toMatch(/default-src 'self'/);
    expect(h).toMatch(/frame-ancestors 'none'/);
    expect(h).toMatch(/object-src 'none'/);
    expect(h).toMatch(/X-Content-Type-Options: nosniff/);
    expect(h).toMatch(/Strict-Transport-Security/);
  });
  it('allow no unsafe script execution', () => {
    const script = /script-src ([^;]*)/.exec(h)![1];
    expect(script).not.toMatch(/unsafe-/);
    expect(script).not.toMatch(/\*/);
  });
  it('allows the privacy-enhanced YouTube player in frames, and not the ordinary YouTube host', () => {
    const frame = /frame-src ([^;]*)/.exec(h)![1];
    expect(frame).toContain('https://www.youtube-nocookie.com');
    expect(frame).not.toMatch(/https:\/\/(www\.)?youtube\.com/);
    expect(frame).not.toContain('*');
  });
});
