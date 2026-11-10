import { describe, expect, it } from 'vitest';
import { COUNCIL_AD_CODES } from './councilAdPages';
import { COUNCIL_CODES } from '@/modules/lge2026/nationalResults';
import { adDecision } from './adPolicy';

describe('council pages on the advert allowlist', () => {
  it('are exactly the certified councils', () => {
    expect([...COUNCIL_AD_CODES]).toEqual(COUNCIL_CODES);
  });
  it('a council page and the tracker are eligible; an unknown council path is not', () => {
    const ok = (p: string) => adDecision({ pathname: p, hasConsent: true, clientId: 'ca-pub-0000000000000000' }).allowed;
    expect(ok('/councils/JHB')).toBe(true);
    expect(ok('/coalitions')).toBe(true);
    expect(ok('/my-ward')).toBe(true);
    expect(ok('/councils/XYZ999')).toBe(false);
    expect(adDecision({ pathname: '/councils/JHB', hasConsent: false, clientId: 'ca-pub-0000000000000000' }).allowed).toBe(false);
  });
});
