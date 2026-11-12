import { describe, expect, it } from 'vitest';
import { COUNCIL_CODES } from './nationalResults';
import { minimalCoalitions, tierOf, voterIntelligence } from './voterIntelligence';

describe('minimalCoalitions', () => {
  const h = [{ name: 'A', seats: 22 }, { name: 'B', seats: 21 }, { name: 'C', seats: 6 }, { name: 'D', seats: 5 }, { name: 'E', seats: 5 }, { name: 'F', seats: 3 }];
  const c = minimalCoalitions(h, 34, 50);
  it('every coalition reaches the majority and none has a member it could lose', () => {
    expect(c.length).toBeGreaterThan(0);
    for (const x of c) {
      expect(x.seats).toBeGreaterThanOrEqual(34);
      const seatOf = (n: string) => h.find((p) => p.name === n)!.seats;
      for (const m of x.parties) expect(x.seats - seatOf(m), `${x.parties.join('+')} could lose ${m}`).toBeLessThan(34);
    }
  });
  it('finds the grand coalition of the two largest parties and orders fewest parties first, then smallest surplus', () => {
    expect(c.some((x) => x.parties.length === 2 && x.parties.includes('A') && x.parties.includes('B'))).toBe(true);
    const key = (x: { parties: string[]; surplus: number }) => x.parties.length * 1000 + x.surplus;
    expect(c.map(key)).toEqual([...c.map(key)].sort((p, q) => p - q));
    expect(c[0].parties).toHaveLength(2);
  });
  it('a party that already holds a majority is a coalition of one', () => {
    expect(minimalCoalitions([{ name: 'X', seats: 40 }, { name: 'Y', seats: 10 }], 26)).toEqual([{ parties: ['X'], seats: 40, surplus: 14 }]);
  });
});

describe('ward tiers', () => {
  it('uses the instrument’s boundaries', () => {
    expect([61, 60, 51, 50, 40, 39.9].map(tierOf)).toEqual(['Safe', 'Comfortable', 'Comfortable', 'Marginal', 'Marginal', 'Contested']);
  });
});

describe('the instrument for JB Marks, against the certified result', () => {
  it('reproduces the council and the ward map', async () => {
    const v = await voterIntelligence('NW405');
    expect(v.seats.councillors).toBe(67);
    expect(v.majority).toBe(34);
    expect(v.topHolder).toEqual({ name: 'African National Congress', seats: 22 });
    expect(v.shortOfMajority).toBe(12);
    expect(v.wards).toHaveLength(34);
    expect(Object.fromEntries(v.wardsLedBy.map((w) => [w.party, w.wards]))).toEqual({ 'AFRICAN NATIONAL CONGRESS': 22, 'DEMOCRATIC ALLIANCE': 12 });
    expect(v.tierCounts).toEqual({ Safe: 10, Comfortable: 14, Marginal: 6, Contested: 4 });
  });
  it('contains the DA-led four-party majority the supplied sheet described', async () => {
    const v = await voterIntelligence('NW405');
    const want = ['Democratic Alliance', 'Vryheidsfront Plus | Freedom Front Plus', 'ActionSA', 'BAAGI'].sort().join('+');
    const all = minimalCoalitions(v.seats.holders.filter((x) => x.id !== 'IND').map((x) => ({ name: x.name, seats: x.seats })), v.majority, 500);
    expect(all.some((x) => x.parties.slice().sort().join('+') === want && x.seats === 35)).toBe(true);
  });
});

describe('every one of the 213 councils', () => {
  it('produces a consistent instrument: ward counts add up, hung councils have coalitions, others have none', async () => {
    expect(COUNCIL_CODES).toHaveLength(213);
    for (const code of COUNCIL_CODES) {
      const v = await voterIntelligence(code);
      expect(Object.values(v.tierCounts).reduce((s, n) => s + n, 0), `${code} tiers`).toBe(v.wards.length);
      expect(v.wardsLedBy.reduce((s, w) => s + w.wards, 0), `${code} ward leaders`).toBe(v.wards.length);
      if (v.seats.hung) {
        expect(v.coalitions.length, `${code} hung but no coalition`).toBeGreaterThan(0);
        for (const c of v.coalitions) expect(c.seats, `${code}`).toBeGreaterThanOrEqual(v.majority);
      } else expect(v.coalitions, `${code} has a majority`).toEqual([]);
    }
  }, 120_000);
});
