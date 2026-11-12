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

describe('ward figures from the election database', () => {
  const bundled = async () => voterIntelligence('NW405');
  const asRows = async () => {
    const province = await (await import('./nationalResults')).loadProvince('NW');
    return province.municipalities.NW405.wardResults.map((w) => ({ wardNumber: w.wardNumber, registered: w.registered, valid: w.valid, parties: w.parties }));
  };
  it('uses the database rows when they cover every ward, and gives the same map as the bundled results', async () => {
    const rows = await asRows();
    const fromDb = await voterIntelligence('NW405', async () => rows);
    expect(fromDb.wardData).toBe('database');
    expect(fromDb.wards).toEqual((await bundled()).wards);
  });
  it('falls back to the bundled results when the database has nothing, a partial load, empty wards, or fails', async () => {
    const rows = await asRows();
    for (const src of [async () => null, async () => rows.slice(1), async () => rows.map((r, i) => (i ? r : { ...r, parties: [] })), async () => { throw new Error('offline'); }]) {
      const v = await voterIntelligence('NW405', src);
      expect(v.wardData).toBe('bundled');
      expect(v.wards).toHaveLength(34);
    }
  });
  it('is bundled when no database is offered', async () => {
    expect((await voterIntelligence('NW405')).wardData).toBe('bundled');
  });
});

describe('the stored form of every council gives the same instrument as the bundled results', () => {
  it('for all 213 councils: documents made by the loader, read back as ward rows, reproduce the ward map', async () => {
    const { councilDocs } = await import('@/modules/electionData/model');
    const { loadProvince, PROVINCE_CODES, NATIONAL_SEATS } = await import('./nationalResults');
    let checked = 0;
    for (const prov of PROVINCE_CODES) {
      const file = await loadProvince(prov);
      for (const [code, c] of Object.entries(file.municipalities)) {
        if (!NATIONAL_SEATS.councils[code]) continue;
        const { wards } = councilDocs('EEID1887', prov, code, c);
        const stored = async () => wards.map((w) => ({ wardNumber: w.wardNumber, registered: w.registered, valid: w.valid, parties: w.parties.map((x) => [x.party, x.votes] as const) }));
        const a = await voterIntelligence(code, stored);
        const b = await voterIntelligence(code);
        expect(a.wardData, code).toBe('database');
        expect(a.wards, code).toEqual(b.wards);
        checked++;
      }
    }
    expect(checked).toBe(213);
  }, 120000);
});
