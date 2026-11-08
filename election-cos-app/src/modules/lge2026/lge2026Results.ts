/**
 * Election Campaign OS — the LGE 2026 results for the North West (18 local municipalities and the 4 district councils).
 *
 * SOURCE. The Electoral Commission's "Downloadable Party Results" files for election EEID1887, one per municipality,
 * reduced by `scripts/build-lge2026-results.mjs` to counts per ballot, party and ward (`src/data/lge2026/nw-results.json`),
 * with every source file's SHA-256 in `manifest.json`. The Commission's own "Seat Calculation Detail" reports were read
 * into `seat-calculation-iec.json` by `tools/lge2026/extract-seat-calculation.py`, and `lge2026Results.test.ts` requires
 * this build's Schedule 1 engine to reproduce them: quota, every party's seats, and the ward/list split.
 *
 * WHAT A PARTY'S VOTES ARE. As in the verified 2021 reconciliation (`seatCalculator.nw405-2021.test.ts`): a party's votes
 * are its PR-ballot votes plus its ward-ballot votes, and A is the sum over parties on the PR list. Independents and
 * parties with no PR list are outside A; their ward seats are C and D.
 *
 * DISTRICT COUNCILS have no results file of their own: their 40% PR seats are voted on through the "DC 40%" ballot in each
 * local municipality, so a district's figures are the sum over its members. Their seats are allocated under Schedule 2,
 * which this build does not implement (the engine refuses a category C code), so only votes are shown for districts.
 *
 * INDEPENDENTS ARE MERGED. The Commission publishes ONE "INDEPENDENT" row per voting district, so where it leads a ward the
 * build cannot say the ward was won by a single named candidate. `independentLeads` marks those wards.
 */
import raw from '@/data/lge2026/nw-results.json';
import manifestRaw from '@/data/lge2026/manifest.json';
import { allocateSeats, type PartyInput, type SeatAllocationResult } from '@/modules/analytics/seatCalculator';
import { delimitationFor } from '@/modules/reference/municipalRegister';

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
export interface VdDetail {
  wardId: string;
  vd: string;
  station: string;
  registered: number;
  ballots: Partial<Record<BallotKey, { spoilt: number; parties: PartyVotes }>>;
}
export interface MunicipalityResult {
  code: string;
  name: string;
  wards: number;
  votingDistricts: number;
  registered: number;
  ballots: Record<BallotKey, { valid: number; spoilt: number }>;
  parties: Record<BallotKey, PartyVotes>;
  onPrList: string[];
  wardResults: WardResult[];
  votingDistrictDetail?: VdDetail[];
}
export interface DistrictResult {
  code: string;
  members: string[];
  registered: number;
  dc40: { valid: number; spoilt: number };
  parties: PartyVotes;
}
interface Data {
  source: { eventId: string; publisher: string; retrieved: string; note: string };
  municipalities: Record<string, MunicipalityResult>;
  districts: Record<string, DistrictResult>;
}
export interface SourceFile {
  code: string;
  sha256: string;
  bytes: number;
  rows: number;
  generatedFrom: string;
  generatedTo: string;
}
export interface Manifest {
  eventId: string;
  files: SourceFile[];
  crosscheck: {
    provinceFile: { sha256: string; bytes: number; rows: number; generated: string[] } | null;
    differing: number;
    differingMunicipalities: Record<string, string[]>;
    onlyInMunicipalityFiles: number;
    onlyInProvince: number;
    note: string;
  };
}

export const LGE2026 = raw as unknown as Data;
export const LGE2026_MANIFEST = manifestRaw as unknown as Manifest;
export const INDEPENDENT = 'INDEPENDENT';
export const MUNICIPALITY_CODES = Object.keys(LGE2026.municipalities).sort();
export const DISTRICT_CODES = Object.keys(LGE2026.districts).sort();

export const municipality = (code: string): MunicipalityResult => {
  const m = LGE2026.municipalities[code];
  if (!m) throw new Error(`No LGE 2026 result for ${code}.`);
  return m;
};
export const district = (code: string): DistrictResult => {
  const d = LGE2026.districts[code];
  if (!d) throw new Error(`No LGE 2026 district result for ${code}.`);
  return d;
};

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

const sum = (xs: PartyVotes) => xs.reduce((s, [, v]) => s + v, 0);

export interface Turnout {
  registered: number;
  valid: number;
  spoilt: number;
  cast: number;
  /** Cast / registered on THIS ballot. Ballots are never added together (docs: turnout is per ballot). */
  pct: number;
}
/** The registered figure here is the Commission's own, per voting district, as printed with the results. */
export function turnout(code: string, ballot: BallotKey): Turnout {
  const m = municipality(code);
  const b = m.ballots[ballot];
  const cast = b.valid + b.spoilt;
  return { registered: m.registered, valid: b.valid, spoilt: b.spoilt, cast, pct: (cast / m.registered) * 100 };
}

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
}

export function wardOutcomes(code: string): WardOutcome[] {
  return municipality(code).wardResults.map((w) => {
    const [first, second] = w.parties;
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
export function seatInput(code: string): SeatInput {
  const m = municipality(code);
  const base = delimitationFor(code);
  if (!base) throw new Error(`${code} is not in the proclaimed register.`);
  const onPr = new Set(m.onPrList);
  const votes = new Map<string, number>();
  for (const [p, v] of m.parties.pr) votes.set(p, (votes.get(p) ?? 0) + v);
  for (const [p, v] of m.parties.ward) if (p !== INDEPENDENT && onPr.has(p)) votes.set(p, (votes.get(p) ?? 0) + v);
  const wins = new Map<string, number>();
  const independentLeadWards: number[] = [];
  let independentWardSeats = 0;
  let noPRListWardSeats = 0;
  const noList = new Set<string>();
  for (const w of wardOutcomes(code)) {
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
    code,
    totalValidVotes: parties.reduce((s, p) => s + p.votes, 0),
    totalSeats: base.councillors,
    independentWardSeats,
    noPRListWardSeats,
    parties,
    noListParties: [...noList].sort(),
    independentLeadWards,
  };
}

/** Schedule 1 over the 2026 ballots. Throws for a district council (Schedule 2, not implemented). */
export function seatAllocation2026(code: string): SeatAllocationResult {
  const i = seatInput(code);
  return allocateSeats({
    totalValidVotes: i.totalValidVotes,
    totalSeats: i.totalSeats,
    independentWardSeats: i.independentWardSeats,
    noPRListWardSeats: i.noPRListWardSeats,
    municipalityCode: code,
    parties: i.parties,
  });
}

export const prShares = (code: string): Array<{ name: string; pct: number; votes: number }> => {
  const m = municipality(code);
  const t = sum(m.parties.pr);
  return m.parties.pr.map(([name, votes]) => ({ name, votes, pct: (votes / t) * 100 }));
};

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
export function councilHolders(code: string): CouncilHolder[] {
  const alloc = seatAllocation2026(code);
  const input = seatInput(code);
  const out: CouncilHolder[] = alloc.parties
    .filter((p) => p.totalSeats > 0)
    .map((p) => ({ id: p.id, name: p.name, seats: p.totalSeats, wardSeats: p.wardSeatsWon }));
  if (input.independentWardSeats > 0) {
    out.push({ id: 'IND', name: 'Independent ward councillors', seats: input.independentWardSeats, wardSeats: input.independentWardSeats });
  }
  const wins = new Map<string, number>();
  for (const w of wardOutcomes(code)) if (input.noListParties.includes(w.winner)) wins.set(w.winner, (wins.get(w.winner) ?? 0) + 1);
  for (const [name, seats] of wins) out.push({ id: partyId(name), name: partyLabel(name), seats, wardSeats: seats });
  return out.sort((a, b) => b.seats - a.seats || a.name.localeCompare(b.name));
}
