/**
 * Election Campaign OS — the LGE 2026 results for every metro, local and district council in South Africa.
 *
 * SOURCE. The Electoral Commission's "Downloadable Party Results" file for each of the 213 contested metro and local
 * councils (election EEID1887), reduced by `scripts/build-lge2026-national.mjs` to counts per ballot, party and ward, one
 * file per province in `src/data/lge2026/national/<PROV>.json`, with every source file's SHA-256 in `manifest.json`.
 * The Commission's "Seat Calculation Detail" report for each council is in `seat-calculation-iec.json`;
 * `nationalResults.test.ts` requires this build's Schedule 1 engine to reproduce every published one.
 *
 * Seats come from the same engine as the North West module (`councilResults.ts`). A council's status says how far its
 * figure is confirmed: `reconciled` (the engine reproduces the Commission's report party by party), `notPublished` (the
 * Commission's report says "No data available"), or `incomplete` (the Commission's report allocates fewer seats than the
 * council has; the engine's figure is shown, labelled).
 *
 * The province files are large (150-800 KB each) and are loaded on demand with `loadProvince`; the compact national seat
 * table (`seats-2026.json`, built by `scripts/build-lge2026-national-seats.ts`) is what the Coalition Tracker reads.
 */
import type { CouncilBallots, CouncilHolder, PartyVotes } from './councilResults';
import seatsRaw from '@/data/lge2026/national/seats-2026.json';

/** The Commission's own province folder codes in its results URLs. */
export const PROVINCES = {
  EC: 'Eastern Cape',
  FS: 'Free State',
  GP: 'Gauteng',
  KN: 'KwaZulu-Natal',
  NP: 'Limpopo',
  MP: 'Mpumalanga',
  NC: 'Northern Cape',
  NW: 'North West',
  WP: 'Western Cape',
} as const;
export type ProvinceCode = keyof typeof PROVINCES;
export const PROVINCE_CODES = Object.keys(PROVINCES) as ProvinceCode[];

export interface NationalCouncil extends CouncilBallots {
  name: string;
  category: 'A' | 'B';
  district: string | null;
  councillors: number;
  wards: number;
  votingDistricts: number;
  registered: number;
  ballots: Record<'ward' | 'pr' | 'dc40', { valid: number; spoilt: number }>;
  parties: Record<'ward' | 'pr' | 'dc40', PartyVotes>;
  /** Wards where a voting district has PR results but no ward-ballot result in the Commission's file. */
  wardBallotGaps?: Array<{ wardId: string; wardNumber: number; votingDistrictsWithoutWardResult: number; registeredNotInWard: number }>;
}
export interface NationalDistrict {
  code: string;
  name: string;
  councillors: number;
  members: string[];
  registered: number;
  dc40: { valid: number; spoilt: number };
  parties: PartyVotes;
}
export interface ProvinceFile {
  source: { eventId: string; publisher: string; retrieved: string; note: string };
  province: ProvinceCode;
  municipalities: Record<string, NationalCouncil>;
  districts: Record<string, NationalDistrict>;
}

const files = import.meta.glob<ProvinceFile>('@/data/lge2026/national/[A-Z][A-Z].json', { import: 'default' });

/** One province's full results (ward by ward). Loaded on demand: the files are too large to bundle together. */
export async function loadProvince(code: ProvinceCode): Promise<ProvinceFile> {
  const key = Object.keys(files).find((k) => k.endsWith(`/${code}.json`));
  if (!key) throw new Error(`No LGE 2026 results file for province ${code}.`);
  return files[key]();
}

/**
 * How far the Commission's own Seat Calculation Detail report confirms a council's seats:
 *  - reconciled: this build's Schedule 1 reproduces the report party by party;
 *  - laterCount: the report was computed on a later count than the downloadable results file; the seats shown are the
 *    report's, matched to parties by rank of votes (reconcile.ts, holdersFromIecReport);
 *  - incomplete: the report allocates fewer seats than the council has; this build's figure is shown, labelled;
 *  - notPublished: the report says "No data available"; this build's figure is shown, labelled.
 */
export type IecStatus = 'reconciled' | 'laterCount' | 'incomplete' | 'notPublished';

/** One council in the compact national seat table. */
export interface CouncilSeats {
  code: string;
  name: string;
  province: ProvinceCode;
  category: 'A' | 'B';
  district: string | null;
  councillors: number;
  wards: number;
  registered: number;
  /** Cast / registered on the PR ballot, as a percentage. */
  turnoutPr: number;
  holders: CouncilHolder[];
  /** Seats needed for a majority of the council: floor(councillors / 2) + 1. */
  majority: number;
  /** No single holder has a majority. */
  hung: boolean;
  iec: IecStatus;
  /** Only when iec is 'incomplete': seats the Commission's report leaves unallocated. */
  iecUnallocated?: number;
  /** Wards whose top two were level, and how each was settled (tie-resolutions.json). */
  tiedWards?: Array<{ ward: number; awardedTo: string | null }>;
}
export interface NationalSeats {
  source: string;
  retrieved: string;
  councils: Record<string, CouncilSeats>;
}

export type WardCouncillorStatus = 'elected' | 'independentNamed' | 'independentUnnamed' | 'tieUnresolved' | 'countIncomplete' | 'noMatch';
export interface WardCouncillor {
  ward: number;
  wardId: string;
  /** The winning party as the Commission prints it ("INDEPENDENT" where independents led). */
  party: string;
  /** Null unless status is 'elected' or 'independentNamed'. */
  name: string | null;
  status: WardCouncillorStatus;
  /** Points of the ward's valid vote between first and second. */
  margin: number;
  votes: number;
  valid: number;
}
export interface PrCouncillor {
  party: string;
  rank: number;
  name: string;
}
/** List seats a party won but cannot fill from its certified list: the Commission's "(PF) Potential Forfeiture". */
export interface VacantSeats {
  party: string;
  listSeats: number;
  filled: number;
  vacant: number;
}
export interface CouncilCouncillors {
  code: string;
  ward: WardCouncillor[];
  pr: PrCouncillor[];
  vacant: VacantSeats[];
}
export interface CouncillorsFile {
  source: string;
  lists: Array<{ province: string; url: string; sha256: string; fetchedOn: string; supplemented: boolean }>;
  councils: Record<string, CouncilCouncillors>;
}

/** Everyone elected to the 213 councils (about 1 MB), loaded on demand. Built by scripts/build-lge2026-councillors.ts. */
export async function loadCouncillors(): Promise<CouncillorsFile> {
  return (await import('@/data/lge2026/national/councillors-2026.json')).default as unknown as CouncillorsFile;
}

export const NATIONAL_SEATS = seatsRaw as unknown as NationalSeats;
export const COUNCIL_CODES = Object.keys(NATIONAL_SEATS.councils).sort();

export const majorityOf = (councillors: number): number => Math.floor(councillors / 2) + 1;

export function council(code: string): CouncilSeats {
  const c = NATIONAL_SEATS.councils[code];
  if (!c) throw new Error(`No LGE 2026 council ${code}.`);
  return c;
}

export interface NationalSummary {
  councils: number;
  hung: number;
  majority: number;
  byProvince: Record<ProvinceCode, { councils: number; hung: number }>;
}
export function nationalSummary(): NationalSummary {
  const byProvince = Object.fromEntries(PROVINCE_CODES.map((p) => [p, { councils: 0, hung: 0 }])) as NationalSummary['byProvince'];
  let hung = 0;
  for (const c of Object.values(NATIONAL_SEATS.councils)) {
    byProvince[c.province].councils++;
    if (c.hung) {
      hung++;
      byProvince[c.province].hung++;
    }
  }
  const councils = COUNCIL_CODES.length;
  return { councils, hung, majority: councils - hung, byProvince };
}
