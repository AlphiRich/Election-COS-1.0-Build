/**
 * Election Campaign OS — public site, JB Marks ward and voting-station finder
 *
 * Searches the ward and voting-district records transcribed from the
 * Municipal Demarcation Board's delimitation notice for JB Marks Local
 * Municipality (NW405): North West Provincial Gazette, Extraordinary,
 * Vol 268 No. 8929, 18 November 2025, Provincial Notice 1300 of 2025. See
 * `docs/nw405-seed-data.md`.
 *
 * It exists for one municipality because that is the only one this build
 * holds ward and station records for. Anything else is sent to the
 * Electoral Commission rather than guessed at.
 *
 * Registered-voter counts here are the delimitation's, not today's roll,
 * and are labelled that way on the page.
 */
import seed from '../../../seed-data/jb-marks-nw405-wards-vds.json';

interface SeedWard {
  ward: { wardCode: string; name: string; registeredVoters: number };
  votingDistricts: Array<{ vdCode: string; name: string; registeredVoters: number; _split: boolean }>;
}

export interface StationHit {
  wardNumber: number;
  wardName: string;
  wardVoters: number;
  stationName: string;
  vdCode: string;
  stationVoters: number;
  /** A station split across wards is listed once per ward. */
  splitAcrossWards: boolean;
}

const DATA = seed as SeedWard[];

export const JB_MARKS_SOURCE =
  'North West Provincial Gazette, Extraordinary, Vol 268 No. 8929, 18 November 2025 — Provincial Notice 1300 of 2025 (Municipal Demarcation Board).';

export const JB_MARKS_WARD_COUNT = DATA.length;

function wardNumber(wardCode: string): number {
  const m = /W(\d+)$/.exec(wardCode);
  return m ? Number(m[1]) : NaN;
}

const ALL: StationHit[] = DATA.flatMap((w) =>
  w.votingDistricts.map((v) => ({
    wardNumber: wardNumber(w.ward.wardCode),
    wardName: w.ward.name,
    wardVoters: w.ward.registeredVoters,
    stationName: v.name,
    vdCode: v.vdCode,
    stationVoters: v.registeredVoters,
    splitAcrossWards: v._split,
  })),
);

/**
 * Stations matching a query. A number matches a ward number exactly (so
 * "3" finds Ward 3, not Ward 13); anything else matches station name or
 * voting-district code. Sorted by ward number, then station name — never
 * as strings, which would put Ward 10 before Ward 2.
 */
export function findStations(query: string): StationHit[] {
  const q = query.trim().toLowerCase();
  if (q === '') return [];
  const asNumber = /^\d{1,3}$/.test(q) ? Number(q) : null;
  const hits = ALL.filter((s) =>
    asNumber !== null
      ? s.wardNumber === asNumber
      : s.stationName.toLowerCase().includes(q) || s.vdCode.includes(q),
  );
  return hits.sort((a, b) => a.wardNumber - b.wardNumber || a.stationName.localeCompare(b.stationName));
}
