/**
 * Election Campaign OS — Seat calculator (Municipal Structures Act MMP allocation)
 * IC-ECOS-BUILD-2026-V2 §8.2.
 *
 * The prior specification contained an arithmetic contradiction: it
 * permitted 35 ward wins against 34 available seats with no overhang
 * handling and no tie-break. This module fixes that:
 *
 *   Quota        Q  = floor(totalValidVotes / (totalSeats - indep - noList)) + 1
 *   Entitlement  E  = floor(partyVotes / Q)
 *   PR seats     PR = max(0, E - wardSeatsWon)                // never negative
 *   Excessive    Item 16 as amended by Act 3 of 2021 (in force 1 Nov 2021): a party
 *   seats        whose ward seats are >= its Item 13 entitlement keeps its ward
 *                seats and takes NO list seats; a new quota
 *                floor((A - B) / (C - (D + E))) + 1 is set and the OTHER parties are
 *                counted again with it. The council stays at C. (The earlier rule,
 *                that the council grows, was the pre-2021 text and is gone.)
 *   Ties         equal surpluses: the party with the most valid votes (Item 13(2)(b),
 *                16(4)(c)). Equal surplus AND equal votes: the Act is silent, so the
 *                seat is flagged and left open, never decided by lot or order.
 *
 * The quota formula (session 8) was corrected against a real IEC "Seat
 * Calculation Detail" report — JB Marks Local Municipality (NW405), 2021
 * LGE, supplied by the human. Schedule 1's quota is NOT the Droop quota
 * (totalSeats + 1 in the denominator, this module's original guess) — the
 * real IEC report prints its own formula: "Q = (A / (B - C - D)) + 1",
 * where B is total council seats, C is independent ward winners, and D is
 * ward seats won by parties with no PR list (both deducted from the
 * denominator since they don't participate in PR allocation). Re-running
 * that report's real 9-party, 67-seat result through this module with the
 * corrected formula reproduces every published figure exactly — quota
 * 1,515, all nine parties' round-1 entitlements, remainder ranking, and
 * the two round-2 top-up seats (ANC, Patriotic Alliance) — see
 * seatCalculator.test.ts's "real-world regression" block. `independentWardSeats`
 * and `noPRListWardSeats` default to 0 (the common case, and NW405's own
 * case: C=D=0 there).
 *
 * "Ties never silently resolve" is implemented as: when the largest-
 * remainder round can't unambiguously decide which party(ies) get the last
 * available seat(s), this function stops assigning further remainder seats
 * and reports them as `pendingSeats` + `tieFlags`, rather than picking a
 * winner by any arbitrary rule (array order, party id, etc). No seat is
 * ever silently dropped either: `totalSeatsAllocated + pendingSeats ===
 * councilSizeFinal` always holds — see seatCalculator.test.ts.
 */

import {
  DELIMITATION_VERSION,
  assertSchedule1Applies,
} from '@/modules/reference/municipalRegister';

export interface PartyInput {
  id: string;
  name: string;
  votes: number;
  wardSeatsWon: number;
}

export interface SeatAllocationInput {
  totalValidVotes: number;
  totalSeats: number; // nominal council size before overhang expansion
  parties: PartyInput[];
  /** Ward seats won by independents — deducted from the quota's denominator (Schedule 1's "C"). Default 0. */
  independentWardSeats?: number;
  /** Ward seats won by parties that didn't submit a PR list — deducted from the denominator (Schedule 1's "D"). Default 0. */
  noPRListWardSeats?: number;
  /**
   * The municipality this is being computed for.
   *
   * Supplying it is what makes the calculator refuse to run Schedule 1 on
   * a category C district council, whose seats are allocated under
   * Schedule 2 — a different formula family this build does not
   * implement. Omitted, the calculator is a what-if tool and allocates
   * whatever it is given.
   */
  municipalityCode?: string;
  /**
   * Which delimitation these figures belong to. Ward boundaries and
   * council sizes change between cycles, so a seat figure that does not
   * name the delimitation it was computed against is not reproducible.
   * Defaults to the delimitation proclaimed for 4 November 2026.
   */
  delimitationId?: string;
}

export interface PartyResult {
  id: string;
  name: string;
  votes: number;
  wardSeatsWon: number;
  quotaEntitlement: number;
  remainder: number; // votes - entitlement * quota, for transparency and tie audit
  prSeats: number; // never negative
  /** Ward seats beyond the seats this party is entitled to (informational for an excessive party). */
  overhangSeats: number;
  /** Item 16(1): ward seats equal to or greater than its Item 13 entitlement, so no list seats. */
  excessive: boolean;
  totalSeats: number; // wardSeatsWon + prSeats
}

export interface TieFlag {
  remainder: number;
  partyIds: string[];
  seatsContested: number; // how many seats were left when this tie was hit
}

export interface SeatAllocationResult {
  /** The Item 12 quota. */
  quota: number;
  /** The Item 16(3) quota, when some party had excessive seats and the others were recalculated. */
  newQuota?: number;
  /** Parties that Item 16(1) stopped from taking list seats. */
  excessiveParties: string[];
  /** Plain statements of any interpretation the statute leaves open and that this run relied on. */
  notes: string[];
  councilSizeFinal: number; // totalSeats + total overhang — never smaller than totalSeats
  totalSeatsAllocated: number;
  pendingSeats: number; // seats withheld pending manual tie resolution — never auto-assigned
  parties: PartyResult[];
  tieFlags: TieFlag[];
  /** The delimitation this allocation belongs to. Never blank. */
  delimitationId: string;
}

export function allocateSeats(input: SeatAllocationInput): SeatAllocationResult {
  const {
    totalValidVotes,
    totalSeats,
    parties,
    independentWardSeats = 0,
    noPRListWardSeats = 0,
  } = input;
  if (totalSeats < 1) throw new Error('totalSeats must be at least 1');
  if (totalValidVotes < 0) throw new Error('totalValidVotes cannot be negative');
  // Refuses rather than returning a flag: a caller that ignores a flag
  // still walks away with a number, and a Schedule 1 projection for a
  // district council is exactly the confident wrong answer this product
  // exists not to produce.
  if (input.municipalityCode) assertSchedule1Applies(input.municipalityCode);
  const delimitationId = input.delimitationId ?? DELIMITATION_VERSION.id;
  const notes: string[] = [];

  // Item 12. The IEC's printed B - C - D reduces to the statutory B - C when D = 0.
  const quotaDivisor = totalSeats - independentWardSeats - noPRListWardSeats;
  if (quotaDivisor < 1) {
    throw new Error('independentWardSeats + noPRListWardSeats cannot consume all council seats');
  }
  const quota = Math.floor(totalValidVotes / quotaDivisor) + 1;
  const reservedSeats = independentWardSeats + noPRListWardSeats;

  interface Work extends PartyInput {
    entitlement: number;
    remainder: number;
    remSeats: number;
  }
  const tieFlags: TieFlag[] = [];

  /**
   * Item 13(2): seats left after the whole-quota entitlements go to the
   * parties with the highest surplus, one seat per party per pass. Equal
   * surpluses: the seat goes to the party with the highest number of valid
   * votes (Item 13(2)(b); Item 16(4)(c) repeats it). The Act does not say what
   * happens when the surplus AND the votes are equal, so that case is flagged
   * and the seat left pending, never decided by lot or order.
   */
  function awardSurpluses(group: Work[], seatsToAward: number): number {
    let remaining = seatsToAward;
    outer: while (remaining > 0 && group.length > 0) {
      const ranked = [...group].sort((a, b) => b.remainder - a.remainder || b.votes - a.votes);
      let progressed = false;
      let i = 0;
      while (i < ranked.length && remaining > 0) {
        const tied = ranked
          .slice(i)
          .filter((p) => p.remainder === ranked[i]!.remainder && p.votes === ranked[i]!.votes);
        if (tied.length > remaining) {
          tieFlags.push({
            remainder: ranked[i]!.remainder,
            partyIds: tied.map((p) => p.id),
            seatsContested: remaining,
          });
          break outer;
        }
        for (const p of tied) {
          p.remSeats += 1;
          remaining -= 1;
        }
        progressed = true;
        i += tied.length;
      }
      if (!progressed) break;
    }
    return remaining; // seats left unawarded (only when a tie could not be resolved)
  }

  // ---- Item 13: entitlements and surplus seats, for every party -----------------------------
  const work: Work[] = parties.map((p) => {
    const entitlement = quota > 0 ? Math.floor(p.votes / quota) : 0;
    return { ...p, entitlement, remainder: p.votes - entitlement * quota, remSeats: 0 };
  });
  const surplusSeats = totalSeats - reservedSeats - work.reduce((n, p) => n + p.entitlement, 0);
  let unawarded = awardSurpluses(work, Math.max(0, surplusSeats));

  // ---- Item 16(1): ward seats equal to or greater than the Item 13 entitlement ------------------
  // (A party with no ward seats is never "excessive": 0 is not a seat obtained.)
  const excessive = work.filter(
    (p) => p.wardSeatsWon > 0 && p.wardSeatsWon >= p.entitlement + p.remSeats,
  );
  const excessiveIds = new Set(excessive.map((p) => p.id));

  const result = new Map<
    string,
    { entitlement: number; remainder: number; pr: number; overhang: number }
  >();
  let newQuota: number | undefined;
  let councilSizeFinal = totalSeats;

  if (excessive.length === 0) {
    for (const p of work) {
      const total = p.entitlement + p.remSeats;
      result.set(p.id, {
        entitlement: p.entitlement,
        remainder: p.remainder,
        pr: Math.max(0, total - p.wardSeatsWon),
        overhang: 0,
      });
    }
  } else {
    // ---- Item 16(3)-(7), in force since 1 November 2021 (Act 3 of 2021, s33) -----------------
    // New quota = floor((A - B) / (C - (D + E))) + 1, where B is the excessive party's votes, C
    // the council's seats, D the seats awarded to the excessive party and E the independents.
    // Then every OTHER party is divided by it, surpluses go by Item 16(4), ward seats are
    // deducted (16(6)), and the council stays at C: the excessive party's seats come out of C
    // in the formula instead of the council growing.
    const B = excessive.reduce((n, p) => n + p.votes, 0);
    const D = excessive.reduce((n, p) => n + p.wardSeatsWon, 0);
    const E = independentWardSeats;
    const denominator = totalSeats - (D + E);
    if (excessive.length > 1) {
      notes.push(
        'More than one party had excessive seats. Item 16 is written for one party; they were treated together (their votes and seats summed into B and D).',
      );
    }
    if (noPRListWardSeats > 0) {
      notes.push(
        'Some ward seats belong to parties with no PR list. Item 16(3) has no term for them; the formula was applied as written.',
      );
    }
    if (denominator < 1) {
      // The excessive parties hold every seat that is not an independent's. No quota can be
      // set for anyone else, so nobody else takes a list seat and the council is as large as
      // the ward seats make it. Only a nonsensical input (more ward seats than council seats)
      // reaches this, and it must not crash the page.
      notes.push(
        'The parties with excessive seats hold every seat in the council. No new quota can be set; no other party takes a list seat.',
      );
      for (const p of work) {
        result.set(p.id, {
          entitlement: p.entitlement,
          remainder: p.remainder,
          pr: 0,
          overhang: Math.max(0, p.wardSeatsWon - (p.entitlement + p.remSeats)),
        });
      }
      councilSizeFinal = Math.max(
        totalSeats,
        work.reduce((n, p) => n + p.wardSeatsWon, 0) + reservedSeats,
      );
      return finish();
    }
    newQuota = Math.floor((totalValidVotes - B) / denominator) + 1;
    notes.push(
      'D was taken as the ward seats the excessive party holds ("the number of seats awarded to the party with excessive seats"). The Act does not define D further.',
    );
    const others = work
      .filter((p) => !excessiveIds.has(p.id))
      .map((p) => {
        const entitlement = Math.floor(p.votes / newQuota!);
        return { ...p, entitlement, remainder: p.votes - entitlement * newQuota!, remSeats: 0 };
      });
    const seatsForOthers = totalSeats - D - E;
    unawarded = awardSurpluses(
      others,
      Math.max(0, seatsForOthers - others.reduce((n, p) => n + p.entitlement, 0)),
    );
    let secondaryOverhang = 0;
    for (const p of others) {
      const total = p.entitlement + p.remSeats;
      const overhang = Math.max(0, p.wardSeatsWon - total);
      secondaryOverhang += overhang;
      result.set(p.id, {
        entitlement: p.entitlement,
        remainder: p.remainder,
        pr: Math.max(0, total - p.wardSeatsWon),
        overhang,
      });
    }
    if (secondaryOverhang > 0) {
      notes.push(
        'After the recalculation another party still held more ward seats than its new entitlement. The Act does not say what follows; its ward seats are kept and the council is shown larger than its proclaimed size by that number.',
      );
      councilSizeFinal = totalSeats + secondaryOverhang;
    }
    for (const p of excessive) {
      result.set(p.id, {
        entitlement: p.entitlement,
        remainder: p.remainder,
        pr: 0,
        overhang: p.wardSeatsWon - (p.entitlement + p.remSeats),
      });
    }
  }

  return finish();

  function finish(): SeatAllocationResult {
    const allocatedSoFar =
      parties.reduce((n, p) => n + p.wardSeatsWon + (result.get(p.id)?.pr ?? 0), 0) + reservedSeats;
    const pendingSeats = Math.max(0, councilSizeFinal - allocatedSoFar);
    void unawarded;

    return {
      quota,
      newQuota,
      excessiveParties: excessive.map((p) => p.id),
      notes,
      delimitationId,
      councilSizeFinal,
      totalSeatsAllocated: allocatedSoFar,
      pendingSeats,
      tieFlags,
      parties: parties.map((p) => {
        const r = result.get(p.id)!;
        return {
          id: p.id,
          name: p.name,
          votes: p.votes,
          wardSeatsWon: p.wardSeatsWon,
          quotaEntitlement: r.entitlement,
          remainder: r.remainder,
          prSeats: r.pr,
          overhangSeats: r.overhang,
          excessive: excessiveIds.has(p.id),
          totalSeats: p.wardSeatsWon + r.pr,
        };
      }),
    };
  }
}
