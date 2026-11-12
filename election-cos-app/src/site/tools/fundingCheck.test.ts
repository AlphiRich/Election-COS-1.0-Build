import { describe, expect, it } from 'vitest';
import { defaultPPFAConfig } from '../../modules/finance/ppfaDefaults';
import {
  ANNUAL_CAP_CENTS,
  DISCLOSURE_LINE_CENTS,
  WARNING_FRACTION,
  checkTotal,
  formatRand,
  parseRandToCents,
} from './fundingCheck';

describe('the checker holds the same figures as the application', () => {
  it('matches ppfaDefaults', () => {
    const cfg = defaultPPFAConfig('t', 'u');
    expect(DISCLOSURE_LINE_CENTS).toBe(cfg.disclosureThresholdZAR);
    expect(ANNUAL_CAP_CENTS).toBe(cfg.annualDonorCapZAR);
    expect(WARNING_FRACTION).toBe(cfg.warningPercentage);
  });
});

describe('parseRandToCents', () => {
  it('reads the ways people write rand', () => {
    expect(parseRandToCents('R184,500')).toBe(18_450_000);
    expect(parseRandToCents('184 500.5')).toBe(18_450_050);
    expect(parseRandToCents('R 1 000 000')).toBe(100_000_000);
    expect(parseRandToCents('0')).toBe(0);
  });
  it('refuses what is not an amount', () => {
    for (const bad of ['', 'abc', '-5', '1.234', '1e6', 'R', '12,34,x']) {
      expect(parseRandToCents(bad)).toBeNull();
    }
  });
});

describe('checkTotal boundaries', () => {
  it('R159,999.99 is below the warning rung; R160,000 is on it', () => {
    expect(checkTotal(15_999_999).band).toBe('BELOW_WARNING');
    expect(checkTotal(16_000_000).band).toBe('NEAR_DISCLOSURE');
  });
  it('R199,999.99 is near; R200,000 is at the line', () => {
    expect(checkTotal(19_999_999).band).toBe('NEAR_DISCLOSURE');
    expect(checkTotal(20_000_000).band).toBe('AT_OR_ABOVE_DISCLOSURE');
  });
  it('the cap is strict: exactly R30m is not above it', () => {
    expect(checkTotal(ANNUAL_CAP_CENTS).band).toBe('AT_OR_ABOVE_DISCLOSURE');
    expect(checkTotal(ANNUAL_CAP_CENTS + 1).band).toBe('ABOVE_ANNUAL_CAP');
  });
  it('the superseded R100,000 line is not used', () => {
    expect(checkTotal(10_000_000).band).toBe('BELOW_WARNING');
  });
});

describe('what the checker says', () => {
  it('never claims lawfulness', () => {
    for (const c of [0, 16_000_000, 20_000_000, ANNUAL_CAP_CENTS + 1]) {
      expect(checkTotal(c).message).not.toMatch(
        /\b(lawful|compliant|compliance|valid|permitted|legal|allowed|approved)\b/i,
      );
    }
  });
  it('formats rand with a non-breaking group separator', () => {
    expect(formatRand(20_000_000)).toBe('R200\u00a0000');
  });
});
