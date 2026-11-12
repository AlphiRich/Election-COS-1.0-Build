import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { allocateSeats, type PartyInput } from './seatCalculator';

// IC-ECOS-BUILD-2026-V2 §8.2: "Write property-based tests. Assert: PR
// seats never negative; total allocated ≥ total seats; overhang produces
// a warning; ties never silently resolve."

const partyArb: fc.Arbitrary<Omit<PartyInput, 'id' | 'name'>> = fc.record({
  votes: fc.integer({ min: 0, max: 100_000 }),
  wardSeatsWon: fc.integer({ min: 0, max: 10 }),
});

const inputArb = fc.array(partyArb, { minLength: 1, maxLength: 6 }).chain((parties) => {
  const totalValidVotes = parties.reduce((s, p) => s + p.votes, 0);
  return fc.record({
    totalSeats: fc.integer({ min: 1, max: 60 }),
    totalValidVotes: fc.constant(totalValidVotes),
    parties: fc.constant(parties.map((p, i) => ({ ...p, id: `party-${i}`, name: `Party ${i}` }))),
  });
});

describe('allocateSeats — property-based', () => {
  it('PR seats are never negative, for any input', () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        const result = allocateSeats(input);
        return result.parties.every((p) => p.prSeats >= 0);
      }),
    );
  });

  it('no seat is ever silently lost: allocated + pending always equals the final council size', () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        const result = allocateSeats(input);
        return result.totalSeatsAllocated + result.pendingSeats === result.councilSizeFinal;
      }),
    );
  });

  it('overhang never shrinks the council below the nominal seat count', () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        const result = allocateSeats(input);
        return result.councilSizeFinal >= input.totalSeats;
      }),
    );
  });

  it('when no tie was flagged, total allocated seats reaches the full (possibly overhang-expanded) council', () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        const result = allocateSeats(input);
        if (result.tieFlags.length === 0) {
          return (
            result.totalSeatsAllocated === result.councilSizeFinal && result.pendingSeats === 0
          );
        }
        return true; // property vacuously holds when a tie occurred — see the dedicated tie test below
      }),
    );
  });
});

describe('allocateSeats — excessive ward seats (the fixed arithmetic contradiction)', () => {
  it('a party winning more ward seats than its entitlement keeps them, takes no list seats, and the council stays its proclaimed size', () => {
    // The prior spec allowed 35 ward wins against 34 seats. Here one party wins 30 wards on
    // 6,000 votes. Item 16 (as amended by Act 3 of 2021): it takes no list seats; a new quota
    // floor((40,000 - 6,000) / (34 - (30 + 0))) + 1 = 8,501 is set for the others, who share
    // the 34 - 30 = 4 remaining seats. Hand-worked; see the Item 16 block below.
    const parties: PartyInput[] = [
      { id: 'A', name: 'Dominant Local Party', votes: 6_000, wardSeatsWon: 30 },
      { id: 'B', name: 'Opposition', votes: 34_000, wardSeatsWon: 4 },
    ];
    const result = allocateSeats({ totalValidVotes: 40_000, totalSeats: 34, parties });
    const partyA = result.parties.find((p) => p.id === 'A')!;
    const partyB = result.parties.find((p) => p.id === 'B')!;
    expect(partyA.excessive).toBe(true);
    expect(partyA.totalSeats).toBe(30);
    expect(partyA.prSeats).toBe(0);
    expect(result.newQuota).toBe(8_501);
    expect(partyB.totalSeats).toBe(4);
    expect(result.councilSizeFinal).toBe(34);
    expect(result.totalSeatsAllocated + result.pendingSeats).toBe(result.councilSizeFinal);
  });
});

describe('allocateSeats — real-world regression (NW405 2021 LGE)', () => {
  it('reproduces the exact IEC "Seat Calculation Detail" result for JB Marks Local Municipality', () => {
    // Source: IEC-printed report supplied by the human — Province: North
    // West, Municipality: NW405 - JB Marks, Electoral Event: LOCAL
    // GOVERNMENT ELECTION 2021, printed 2021/11/22 15:43:44. Every figure
    // below (votes, ward seats, and the expected quota/round1/round2/total
    // columns) is transcribed directly from that report, not invented —
    // this is the fixture that caught and fixed the quota formula bug (see
    // the header comment above).
    const parties: PartyInput[] = [
      { id: 'ABC', name: 'Abantu Batho Congress', votes: 340, wardSeatsWon: 0 },
      { id: 'ANC', name: 'African National Congress', votes: 48_911, wardSeatsWon: 24 },
      { id: 'ATM', name: 'African Transformation Movement', votes: 330, wardSeatsWon: 0 },
      { id: 'BLF', name: 'Black First Land First', votes: 428, wardSeatsWon: 0 },
      { id: 'DA', name: 'Democratic Alliance', votes: 25_837, wardSeatsWon: 9 },
      { id: 'EFF', name: 'Economic Freedom Fighters', votes: 9_200, wardSeatsWon: 0 },
      { id: 'F4SD', name: 'Forum 4 Service Delivery', votes: 204, wardSeatsWon: 0 },
      { id: 'PA', name: 'Patriotic Alliance', votes: 2_389, wardSeatsWon: 0 },
      { id: 'VFP', name: 'Vryheidsfront Plus', votes: 13_800, wardSeatsWon: 1 },
    ];

    const result = allocateSeats({ totalValidVotes: 101_439, totalSeats: 67, parties });

    expect(result.quota).toBe(1_515);
    expect(result.councilSizeFinal).toBe(67); // no overhang in this result
    expect(result.tieFlags).toHaveLength(0);
    expect(result.pendingSeats).toBe(0);
    expect(result.totalSeatsAllocated).toBe(67);

    const byId = Object.fromEntries(result.parties.map((p) => [p.id, p]));
    // Round 1 quota entitlements, printed on the report.
    expect(byId.ABC.quotaEntitlement).toBe(0);
    expect(byId.ANC.quotaEntitlement).toBe(32);
    expect(byId.DA.quotaEntitlement).toBe(17);
    expect(byId.EFF.quotaEntitlement).toBe(6);
    expect(byId.PA.quotaEntitlement).toBe(1);
    expect(byId.VFP.quotaEntitlement).toBe(9);

    // Round 2 (largest-remainder) top-ups: only ANC and Patriotic Alliance,
    // matching the report's "Round 2 Allocation" column exactly.
    expect(byId.ANC.totalSeats).toBe(33);
    expect(byId.PA.totalSeats).toBe(2);
    expect(byId.DA.totalSeats).toBe(17); // no top-up
    expect(byId.EFF.totalSeats).toBe(6); // no top-up
    expect(byId.VFP.totalSeats).toBe(9); // no top-up

    // Final PR list seats (Total Party Seats − Ward Seats), report's last column.
    expect(byId.ANC.prSeats).toBe(9);
    expect(byId.DA.prSeats).toBe(8);
    expect(byId.EFF.prSeats).toBe(6);
    expect(byId.PA.prSeats).toBe(2);
    expect(byId.VFP.prSeats).toBe(8);

    const totalWardSeats = result.parties.reduce((s, p) => s + p.wardSeatsWon, 0);
    const totalPRSeats = result.parties.reduce((s, p) => s + p.prSeats, 0);
    expect(totalWardSeats).toBe(34); // report: "Total Seats 34 33 67"
    expect(totalPRSeats).toBe(33);
  });
});

describe('allocateSeats — ties are flagged, never auto-resolved', () => {
  it('two parties with an identical remainder contesting the last seat produces a tieFlag and a pendingSeat, not a guess', () => {
    // Engineered so two parties land on exactly the same remainder after
    // quota division, with one seat left to distribute.
    const parties: PartyInput[] = [
      { id: 'A', name: 'Party A', votes: 5_005, wardSeatsWon: 0 },
      { id: 'B', name: 'Party B', votes: 5_005, wardSeatsWon: 0 },
      { id: 'C', name: 'Party C', votes: 10, wardSeatsWon: 0 },
    ];
    // totalSeats chosen so quota division leaves exactly one contested seat between A and B.
    const result = allocateSeats({ totalValidVotes: 10_020, totalSeats: 1, parties });

    expect(result.tieFlags.length).toBeGreaterThan(0);
    expect(result.pendingSeats).toBeGreaterThan(0);
    // Nobody was silently awarded the contested seat by array order or id.
    const tie = result.tieFlags[0];
    expect(tie.partyIds.sort()).toEqual(['A', 'B']);
  });
});

/**
 * Schedule 1 Item 16 as amended by Act 3 of 2021 s33 (in force 1 Nov 2021), read from the
 * Gazette (formula checked on the printed page): if a party's ward seats are equal to or
 * greater than the seats Item 13 gives it, it takes no list seats (16(1)); its ward seats
 * stay (16(2)); a new quota floor((A - B) / (C - (D + E))) + 1 is set (16(3)) and the OTHER
 * parties are divided by it (16(4)), ward seats deducted (16(6)). The council stays C.
 *
 * Hand-worked, one excessive party. C = 34, A = 34,000, E = 0.
 *   Item 13: Q = 1,001. P 9 (rem 491), Q 13 (rem 987), R 10 (rem 490): 32 seats, 2 by surplus
 *   -> Q, then P. Item 13 totals P 10, Q 14, R 10. P holds 12 wards >= 10: excessive.
 *   New quota = floor((34,000 - 9,500) / (34 - 12)) + 1 = floor(1,113.6) + 1 = 1,114.
 *   Q: 14,000 / 1,114 = 12 (rem 632); R: 10,500 / 1,114 = 9 (rem 474). 34 - 12 = 22 seats; 21
 *   by quota; the surplus seat goes to Q (632). Totals Q 13, R 9. List seats: Q 13 - 5 = 8,
 *   R 9 - 8 = 1, P 0. Council 12 + 13 + 9 = 34.
 */
describe('Item 16: excessive seats', () => {
  const run = (partyWards: [number, number, number]) =>
    allocateSeats({
      totalValidVotes: 34_000,
      totalSeats: 34,
      parties: [
        { id: 'P', name: 'P', votes: 9_500, wardSeatsWon: partyWards[0] },
        { id: 'Q', name: 'Q', votes: 14_000, wardSeatsWon: partyWards[1] },
        { id: 'R', name: 'R', votes: 10_500, wardSeatsWon: partyWards[2] },
      ],
    });
  const by = (r: ReturnType<typeof run>, id: string) => r.parties.find((p) => p.id === id)!;

  it('gives the excessive party no list seats, keeps its ward seats, and recalculates the others', () => {
    const r = run([12, 5, 8]);
    expect(r.quota).toBe(1_001);
    expect(r.excessiveParties).toEqual(['P']);
    expect(r.newQuota).toBe(1_114);
    expect([by(r, 'P').totalSeats, by(r, 'Q').totalSeats, by(r, 'R').totalSeats]).toEqual([
      12, 13, 9,
    ]);
    expect([by(r, 'P').prSeats, by(r, 'Q').prSeats, by(r, 'R').prSeats]).toEqual([0, 8, 1]);
  });

  it('does NOT let the council grow: it stays the proclaimed size', () => {
    const r = run([12, 5, 8]);
    expect(r.councilSizeFinal).toBe(34);
    expect(r.totalSeatsAllocated).toBe(34);
    expect(r.pendingSeats).toBe(0);
  });

  it('treats two excessive parties together and says so', () => {
    // P 12 and R 12 wards both exceed their 10. B = 20,000, D = 24: new quota floor(14,000 / 10) + 1 = 1,401.
    const r = run([12, 10, 12]);
    expect(r.excessiveParties.sort()).toEqual(['P', 'R']);
    expect(r.newQuota).toBe(1_401);
    expect([by(r, 'P').totalSeats, by(r, 'Q').totalSeats, by(r, 'R').totalSeats]).toEqual([
      12, 10, 12,
    ]);
    expect(r.councilSizeFinal).toBe(34);
    expect(r.notes.join(' ')).toMatch(/More than one party/);
  });

  it('leaves the result untouched where nobody is excessive (the NW405 2021 result is checked elsewhere)', () => {
    const r = run([3, 5, 4]);
    expect(r.excessiveParties).toEqual([]);
    expect(r.newQuota).toBeUndefined();
    expect(r.councilSizeFinal).toBe(34);
  });

  it('a party with no ward seats is never excessive', () => {
    const r = run([0, 0, 0]);
    expect(r.excessiveParties).toEqual([]);
  });
});

/**
 * Item 13(2)(b): equal surpluses go to the party with the highest number of valid votes (the
 * Act says "surplus"). The Act has no rule for equal surplus AND equal votes: flagged, never a lot.
 */
describe('Item 13(2)(b): ties between equal surpluses', () => {
  it('awards the seat to the party with more valid votes when surpluses are equal', () => {
    // C = 3, A = 298: Q = floor(298 / 3) + 1 = 100. X 249 = 2 x 100 + 49; Y 49 = 0 x 100 + 49.
    const r = allocateSeats({
      totalValidVotes: 298,
      totalSeats: 3,
      parties: [
        { id: 'Y', name: 'Y', votes: 49, wardSeatsWon: 0 },
        { id: 'X', name: 'X', votes: 249, wardSeatsWon: 0 },
      ],
    });
    expect(r.quota).toBe(100);
    expect(r.tieFlags).toEqual([]);
    expect(r.parties.find((p) => p.id === 'X')!.totalSeats).toBe(3);
    expect(r.parties.find((p) => p.id === 'Y')!.totalSeats).toBe(0);
  });

  it('is the same whichever order the parties arrive in', () => {
    const mk = (order: 'xy' | 'yx') =>
      allocateSeats({
        totalValidVotes: 298,
        totalSeats: 3,
        parties:
          order === 'xy'
            ? [
                { id: 'X', name: 'X', votes: 249, wardSeatsWon: 0 },
                { id: 'Y', name: 'Y', votes: 49, wardSeatsWon: 0 },
              ]
            : [
                { id: 'Y', name: 'Y', votes: 49, wardSeatsWon: 0 },
                { id: 'X', name: 'X', votes: 249, wardSeatsWon: 0 },
              ],
      });
    expect(
      mk('xy')
        .parties.map((p) => [p.id, p.totalSeats])
        .sort(),
    ).toEqual(
      mk('yx')
        .parties.map((p) => [p.id, p.totalSeats])
        .sort(),
    );
  });

  it('flags, and leaves the seat open, when surplus and votes are both equal', () => {
    // C = 3, A = 300: Q = 101. X and Y each 150 = 1 x 101 + 49. One seat left, nothing separates them.
    const r = allocateSeats({
      totalValidVotes: 300,
      totalSeats: 3,
      parties: [
        { id: 'X', name: 'X', votes: 150, wardSeatsWon: 0 },
        { id: 'Y', name: 'Y', votes: 150, wardSeatsWon: 0 },
      ],
    });
    expect(r.tieFlags).toHaveLength(1);
    expect(r.tieFlags[0]!.partyIds.sort()).toEqual(['X', 'Y']);
    expect(r.pendingSeats).toBe(1);
  });
});
