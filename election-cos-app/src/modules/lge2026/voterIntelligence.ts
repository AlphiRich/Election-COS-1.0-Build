/**
 * Election Campaign OS — the Voter Intelligence Instrument, for any council.
 *
 * The supplied "JB Marks Voter Intelligence" page was a one-municipality sheet with figures typed in and many labelled
 * "sample / illustrative". This is the same instrument computed from the certified LGE 2026 results for ANY of the 213
 * metro and local councils: nothing is typed per municipality.
 *
 * WHAT IT COMPUTES (all from src/data/lge2026, reconciled with the Commission's Seat Calculation reports)
 *  - the council: seats, wards, list seats, majority threshold, who holds what, whether it is hung, registered and turnout;
 *  - coalition arithmetic: every MINIMAL winning combination of parties (a majority that loses it if any member leaves);
 *  - the ward map: ward leader, its share and its margin over the runner-up, in the instrument's tiers;
 *  - competitive wards (margin under 10 points) and how much of the electorate sits in them.
 *
 * WHAT IT DELIBERATELY DOES NOT HAVE, and says so
 *  - Demographics (race, age, gender): not in this build, and the supplied estimates had no stated source.
 *  - "Psychographic voter segments": not derivable from results, and race-linked profiling of voters is the kind of
 *    thing POPIA treats as special personal information. Omitted rather than guessed.
 *  - Special-vote counts and any trend before 2021: not ingested.
 * A figure is either computed here from the Commission's results or absent.
 */
import { council, loadProvince, majorityOf, type CouncilSeats } from './nationalResults';
import { INDEPENDENT, partyLabel } from './councilResults';

export type WardTier = 'Safe' | 'Comfortable' | 'Marginal' | 'Contested';
export interface WardLine {
  ward: number;
  leader: string;
  leaderShare: number;
  runnerUp: string | null;
  margin: number; // percentage points, leader minus runner-up
  tier: WardTier;
  registered: number;
  valid: number;
}
export interface Coalition {
  parties: string[];
  seats: number;
  surplus: number; // seats above the majority line
}
export interface VoterIntelligence {
  code: string;
  name: string;
  province: string;
  seats: CouncilSeats;
  majority: number;
  topHolder: { name: string; seats: number } | null;
  shortOfMajority: number | null; // how far the biggest party is from the line; null when it holds one
  coalitions: Coalition[];
  wards: WardLine[];
  tierCounts: Record<WardTier, number>;
  wardsLedBy: Array<{ party: string; wards: number }>;
  competitive: { wards: number[]; electorateShare: number };
  iecStatus: CouncilSeats['iec'];
  source: string;
  /** Where the ward figures were read from: the election database, or the results bundled with the app. */
  wardData: 'database' | 'bundled';
}

/** One ward's figures, as either source supplies them. */
export interface WardRow {
  wardNumber: number;
  registered: number;
  valid: number;
  parties: ReadonlyArray<readonly [string, number]>;
}
/** Supplies a council's wards from the database, or null to use the bundled results. */
export type WardSource = (code: string) => Promise<WardRow[] | null>;

/** The instrument's tiers, by the leader's share of the ward's valid votes. */
export const tierOf = (share: number): WardTier => (share > 60 ? 'Safe' : share > 50 ? 'Comfortable' : share >= 40 ? 'Marginal' : 'Contested');

/**
 * Every minimal winning combination: parties whose seats together reach the majority, with no member that could leave
 * and still leave a majority. Parties are taken from the seat holders; independents are one holder and are left out,
 * because independents do not act as a bloc. Fewest parties first (the simplest deals), then smallest surplus.
 */
export function minimalCoalitions(holders: Array<{ name: string; seats: number }>, majority: number, limit = 12): Coalition[] {
  const ps = holders.filter((h) => h.seats > 0).slice(0, 14); // 2^14 subsets is the ceiling; councils have fewer parties
  const out: Coalition[] = [];
  const n = ps.length;
  for (let mask = 1; mask < 1 << n; mask++) {
    const members = ps.filter((_, i) => mask & (1 << i));
    const seats = members.reduce((s, p) => s + p.seats, 0);
    if (seats < majority) continue;
    const minimal = members.every((m) => seats - m.seats < majority);
    if (minimal) out.push({ parties: members.map((m) => m.name), seats, surplus: seats - majority });
  }
  return out.sort((a, b) => a.parties.length - b.parties.length || a.surplus - b.surplus || a.parties.join().localeCompare(b.parties.join())).slice(0, limit);
}

export async function voterIntelligence(code: string, wardSource?: WardSource): Promise<VoterIntelligence> {
  const seats = council(code);
  // The database is used only if it returns exactly the council's wards, each with votes. Anything else (a partial load, an
  // older delimitation) falls back to the bundled results instead of drawing a wrong map.
  let rows: WardRow[] | null = null;
  let wardData: VoterIntelligence['wardData'] = 'database';
  try {
    rows = (await wardSource?.(code)) ?? null;
  } catch {
    rows = null;
  }
  if (rows && (rows.length !== seats.wards || rows.some((r) => !r.parties.length))) rows = null;
  if (!rows) {
    wardData = 'bundled';
    const province = await loadProvince(seats.province);
    const full = province.municipalities[code];
    if (!full) throw new Error(`${code} is in the seat table but not in the ${seats.province} results file.`);
    rows = full.wardResults;
  }

  const wards: WardLine[] = rows.map((w) => {
    const sorted = [...w.parties].sort((a, b) => b[1] - a[1]);
    const [first, second] = sorted;
    const total = w.valid || sorted.reduce((s, [, v]) => s + v, 0);
    const share = first ? (first[1] / total) * 100 : 0;
    const margin = first ? ((first[1] - (second?.[1] ?? 0)) / total) * 100 : 0;
    return { ward: w.wardNumber, leader: first ? first[0] : '—', leaderShare: share, runnerUp: second ? second[0] : null, margin, tier: tierOf(share), registered: w.registered, valid: w.valid };
  }).sort((a, b) => a.ward - b.ward);

  const tierCounts: Record<WardTier, number> = { Safe: 0, Comfortable: 0, Marginal: 0, Contested: 0 };
  for (const w of wards) tierCounts[w.tier]++;
  const ledBy = new Map<string, number>();
  for (const w of wards) ledBy.set(w.leader, (ledBy.get(w.leader) ?? 0) + 1);
  const registeredAll = wards.reduce((s, w) => s + w.registered, 0);
  const competitiveWards = wards.filter((w) => w.margin < 10);

  const majority = majorityOf(seats.councillors);
  const real = seats.holders.filter((h) => h.id !== 'IND' && h.seats > 0).map((h) => ({ name: h.name, seats: h.seats }));
  const top = [...seats.holders].sort((a, b) => b.seats - a.seats)[0] ?? null;

  return {
    code,
    name: seats.name,
    province: seats.province,
    seats,
    majority,
    topHolder: top ? { name: top.name, seats: top.seats } : null,
    shortOfMajority: top && top.seats < majority ? majority - top.seats : null,
    coalitions: seats.hung ? minimalCoalitions(real, majority) : [],
    wards,
    tierCounts,
    wardsLedBy: [...ledBy].map(([party, n]) => ({ party, wards: n })).sort((a, b) => b.wards - a.wards || a.party.localeCompare(b.party)),
    competitive: { wards: competitiveWards.map((w) => w.ward), electorateShare: registeredAll ? (competitiveWards.reduce((s, w) => s + w.registered, 0) / registeredAll) * 100 : 0 },
    iecStatus: seats.iec,
    wardData,
    source: `Electoral Commission LGE 2026 certified results (EEID1887); seats by Schedule 1, ${seats.iec} against the Commission's Seat Calculation Detail`,
  };
}

export const partyName = (p: string): string => (p === INDEPENDENT ? 'Independents (merged by the Commission)' : partyLabel(p));
