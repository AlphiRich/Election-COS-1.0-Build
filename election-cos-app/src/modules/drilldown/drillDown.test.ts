import { describe, expect, it } from 'vitest';
import { drillRows, partyName, seatsWon2021, votingDistrictsOf } from './drillDown';

describe('drill-down data', () => {
  it('has all 34 wards, each joined to its 2026 registered voters, summing to 122,059', () => {
    const rows = drillRows(5, 'ward');
    expect(rows).toHaveLength(34);
    expect(rows.map((r) => r.wardNumber)).toEqual(Array.from({ length: 34 }, (_, i) => i + 1));
    expect(rows.reduce((s, r) => s + r.registered, 0)).toBe(122059);
    expect(rows.every((r) => r.registered > 0)).toBe(true);
  });
  it('margin is first minus second, and swing to flip is half of it', () => {
    for (const r of drillRows(5, 'ward')) {
      expect(r.margin).toBeCloseTo(r.winnerPct - r.runnerUpPct, 9);
      expect(r.swing).toBeCloseTo(r.margin / 2, 9);
      expect(r.margin).toBeGreaterThan(0);
    }
  });
  it('sorts by margin ascending and marks close wards only under the threshold', () => {
    const rows = drillRows(10, 'margin');
    for (let i = 1; i < rows.length; i++) expect(rows[i].margin).toBeGreaterThanOrEqual(rows[i - 1].margin);
    for (const r of rows) expect(r.close).toBe(r.margin < 10);
    expect(drillRows(0, 'margin').some((r) => r.close)).toBe(false);
    expect(drillRows(100, 'margin').every((r) => r.close)).toBe(true);
  });
  it('sorts by registered voters descending', () => {
    const rows = drillRows(5, 'registered');
    for (let i = 1; i < rows.length; i++) expect(rows[i].registered).toBeLessThanOrEqual(rows[i - 1].registered);
  });
  it('ward seats won in 2021 total 34 and use party names', () => {
    const seats = seatsWon2021();
    expect(seats.reduce((s, [, n]) => s + n, 0)).toBe(34);
    expect(seats[0][0]).toBe('African National Congress');
    expect(partyName('INDEPENDENT')).toBe('Independent');
  });
  it('lists the voting districts of a ward, whose registered voters add up to the ward', () => {
    const w1 = votingDistrictsOf(1);
    expect(w1.length).toBeGreaterThan(0);
    expect(w1.reduce((s, v) => s + v.registered, 0)).toBe(drillRows(5, 'ward')[0].registered);
  });
});
