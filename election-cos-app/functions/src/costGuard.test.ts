import { describe, expect, it } from 'vitest';
import {
  CostGuardError,
  DEFAULT_CEILING_CENTS,
  effectiveCeiling,
  parseUnitCost,
  reserveSpend,
  sastMonth,
  type Approval,
  type SpendStore,
} from './costGuard';

function store(initial = 0, approval: Approval | null = null) {
  let spent = initial;
  const s: SpendStore = {
    async runTransaction(fn) {
      return fn({
        getSpent: async () => spent,
        getApproval: async () => approval,
        setSpent: (_p, c) => (spent = c),
      });
    },
  };
  return { s, spent: () => spent };
}
const NOW = new Date('2026-11-10T10:00:00Z');

describe('the R500 default', () => {
  it('is 50,000 cents', () => expect(DEFAULT_CEILING_CENTS).toBe(50000));
  it('allows spend up to exactly the ceiling and refuses the next cent', async () => {
    const { s, spent } = store(49_900);
    await reserveSpend(s, 100, NOW); // lands exactly on R500
    expect(spent()).toBe(50_000);
    await expect(reserveSpend(s, 1, NOW)).rejects.toMatchObject({ code: 'CEILING_REACHED' });
    expect(spent()).toBe(50_000); // a refusal records nothing
  });
});

describe('founder approval', () => {
  const ok: Approval = { ceilingCents: 200_000, approvedBy: 'Founder', period: '2026-11' };
  it('raises the ceiling for the month it names, and only that month', () => {
    expect(effectiveCeiling(ok, '2026-11')).toBe(200_000);
    expect(effectiveCeiling(ok, '2026-12')).toBe(DEFAULT_CEILING_CENTS);
  });
  it('is ignored with no named approver, or if it does not exceed the default', () => {
    expect(effectiveCeiling({ ...ok, approvedBy: ' ' }, '2026-11')).toBe(DEFAULT_CEILING_CENTS);
    expect(effectiveCeiling({ ...ok, ceilingCents: 10_000 }, '2026-11')).toBe(
      DEFAULT_CEILING_CENTS,
    );
    expect(effectiveCeiling({ ...ok, ceilingCents: 200_000.5 }, '2026-11')).toBe(
      DEFAULT_CEILING_CENTS,
    );
  });
  it('lets spend continue past R500 once approved', async () => {
    const { s } = store(50_000, ok);
    await expect(reserveSpend(s, 500, NOW)).resolves.toMatchObject({ spentCents: 50_500 });
  });
});

describe('fails closed', () => {
  it('on an unconfigured or invalid price', () => {
    for (const bad of [undefined, '', 'abc', 0, -5, 1.5]) {
      expect(() => parseUnitCost(bad as never)).toThrow(CostGuardError);
    }
    expect(parseUnitCost('35')).toBe(35);
  });
  it('on a non-positive reservation', async () => {
    await expect(reserveSpend(store().s, 0, NOW)).rejects.toMatchObject({
      code: 'PRICE_NOT_CONFIGURED',
    });
  });
});

describe('the month', () => {
  it('is SAST: 23:30 UTC on 30 Nov is already December', () => {
    expect(sastMonth(new Date('2026-11-30T23:30:00Z'))).toBe('2026-12');
    expect(sastMonth(new Date('2026-11-30T21:59:00Z'))).toBe('2026-11');
  });
});

import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('every paid send is behind the guard', () => {
  it('requestMembershipOtp reserves spend before it generates or delivers a code', () => {
    const src = readFileSync(path.resolve(__dirname, 'membershipOtpCallables.ts'), 'utf-8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    const reserve = src.indexOf('reserveSpend(');
    const generate = src.indexOf('generateOtp()');
    const deliver = src.indexOf('deliverOtp(');
    expect(reserve).toBeGreaterThan(-1);
    expect(reserve).toBeLessThan(generate);
    expect(reserve).toBeLessThan(deliver);
  });
  it('no other function file calls the WhatsApp delivery', () => {
    const dir = __dirname;
    const offenders = require('node:fs')
      .readdirSync(dir)
      .filter((f: string) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
      .filter((f: string) => /deliverOtp\(/.test(readFileSync(path.join(dir, f), 'utf-8')))
      .filter(
        (f: string) => !['membershipOtpCallables.ts', 'membershipOtpDelivery.ts'].includes(f),
      );
    expect(offenders).toEqual([]);
  });
});
