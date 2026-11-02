/**
 * Election Campaign OS — municipality → ward → voting-district drill-down (data layer).
 *
 * Joins two things that are NOT the same vintage, and says so on the page:
 *  - the 2021 ward-ballot result (winner, runner-up) on the 2021 delimitation, from `wardResults2021`;
 *  - the registered voters and voting districts of the 2026 baseline, from the reference data (122,059 in total).
 * Wards are matched by IEC ward number. That is a stated correspondence, not an identity
 * (`WARD_CORRESPONDENCE_CAVEAT`). "Close" is a display filter on the 2021 margin, set by the person; it is not a
 * forecast and the page never calls it a probability.
 */
import {
  NW405_WARD_RESULTS_2021,
  marginPoints,
  runnerUpShare,
  swingToFlip,
  winnerShare,
  wardSeatsByParty,
  type WardResult2021,
} from '@/modules/analytics/wardResults2021';
import { NW405_2021_EXAMPLE } from '@/modules/analytics/nw405Example';
import { VD_ROWS, WARD_ROWS, type VdRow } from '@/modules/reference/vdReference';

export type SortKey = 'margin' | 'swing' | 'registered' | 'ward';

export const partyName = (id: string): string =>
  id === 'INDEPENDENT' ? 'Independent' : (NW405_2021_EXAMPLE.parties.find((p) => p.id === id)?.name ?? id);

export interface DrillRow {
  wardNumber: number;
  winner: string;
  winnerPct: number;
  runnerUp: string;
  runnerUpPct: number;
  /** First minus second, in points of the ward's valid vote (2021). */
  margin: number;
  /** Two-party swing that would have changed the 2021 result. */
  swing: number;
  registered: number;
  close: boolean;
}

const registeredByWard = new Map(WARD_ROWS.map((w) => [w.wardNumber, w.registered]));

export function drillRows(thresholdPoints: number, sort: SortKey): DrillRow[] {
  const rows = NW405_WARD_RESULTS_2021.wards.map<DrillRow>((w: WardResult2021) => ({
    wardNumber: w.wardNumber,
    winner: partyName(w.winnerPartyId),
    winnerPct: winnerShare(w),
    runnerUp: partyName(w.runnerUpPartyId),
    runnerUpPct: runnerUpShare(w),
    margin: marginPoints(w),
    swing: swingToFlip(w),
    registered: registeredByWard.get(w.wardNumber) ?? 0,
    close: marginPoints(w) < thresholdPoints,
  }));
  const by: Record<SortKey, (a: DrillRow, b: DrillRow) => number> = {
    margin: (a, b) => a.margin - b.margin,
    swing: (a, b) => a.swing - b.swing,
    registered: (a, b) => b.registered - a.registered,
    ward: (a, b) => a.wardNumber - b.wardNumber,
  };
  return rows.sort((a, b) => by[sort](a, b) || a.wardNumber - b.wardNumber);
}

export const seatsWon2021 = (): Array<[string, number]> =>
  Object.entries(wardSeatsByParty())
    .map(([id, n]) => [partyName(id), n] as [string, number])
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

export const votingDistrictsOf = (ward: number): VdRow[] => VD_ROWS.filter((r) => r.wardNumber === ward);
