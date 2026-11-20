import { describe, expect, it } from 'vitest';
import { allocateSeats } from './seatCalculator';
import { HISTORY_YEARS, NW405_2016, seatHistoryNW405 } from './seatHistory';

describe('NW405 2016, from the Commission’s 2016 North West results', () => {
  const result = allocateSeats({
    totalValidVotes: NW405_2016.totalValidVotes,
    totalSeats: NW405_2016.totalSeats,
    independentWardSeats: NW405_2016.independentWardSeats,
    noPRListWardSeats: NW405_2016.noPRListWardSeats,
    parties: NW405_2016.parties.map(({ id, name, votes, wardSeatsWon }) => ({ id, name, votes, wardSeatsWon })),
  });

  it('names its source and the file it was read from', () => {
    expect(NW405_2016.sourceId).toBe('iec-lge-2016-nw-vd-results');
    expect(NW405_2016.url).toContain('LGEPublicReports/402/');
    expect(NW405_2016.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('party votes sum to A, and the quota is floor(A / 67) + 1', () => {
    expect(NW405_2016.parties.reduce((s, p) => s + p.votes, 0)).toBe(NW405_2016.totalValidVotes);
    expect(result.quota).toBe(NW405_2016.quota);
    expect(result.quota).toBe(Math.floor(130_716 / 67) + 1);
  });

  it('the TypeScript engine reproduces every seat the Python ETL computed', () => {
    for (const p of NW405_2016.parties) {
      const row = result.parties.find((r) => r.id === p.id)!;
      expect(row.totalSeats, p.name).toBe(p.totalSeats);
    }
  });

  it('is the 2016 council the supplied dashboard showed: ANC 34, DA 22, EFF 5, VF+ 4, others 2', () => {
    const seats = Object.fromEntries(NW405_2016.parties.map((p) => [p.id, p.totalSeats]));
    expect(seats).toMatchObject({ ANC: 34, DA: 22, EFF: 5, VFP: 4, INDEPENDENT_COUNCILLORS: 2 });
    expect(NW405_2016.wards).toBe(34);
    expect(NW405_2016.parties.reduce((s, p) => s + p.wardSeatsWon, 0)).toBe(34);
    expect(NW405_2016.registeredVoters).toBe(116_321);
  });
});

describe('seatHistoryNW405', () => {
  const h = seatHistoryNW405();

  it('fills 67 seats in every year', () => {
    for (const y of HISTORY_YEARS) expect(h.rows.reduce((s, r) => s + r.seats[y], 0), String(y)).toBe(67);
    expect(h.majority).toBe(34);
  });

  it('shows the ANC majority of 2016 and the hung councils of 2021 and 2026', () => {
    expect(h.largest[2016]).toEqual({ id: 'ANC', seats: 34 });
    expect(h.largest[2021]).toEqual({ id: 'ANC', seats: 33 });
    expect(h.largest[2026].seats).toBeLessThan(34);
  });

  it('follows one party across years under one id', () => {
    const vfp = h.rows.find((r) => r.id === 'VFP')!;
    expect(vfp.seats).toEqual({ 2016: 4, 2021: 9, 2026: 6 });
    const anc = h.rows.find((r) => r.id === 'ANC')!;
    expect(anc.seats).toEqual({ 2016: 34, 2021: 33, 2026: 22 });
  });

  it('lists only parties that held a seat at least once', () => {
    expect(h.rows.every((r) => HISTORY_YEARS.some((y) => r.seats[y] > 0))).toBe(true);
    expect(h.rows.find((r) => r.id === 'COPE')).toBeUndefined();
  });
});
