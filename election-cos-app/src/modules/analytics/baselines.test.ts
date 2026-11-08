import { describe, expect, it } from 'vitest';
import { MUNICIPALITY_CODES, seatAllocation2026 } from '@/modules/lge2026/lge2026Results';
import { BASELINE_NW405_2021, baseline2026, baselineFor } from './baselines';
import { runScenarios } from './scenarioRunner';
import { majorityPosition, projectCouncil, twoPartySwing } from './wardScenario';

describe('2026 baselines', () => {
  for (const code of MUNICIPALITY_CODES) {
    it(`${code}: a zero swing reproduces the certified 2026 council exactly`, () => {
      const b = baseline2026(code);
      const proj = projectCouncil({ swing: {}, baseline: b });
      const certified = seatAllocation2026(code);
      expect(proj.flipped).toHaveLength(0);
      for (const p of certified.parties) {
        const mine = proj.allocation.parties.find((x) => x.id === p.id);
        expect(mine?.totalSeats, `${code} ${p.name}`).toBe(p.totalSeats);
      }
      expect(proj.baseline.parties.map((p) => [p.id, p.totalSeats])).toEqual(certified.parties.map((p) => [p.id, p.totalSeats]));
    });
  }
  it('is built from the same ballots as the 2021 baseline: PR plus ward votes, independents outside A', () => {
    const b = baseline2026('NW405');
    expect(b.totalSeats).toBe(67);
    expect(b.totalValidVotes).toBe(138568); // the Commission's A for JB Marks
    expect(b.results.wards).toHaveLength(34);
    expect(baselineFor('NW405', 2021)).toBe(BASELINE_NW405_2021);
    expect(() => baselineFor('NW372', 2021)).toThrow(/Only JB Marks/);
  });
  it('lets a swing move a ward and the council, and an independent winner counts as C, not as a party seat', () => {
    const b = baseline2026('NW372'); // ward 25 is led by the merged independents row
    const zero = projectCouncil({ swing: {}, baseline: b });
    expect(zero.allocation.parties.reduce((s, p) => s + p.totalSeats, 0) + b.independentWardSeats + b.noPRListWardSeats).toBe(b.totalSeats);
    const swung = projectCouncil({ swing: twoPartySwing('ANC', 'DA', 10), baseline: b });
    expect(swung.flipped.length).toBeGreaterThan(0);
    expect(swung.allocation.parties.reduce((s, p) => s + p.totalSeats, 0) + b.independentWardSeats + b.noPRListWardSeats).toBeGreaterThanOrEqual(b.totalSeats);
  });
  it('runs the Monte Carlo from a 2026 baseline, reproducibly', () => {
    const b = baseline2026('NW405');
    const spec = { swingMean: { ANC: -2, DA: 2 }, swingSd: { ANC: 2, DA: 2 }, draws: 400, seed: 7, zeroSum: true, baseline: b };
    const a = runScenarios(spec);
    expect(runScenarios(spec).parties.map((p) => p.mean)).toEqual(a.parties.map((p) => p.mean));
    expect(a.parties.find((p) => p.id === 'ANC')!.seats2021).toBe(22); // the certified 2026 seats, per the Commission
    const anc = a.parties.find((p) => p.id === 'ANC')!;
    expect(anc.min).toBeLessThanOrEqual(anc.p50);
    expect(majorityPosition(projectCouncil({ swing: {}, baseline: b })).seatsForMajority).toBe(34);
  });
});
