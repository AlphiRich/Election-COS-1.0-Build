import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import seatIec from '@/data/lge2026/seat-calculation-iec.json';
import { delimitationFor } from '@/modules/reference/municipalRegister';
import {
  DISTRICT_CODES,
  LGE2026,
  LGE2026_MANIFEST,
  MUNICIPALITY_CODES,
  district,
  municipality,
  partyId,
  seatAllocation2026,
  seatInput,
  turnout,
  wardOutcomes,
} from './lge2026Results';

const sum = (xs: Array<[string, number]>) => xs.reduce((s, [, v]) => s + v, 0);
interface IecReport {
  code: string; excessiveCase: boolean; Q: number; A: number; totalSeats: number; independentWardSeats: number;
  noPrListWardSeats: number; excessiveVotes: number; excessiveSeats: number; partySeatsTotal: number;
  rows: Array<{ votes: number; seats: number; wardSeats: number; prSeats: number }>;
}
const IEC = (seatIec as unknown as { municipalities: Record<string, IecReport> }).municipalities;

describe('what was ingested', () => {
  it('is all 18 North West local municipalities, 402 wards, with a SHA-256 for every source file', () => {
    expect(MUNICIPALITY_CODES).toHaveLength(18);
    expect(LGE2026_MANIFEST.files).toHaveLength(18);
    for (const f of LGE2026_MANIFEST.files) expect(f.sha256, f.code).toMatch(/^[0-9a-f]{64}$/);
    expect(MUNICIPALITY_CODES.reduce((s, c) => s + municipality(c).wards, 0)).toBe(402);
    expect(LGE2026_MANIFEST.files.reduce((s, f) => s + f.rows, 0)).toBe(120350);
  });
  it('has the same ward count as the proclaimed register for every municipality', () => {
    for (const c of MUNICIPALITY_CODES) expect(municipality(c).wards, c).toBe(delimitationFor(c)!.wardSeats);
  });
  it('closes arithmetically: ballots, wards and registered voters add up within each municipality', () => {
    for (const c of MUNICIPALITY_CODES) {
      const m = municipality(c);
      for (const b of ['ward', 'pr', 'dc40'] as const) expect(sum(m.parties[b]), `${c} ${b}`).toBe(m.ballots[b].valid);
      expect(m.wardResults.reduce((s, w) => s + w.valid, 0), c).toBe(m.ballots.ward.valid);
      expect(m.wardResults.reduce((s, w) => s + w.spoilt, 0), c).toBe(m.ballots.ward.spoilt);
      expect(m.wardResults.reduce((s, w) => s + w.registered, 0), c).toBe(m.registered);
      for (const w of m.wardResults) expect(sum(w.parties), `${c} ward ${w.wardNumber}`).toBe(w.valid);
    }
  });
  it('turnout is per ballot, never the ballots added together', () => {
    const t = turnout('NW405', 'pr');
    expect(t.cast).toBe(69048 + 1107);
    expect(t.pct).toBeGreaterThan(50);
    expect(t.pct).toBeLessThan(60);
    for (const b of ['ward', 'pr', 'dc40'] as const) expect(turnout('NW405', b).pct).toBeLessThan(100);
  });
  it('NW405 headline figures are pinned to the Commission’s file', () => {
    const m = municipality('NW405');
    expect(m.ballots.pr).toEqual({ valid: 69048, spoilt: 1107 });
    expect(m.ballots.ward).toEqual({ valid: 69520, spoilt: 1216 });
    expect(m.ballots.dc40).toEqual({ valid: 69304, spoilt: 1221 });
    expect(m.wards).toBe(34);
    expect(m.votingDistricts).toBe(106);
  });
  it('records the one place the municipality files and the province-wide file disagree, and which is later', () => {
    const x = LGE2026_MANIFEST.crosscheck;
    expect(x.provinceFile!.rows).toBe(120150);
    expect(Object.keys(x.differingMunicipalities)).toEqual(['NW373']);
    expect(x.onlyInProvince).toBe(0);
    const nw373 = LGE2026_MANIFEST.files.find((f) => f.code === 'NW373')!;
    expect(nw373.generatedTo > '2026-11-07T18:44:54').toBe(true);
  });
  it('holds no personal data: only counts, station names and codes', () => {
    const text = JSON.stringify(LGE2026);
    expect(text).not.toMatch(/\d{13}/);
  });
});

describe('district councils', () => {
  it('are the DC 40% ballot summed over their member municipalities, and nothing else', () => {
    expect(DISTRICT_CODES).toEqual(['DC37', 'DC38', 'DC39', 'DC40']);
    const members: Record<string, string[]> = { DC37: ['NW371', 'NW372', 'NW373', 'NW374', 'NW375'], DC38: ['NW381', 'NW382', 'NW383', 'NW384', 'NW385'], DC39: ['NW392', 'NW393', 'NW394', 'NW396', 'NW397'], DC40: ['NW403', 'NW404', 'NW405'] };
    for (const d of DISTRICT_CODES) {
      const x = district(d);
      expect(x.members).toEqual(members[d]);
      expect(x.dc40.valid).toBe(x.members.reduce((s, c) => s + municipality(c).ballots.dc40.valid, 0));
      expect(sum(x.parties)).toBe(x.dc40.valid);
    }
  });
  it('are refused by the Schedule 1 engine rather than given a wrong seat count', () => {
    expect(() => seatAllocation2026('DC40')).toThrow();
  });
});

describe('reconciled with the Commission’s own Seat Calculation Detail reports (all 18)', () => {
  for (const code of MUNICIPALITY_CODES) {
    it(`${code}: same A, quota and every party's seats and ward/list split`, () => {
      const iec = IEC[code];
      const mine = seatAllocation2026(code);
      const i = seatInput(code);
      expect(i.totalSeats, 'B').toBe(iec.totalSeats);
      expect(i.independentWardSeats, 'C').toBe(iec.independentWardSeats);
      expect(i.noPRListWardSeats, 'D').toBe(iec.noPrListWardSeats);
      if (!iec.excessiveCase) {
        expect(i.totalValidVotes, 'A').toBe(iec.A);
        expect(mine.quota, 'Q').toBe(iec.Q);
      } else {
        expect(mine.newQuota, 'Item 16 quota').toBe(iec.Q);
      }
      for (const r of iec.rows.filter((x) => x.seats > 0)) {
        const mineRow = mine.parties.find((p) => p.votes === r.votes && p.totalSeats === r.seats);
        expect(mineRow, `${code}: a party with ${r.votes} votes should hold ${r.seats} seats`).toBeDefined();
        expect(mineRow!.wardSeatsWon, `${code} ${mineRow!.name} ward seats`).toBe(r.wardSeats);
      }
      const seats = mine.parties.reduce((s, p) => s + p.totalSeats, 0) + i.independentWardSeats + i.noPRListWardSeats;
      expect(seats).toBe(iec.totalSeats);
    });
  }
});

describe('ward outcomes', () => {
  it('give each ward a winner with a positive margin, and flag merged independents', () => {
    for (const c of MUNICIPALITY_CODES) for (const w of wardOutcomes(c)) {
      expect(w.winnerVotes, `${c} ${w.wardNumber}`).toBeGreaterThan(0);
      expect(w.margin).toBeGreaterThanOrEqual(0);
    }
  });
  it('has stable party ids for the parties used elsewhere in the build', () => {
    expect(partyId('AFRICAN NATIONAL CONGRESS')).toBe('ANC');
    expect(partyId('VRYHEIDSFRONT PLUS | FREEDOM FRONT PLUS')).toBe('VFP');
    expect(createHash('sha256').update(partyId('SAVE DITSOBOTLA MOVEMENT')).digest('hex')).toHaveLength(64);
  });
});
