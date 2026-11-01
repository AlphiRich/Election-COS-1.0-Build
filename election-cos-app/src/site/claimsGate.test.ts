import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FORBIDDEN_CLAIMS, PARTY_NAMES, claimGate, gatedClaims } from './claimsGate';
import { CLAIM_ROWS } from './siteContent';

/** Source with comments removed, so prose about a rule does not trip it. */
function code(file: string): string | null {
  try {
    const src = readFileSync(path.resolve(__dirname, file), 'utf-8');
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  } catch {
    return null;
  }
}

const MARKETING = [
  'siteContent.ts',
  'platformContent.ts',
  'pages/SiteHome.tsx',
  'pages/SiteForCampaigns.tsx',
  'pages/SiteCasework.tsx',
  'pages/SiteCompliance.tsx',
  'pages/SitePackages.tsx',
  'pages/SitePlatform.tsx',
  'pages/SiteAbout.tsx',
  'pages/SiteLegal.tsx',
  'pages/SiteContact.tsx',
  'pages/SiteNotFound.tsx',
];

describe('claims gate (C.7)', () => {
  it('hides a placeholder row and flags one whose check is unfilled', () => {
    const base = { does: 'Does a thing', not: 'That it does more', ref: '[LEG-03 T-99]' };
    expect(claimGate(base)).toBe('pending');
    expect(claimGate({ ...base, ref: 'LEG-03 T-99' })).toBe('passed');
    expect(claimGate({ ...base, does: '[SIXTH ROW, AS IN LEG-03]' })).toBe('hidden');
  });

  it('renders no row of the live register whose wording is a placeholder', () => {
    const shown = gatedClaims(CLAIM_ROWS);
    expect(shown.length).toBeGreaterThan(0);
    for (const { row } of shown) expect(row.does).not.toMatch(/^\[/);
    expect(shown.length).toBeLessThan(CLAIM_ROWS.length);
  });
});

describe('forbidden claims', () => {
  it('appear only as the negated "not" column', () => {
    let scanned = 0;
    for (const file of MARKETING) {
      let src = code(file);
      if (src === null) continue;
      scanned++;
      if (file === 'siteContent.ts') src = src.replace(/not:\s*'[^']*'/g, '');
      for (const re of FORBIDDEN_CLAIMS) expect(src, `${file} ${re}`).not.toMatch(re);
    }
    expect(scanned).toBeGreaterThan(5);
  });
});

describe('neutrality lint', () => {
  it('finds no party name on the marketing surfaces', () => {
    for (const file of MARKETING) {
      const src = code(file);
      if (src === null) continue;
      for (const re of PARTY_NAMES) expect(src, `${file} ${re}`).not.toMatch(re);
    }
  });
});
