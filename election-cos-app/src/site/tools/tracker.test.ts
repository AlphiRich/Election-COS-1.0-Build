import { describe, expect, it } from 'vitest';
import { minimalMajorities } from './coalition';
import { fewestPartiesToGovern, inSmallestGroups, seatsShort, smallMajorities } from './tracker';
import { COUNCIL_CODES, council } from '@/modules/lge2026/nationalResults';

const h = (id: string, seats: number) => ({ id, name: id, seats });

describe('small majorities', () => {
  it('lists minimal groups only, fewest parties first', () => {
    const holders = [h('A', 40), h('B', 30), h('C', 20), h('D', 10)];
    // need 51 of 100
    expect(smallMajorities(holders, 100).map((c) => c.ids.join('+'))).toEqual(['A+B', 'A+C', 'B+C+D']);
    expect(fewestPartiesToGovern(holders, 100)).toBe(2);
    expect(seatsShort(holders, 100)).toBe(11);
  });
  it('a single-party majority is the only minimal group containing that party alone', () => {
    const holders = [h('A', 60), h('B', 40)];
    expect(smallMajorities(holders, 100)).toEqual([{ ids: ['A'], seats: 60 }]);
    expect(seatsShort(holders, 100)).toBe(0);
  });
  it('never puts merged independents or an undecided seat in a group, but counts them in the council', () => {
    const holders = [h('A', 49), h('IND', 2), h('B', 49)];
    expect(smallMajorities(holders, 100).map((c) => c.ids.join('+'))).toEqual(['A+B']);
  });
  it('agrees with the exhaustive search wherever that one runs (councils of 14 parties or fewer)', () => {
    for (const code of COUNCIL_CODES) {
      const c = council(code);
      const parties = c.holders.filter((x) => x.id !== 'IND' && x.id !== 'TIED');
      if (parties.length > 14 || parties.length !== c.holders.length) continue;
      const all = minimalMajorities(c.holders)!.filter((s) => s.ids.length <= 4);
      const mine = smallMajorities(c.holders, c.councillors);
      expect(mine.map((s) => [...s.ids].sort().join('+')).sort(), code).toEqual(all.map((s) => [...s.ids].sort().join('+')).sort());
    }
  });
  it('finds a governing group of at most four parties in every council in the country', () => {
    for (const code of COUNCIL_CODES) {
      const c = council(code);
      expect(fewestPartiesToGovern(c.holders, c.councillors), code).not.toBeNull();
      expect(fewestPartiesToGovern(c.holders, c.councillors) === 1, code).toBe(!c.hung);
    }
  });
  it('counts how often each party appears in the smallest groups', () => {
    const counts = inSmallestGroups([h('A', 40), h('B', 30), h('C', 20), h('D', 10)], 100);
    expect(Object.fromEntries(counts)).toEqual({ A: 2, B: 1, C: 1 });
  });
});
