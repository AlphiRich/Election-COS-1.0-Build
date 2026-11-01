import { describe, expect, it } from 'vitest';
import { NW405_2021_EXAMPLE } from '@/modules/analytics/nw405Example';
import { parseCsv, runModel, type ModelInput } from './seatModel';

const jb2021 = (): ModelInput => ({
  municipalityCode: 'NW405',
  independentWardSeats: 0,
  noPRListWardSeats: 0,
  parties: NW405_2021_EXAMPLE.parties.map((p) => ({
    id: p.id,
    name: p.name,
    prVotes: p.votes,
    wardSeatsWon: p.wardSeatsWon,
  })),
});

describe('the seat model on the real 2021 JB Marks result', () => {
  it('takes council size and wards from the delimitation and reproduces the Commission’s quota and seats', () => {
    const r = runModel(jb2021());
    if (!r.ok) throw new Error(r.reason);
    const o = r.output;
    expect(o.council).toMatchObject({ councillors: 67, wards: 34, prSeats: 33 });
    expect(o.result.quota).toBe(1_515);
    const seats = Object.fromEntries(o.result.parties.map((p) => [p.id, p.totalSeats]));
    expect(seats).toMatchObject({ ANC: 33, DA: 17, EFF: 6, PA: 2, VFP: 9 });
    expect(o.result.councilSizeFinal).toBe(67);
    expect(o.majority).toBe(34);
    expect(o.findings.filter((f) => f.severity !== 'info')).toEqual([]);
  });

  it('uses PR votes only: ward-ballot figures do not enter the quota', () => {
    // The earlier mock-up summed ward and PR votes. Doubling every party’s
    // PR votes must double the electorate and keep the same quota *ratio*,
    // but adding a separate ward figure has no field to go in at all.
    const input = jb2021();
    const base = runModel(input);
    const doubled = runModel({
      ...input,
      parties: input.parties.map((p) => ({ ...p, prVotes: p.prVotes * 2 })),
    });
    if (!base.ok || !doubled.ok) throw new Error('model failed');
    expect(doubled.output.result.parties.map((p) => p.totalSeats)).toEqual(
      base.output.result.parties.map((p) => p.totalSeats),
    );
  });
});

describe('what the model refuses or flags', () => {
  it('refuses a district council, which uses a different Schedule', () => {
    const r = runModel({ ...jb2021(), municipalityCode: 'DC40' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/district council/);
  });

  it('refuses more ward winners than the municipality has wards', () => {
    const input = jb2021();
    input.parties[0].wardSeatsWon = 30; // 30 + 9 + 1 = 40 > 34
    const r = runModel(input);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/34 wards/);
  });

  it('warns when wards are undecided and when a party has wards but no PR votes', () => {
    const input = jb2021();
    input.parties[1].wardSeatsWon = 0; // ANC had 24; DA 9 + VFP 1 + ABC 15 = 25 of 34
    input.parties[0].prVotes = 0;
    input.parties[0].wardSeatsWon = 15;
    const r = runModel(input);
    if (!r.ok) throw new Error(r.reason);
    const text = r.output.findings.map((f) => f.text).join(' | ');
    expect(text).toMatch(/9 of 34 wards have no winner/);
    expect(text).toMatch(/no PR votes/);
  });

  it('expands the council on overhang instead of dropping a party’s ward wins', () => {
    const r = runModel({
      municipalityCode: 'NW405',
      independentWardSeats: 0,
      noPRListWardSeats: 0,
      parties: [
        { id: 'A', name: 'A', prVotes: 40_000, wardSeatsWon: 20 },
        { id: 'B', name: 'B', prVotes: 60_000, wardSeatsWon: 14 },
      ],
    });
    if (!r.ok) throw new Error(r.reason);
    const a = r.output.result.parties.find((p) => p.id === 'A')!;
    expect(a.totalSeats).toBeGreaterThanOrEqual(20);
    expect(r.output.result.councilSizeFinal).toBeGreaterThanOrEqual(67);
  });

  it('applies no minimum threshold: a very small party still earns a seat on a full quota', () => {
    const input = jb2021();
    const pa = input.parties.find((p) => p.id === 'PA')!; // 2,389 of 101,439 is 2.4%, but test the principle below 1%
    pa.prVotes = 1_520; // just over one quota (1,515), well under 1%
    const r = runModel(input);
    if (!r.ok) throw new Error(r.reason);
    expect(
      r.output.result.parties.find((p) => p.id === 'PA')!.quotaEntitlement,
    ).toBeGreaterThanOrEqual(1);
  });
});

describe('CSV import', () => {
  it('reads Name,PRVotes,WardSeats', () => {
    const r = parseCsv('Name,PRVotes,WardSeats\r\nParty A,1200,3\r\n"Party B",800,0\r\n');
    expect(r.errors).toEqual([]);
    expect(r.parties.map((p) => [p.name, p.prVotes, p.wardSeatsWon])).toEqual([
      ['Party A', 1200, 3],
      ['Party B', 800, 0],
    ]);
  });

  it('refuses thousands separators, blanks, short rows and oversized input rather than guessing', () => {
    expect(parseCsv('Name,PRVotes,WardSeats\nA,1 200,3').errors[0]).toMatch(/whole numbers/);
    expect(parseCsv('Name,PRVotes,WardSeats\n,10,0').errors[0]).toMatch(/blank/);
    expect(parseCsv('Name,PRVotes,WardSeats\nA,10').errors[0]).toMatch(/expected/);
    expect(parseCsv('Name,PRVotes,WardSeats').errors[0]).toMatch(/at least one party/);
    expect(parseCsv('x'.repeat(100_001)).errors[0]).toMatch(/too large/);
    const many =
      'Name,PRVotes,WardSeats\n' + Array.from({ length: 41 }, (_, i) => `P${i},1,0`).join('\n');
    expect(parseCsv(many).errors[0]).toMatch(/More than 40/);
  });

  it('returns no parties at all when any row is bad', () => {
    expect(parseCsv('Name,PRVotes,WardSeats\nA,10,0\nB,x,0').parties).toEqual([]);
  });
});
