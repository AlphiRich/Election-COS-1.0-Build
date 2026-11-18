/**
 * Election Campaign OS — JB Marks council seats over three elections: 2016, 2021 and 2026.
 *
 * From the supplied "ECOS JB Marks dashboard" export, whose "Ten years of seats" panel this replaces. Its 2016 figures came
 * with no source file; they are taken here from the Commission's own 2016 North West results
 * (`src/data/lge2016/nw405-2016.json`, built by `electoral/iec_etl_pipeline.py` from source `iec-lge-2016-nw-vd-results`,
 * SHA-256 recorded) and matched the export exactly. `seatHistory.test.ts` recomputes them in TypeScript with the same
 * Schedule 1 engine the rest of the app uses, so a wrong vote total or ward count fails the build.
 *
 * Each year is its own delimitation (JB Marks was formed in 2016 from Tlokwe and Ventersdorp; wards were redrawn for 2021 and
 * 2026). The council has had 67 seats and 34 wards at all three, so seat counts compare directly; ward NUMBERS do not.
 *
 * - 2016: the Commission's party results, seats by Schedule 1 (above).
 * - 2021: the published Seat Calculation Detail (`nw405Example.ts`), seats by the same engine.
 * - 2026: the certified result (`modules/lge2026`).
 *
 * "Independent Councillors" in 2016 is a registered party with a list, not independent candidates.
 */
import raw2016 from '@/data/lge2016/nw405-2016.json';
import { allocateSeats } from './seatCalculator';
import { NW405_2021_EXAMPLE } from './nw405Example';
import { councilHolders } from '@/modules/lge2026/lge2026Results';

export interface Result2016Party {
  id: string;
  name: string;
  iecName: string;
  votes: number;
  wardSeatsWon: number;
  listSeats: number;
  totalSeats: number;
}

export interface Result2016 {
  source: string;
  url: string;
  sourceId: string;
  sha256: string;
  totalSeats: number;
  wards: number;
  registeredVoters: number;
  totalValidVotes: number;
  quota: number;
  independentWardSeats: number;
  noPRListWardSeats: number;
  parties: Result2016Party[];
}

export const NW405_2016 = raw2016 as Result2016;

export const HISTORY_YEARS = [2016, 2021, 2026] as const;
export type HistoryYear = (typeof HISTORY_YEARS)[number];

export interface SeatHistoryRow {
  id: string;
  name: string;
  seats: Record<HistoryYear, number>;
  wardSeats: Record<HistoryYear, number>;
}

export interface SeatHistory {
  totalSeats: number;
  majority: number;
  rows: SeatHistoryRow[];
  /** The largest party's seats in each year, against the majority line. */
  largest: Record<HistoryYear, { id: string; seats: number }>;
}

function seats2021() {
  const r = allocateSeats({
    totalValidVotes: NW405_2021_EXAMPLE.totalValidVotes,
    totalSeats: NW405_2021_EXAMPLE.totalSeats,
    independentWardSeats: NW405_2021_EXAMPLE.independentWardSeats,
    noPRListWardSeats: NW405_2021_EXAMPLE.noPRListWardSeats,
    parties: NW405_2021_EXAMPLE.parties,
  });
  return r.parties.map((p) => ({ id: p.id, name: p.name, seats: p.totalSeats, wardSeats: p.wardSeatsWon }));
}

/** Every party that held a seat in any of the three councils, largest in 2026 first. */
export function seatHistoryNW405(): SeatHistory {
  const byYear: Record<HistoryYear, Array<{ id: string; name: string; seats: number; wardSeats: number }>> = {
    2016: NW405_2016.parties.map((p) => ({ id: p.id, name: p.name, seats: p.totalSeats, wardSeats: p.wardSeatsWon })),
    2021: seats2021(),
    2026: councilHolders('NW405').map((h) => ({ id: h.id, name: h.name, seats: h.seats, wardSeats: h.wardSeats })),
  };
  const rows = new Map<string, SeatHistoryRow>();
  for (const year of HISTORY_YEARS) {
    for (const p of byYear[year]) {
      const row = rows.get(p.id) ?? { id: p.id, name: p.name, seats: { 2016: 0, 2021: 0, 2026: 0 }, wardSeats: { 2016: 0, 2021: 0, 2026: 0 } };
      row.name = p.name; // the latest name the party stood under
      row.seats[year] = p.seats;
      row.wardSeats[year] = p.wardSeats;
      rows.set(p.id, row);
    }
  }
  const held = [...rows.values()].filter((r) => HISTORY_YEARS.some((y) => r.seats[y] > 0));
  held.sort((a, b) => b.seats[2026] - a.seats[2026] || b.seats[2021] - a.seats[2021] || b.seats[2016] - a.seats[2016]);
  const largest = Object.fromEntries(
    HISTORY_YEARS.map((y) => {
      const top = [...held].sort((a, b) => b.seats[y] - a.seats[y])[0];
      return [y, { id: top.id, seats: top.seats[y] }];
    }),
  ) as SeatHistory['largest'];
  return { totalSeats: NW405_2016.totalSeats, majority: Math.floor(NW405_2016.totalSeats / 2) + 1, rows: held, largest };
}
