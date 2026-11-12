/**
 * Election Campaign OS — Schedule 1 over one council's LGE 2026 ballots, for any municipality in the country.
 *
 * Pure functions over a MunicipalityResult (the shape both nw-results.json and the national per-province files carry) and
 * the council's size. `lge2026Results.ts` (North West) and `nationalResults.ts` (all nine provinces) both call these, so
 * there is one implementation of how ballots become seats. The rules are documented in lge2026Results.ts's header: a
 * party's votes are its PR plus its ward votes; independents and ward winners from parties with no PR list sit outside A,
 * as C and D.
 */
import { allocateSeats, type PartyInput, type SeatAllocationResult } from '@/modules/analytics/seatCalculator';

export type PartyVotes = Array<[string, number]>;
export type BallotKey = 'ward' | 'pr' | 'dc40';

export interface WardResult {
  wardId: string;
  wardNumber: number;
  registered: number;
  valid: number;
  spoilt: number;
  parties: PartyVotes;
}

/** What the seat engine needs from a council's results; both data files carry at least this. */
export interface CouncilBallots {
  code: string;
  parties: Record<'ward' | 'pr', PartyVotes>;
  onPrList: string[];
  wardResults: WardResult[];
}

export const INDEPENDENT = 'INDEPENDENT';

/**
 * How the Electoral Commission resolved exact ties for one council (src/data/lge2026/national/tie-resolutions.json).
 * `wards`: ward number to the party it was awarded to, or null where the Commission has not decided. `remainders`: the
 * party (one entry per seat) awarded a remainder seat the engine left pending. The engine itself never breaks a tie.
 */
export interface CouncilTies {
  wards?: Record<number, string | null>;
  remainders?: string[];
}

/** Ids used elsewhere in the build; every other party gets a stable id from its name. */
const KNOWN_IDS: Record<string, string> = {
  'AFRICAN NATIONAL CONGRESS': 'ANC',
  'DEMOCRATIC ALLIANCE': 'DA',
  'ECONOMIC FREEDOM FIGHTERS': 'EFF',
  'PATRIOTIC ALLIANCE': 'PA',
  'VRYHEIDSFRONT PLUS | FREEDOM FRONT PLUS': 'VFP',
  'UMKHONTO WESIZWE PARTY': 'MK',
  'AFRICAN CHRISTIAN DEMOCRATIC PARTY': 'ACDP',
  'AFRICAN TRANSFORMATION MOVEMENT': 'ATM',
  'INKATHA FREEDOM PARTY': 'IFP',
  'SOUTH AFRICAN COMMUNIST PARTY': 'SACP',
  INDEPENDENT: 'IND',
};
export const partyId = (name: string): string =>
  KNOWN_IDS[name] ?? name.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
const SMALL = new Set(['AND', 'OF', 'THE', 'FOR', 'A']);
export const partyLabel = (name: string): string =>
  name
    .toLowerCase()
    .split(/(\s+|\|)/)
    .map((w, i) => (/^[a-z]/.test(w) && (i === 0 || !SMALL.has(w.toUpperCase())) ? w[0].toUpperCase() + w.slice(1) : w))
    .join('')
    .replace(/\bActionsa\b/, 'ActionSA')
    .replace(/\bBaagi\b/, 'BAAGI');

export interface WardOutcome {
  wardNumber: number;
  wardId: string;
  registered: number;
  valid: number;
  spoilt: number;
  winner: string;
  winnerVotes: number;
  runnerUp: string | null;
  runnerUpVotes: number;
  /** Points of the ward's valid vote, first minus second. */
  margin: number;
  /** "INDEPENDENT" leads, but it is several independents merged into one row. */
  independentLeads: boolean;
  /** The top two are level: 'resolved' when the Commission's award is recorded (winner is that party), else 'unresolved'. */
  tie?: 'resolved' | 'unresolved';
}

export function wardOutcomesOf(m: CouncilBallots, ties?: CouncilTies): WardOutcome[] {
  return m.wardResults.map((w) => {
    let [first, second] = w.parties;
    let tie: WardOutcome['tie'];
    if (second && first[1] === second[1]) {
      const awarded = ties?.wards?.[w.wardNumber];
      tie = awarded ? 'resolved' : 'unresolved';
      if (awarded) {
        const a = w.parties.find(([p]) => p === awarded);
        if (!a || a[1] !== first[1]) throw new Error(`${m.code} ward ${w.wardNumber}: ${awarded} is not one of the tied parties`);
        [first, second] = [a, w.parties.find(([p]) => p !== awarded)!];
      }
    }
    return {
      wardNumber: w.wardNumber,
      wardId: w.wardId,
      registered: w.registered,
      valid: w.valid,
      spoilt: w.spoilt,
      winner: first[0],
      winnerVotes: first[1],
      runnerUp: second ? second[0] : null,
      runnerUpVotes: second ? second[1] : 0,
      margin: ((first[1] - (second ? second[1] : 0)) / w.valid) * 100,
      independentLeads: first[0] === INDEPENDENT,
      ...(tie ? { tie } : {}),
    };
  });
}

export interface SeatInput {
  code: string;
  totalValidVotes: number;
  totalSeats: number;
  independentWardSeats: number;
  noPRListWardSeats: number;
  parties: PartyInput[];
  /** Party names whose ward votes are outside A because they filed no PR list. */
  noListParties: string[];
  /** Wards where the merged INDEPENDENT row led (counted as independent wins, see the module header). */
  independentLeadWards: number[];
}

/** The inputs to Schedule 1 exactly as the 2021 reconciliation composes them, from the 2026 ballots. */
export function seatInputOf(m: CouncilBallots, councillors: number, ties?: CouncilTies): SeatInput {
  const onPr = new Set(m.onPrList);
  const votes = new Map<string, number>();
  for (const [p, v] of m.parties.pr) votes.set(p, (votes.get(p) ?? 0) + v);
  for (const [p, v] of m.parties.ward) if (p !== INDEPENDENT && onPr.has(p)) votes.set(p, (votes.get(p) ?? 0) + v);
  const wins = new Map<string, number>();
  const independentLeadWards: number[] = [];
  let independentWardSeats = 0;
  let noPRListWardSeats = 0;
  const noList = new Set<string>();
  for (const w of wardOutcomesOf(m, ties)) {
    if (w.winner === INDEPENDENT) {
      independentWardSeats++;
      independentLeadWards.push(w.wardNumber);
    } else if (!onPr.has(w.winner)) {
      noPRListWardSeats++;
      noList.add(w.winner);
    } else wins.set(w.winner, (wins.get(w.winner) ?? 0) + 1);
  }
  const parties: PartyInput[] = [...votes]
    .filter(([p, v]) => v > 0 || (wins.get(p) ?? 0) > 0)
    .map(([p, v]) => ({ id: partyId(p), name: partyLabel(p), votes: v, wardSeatsWon: wins.get(p) ?? 0 }));
  return {
    code: m.code,
    totalValidVotes: parties.reduce((s, p) => s + p.votes, 0),
    totalSeats: councillors,
    independentWardSeats,
    noPRListWardSeats,
    parties,
    noListParties: [...noList].sort(),
    independentLeadWards,
  };
}

/** Schedule 1 over the council's 2026 ballots. */
export function seatAllocationOf(m: CouncilBallots, councillors: number, ties?: CouncilTies): SeatAllocationResult {
  const i = seatInputOf(m, councillors, ties);
  return allocateSeats({
    totalValidVotes: i.totalValidVotes,
    totalSeats: i.totalSeats,
    independentWardSeats: i.independentWardSeats,
    noPRListWardSeats: i.noPRListWardSeats,
    municipalityCode: m.code,
    parties: i.parties,
  });
}

export interface CouncilHolder {
  id: string;
  name: string;
  seats: number;
  wardSeats: number;
}

/**
 * Who holds the council's seats after Schedule 1: every party with a seat, then independents and parties with no PR list
 * (their ward seats are outside the list allocation). The seats add up to the council's size. Independents are shown as one
 * holder because the Commission publishes them merged; in a real council each decides separately.
 */
export interface PartySeats {
  id: string;
  name: string;
  votes: number;
  totalSeats: number;
  wardSeatsWon: number;
}

/**
 * Each party's seats after Schedule 1, with any remainder seat the engine left pending awarded as the Commission recorded
 * it (`ties.remainders`). `pending` is what is still undecided.
 */
export function partySeatsOf(m: CouncilBallots, councillors: number, ties?: CouncilTies): { parties: PartySeats[]; pending: number } {
  const alloc = seatAllocationOf(m, councillors, ties);
  const parties: PartySeats[] = alloc.parties.map((p) => ({ id: p.id, name: p.name, votes: p.votes, totalSeats: p.totalSeats, wardSeatsWon: p.wardSeatsWon }));
  let pending = alloc.pendingSeats;
  for (const name of ties?.remainders ?? []) {
    if (pending === 0) throw new Error(`${m.code}: a remainder award is recorded but no seat is pending`);
    const p = parties.find((x) => x.id === partyId(name));
    if (!p) throw new Error(`${m.code}: remainder awarded to ${name}, which is not on the PR list`);
    p.totalSeats++;
    pending--;
  }
  return { parties, pending };
}

/**
 * Who holds the council's seats after Schedule 1: every party with a seat, then independents and parties with no PR list
 * (their ward seats are outside the list allocation), then any seat still undecided by a tie. The seats add up to the
 * council's size. Independents are shown as one holder because the Commission publishes them merged; in a real council
 * each decides separately.
 */
export function councilHoldersOf(m: CouncilBallots, councillors: number, ties?: CouncilTies): CouncilHolder[] {
  const { parties, pending } = partySeatsOf(m, councillors, ties);
  const input = seatInputOf(m, councillors, ties);
  const out: CouncilHolder[] = parties
    .filter((p) => p.totalSeats > 0)
    .map((p) => ({ id: p.id, name: p.name, seats: p.totalSeats, wardSeats: p.wardSeatsWon }));
  if (input.independentWardSeats > 0) {
    out.push({ id: 'IND', name: 'Independent ward councillors', seats: input.independentWardSeats, wardSeats: input.independentWardSeats });
  }
  const wins = new Map<string, number>();
  for (const w of wardOutcomesOf(m, ties)) if (input.noListParties.includes(w.winner)) wins.set(w.winner, (wins.get(w.winner) ?? 0) + 1);
  for (const [name, seats] of wins) out.push({ id: partyId(name), name: partyLabel(name), seats, wardSeats: seats });
  out.sort((a, b) => b.seats - a.seats || a.name.localeCompare(b.name));
  if (pending > 0) out.push({ id: 'TIED', name: 'Undecided (tied remainder)', seats: pending, wardSeats: 0 });
  return out;
}
