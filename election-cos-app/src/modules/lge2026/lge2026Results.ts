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
import type { SeatAllocationResult } from '@/modules/analytics/seatCalculator';
import {
  councilHoldersOf,
  seatAllocationOf,
  seatInputOf,
  wardOutcomesOf,
  type BallotKey,
  type CouncilHolder,
  type PartyVotes,
  type SeatInput,
  type WardOutcome,
  type WardResult,
} from './councilResults';
import { delimitationFor } from '@/modules/reference/municipalRegister';

export { INDEPENDENT, partyId, partyLabel } from './councilResults';
export type { BallotKey, CouncilHolder, PartyVotes, SeatInput, WardOutcome, WardResult } from './councilResults';
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

export function wardOutcomes(code: string): WardOutcome[] {
  return wardOutcomesOf(municipality(code));
}

/** The council's size from the proclaimed register (throws if the code is not in it). */
function councillors(code: string): number {
  const base = delimitationFor(code);
  if (!base) throw new Error(`${code} is not in the proclaimed register.`);
  return base.councillors;
}

/** The inputs to Schedule 1 exactly as the 2021 reconciliation composes them, from the 2026 ballots. */
export function seatInput(code: string): SeatInput {
  return seatInputOf(municipality(code), councillors(code));
}

/** Schedule 1 over the 2026 ballots. Throws for a district council (Schedule 2, not implemented). */
export function seatAllocation2026(code: string): SeatAllocationResult {
  return seatAllocationOf(municipality(code), councillors(code));
}

export const prShares = (code: string): Array<{ name: string; pct: number; votes: number }> => {
  const m = municipality(code);
  const t = sum(m.parties.pr);
  return m.parties.pr.map(([name, votes]) => ({ name, votes, pct: (votes / t) * 100 }));
};

/** Who holds the council's seats after Schedule 1; see councilHoldersOf. */
export function councilHolders(code: string): CouncilHolder[] {
  return councilHoldersOf(municipality(code), councillors(code));
}
