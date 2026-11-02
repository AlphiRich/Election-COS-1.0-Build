/**
 * Election Campaign OS — the NW405 voting-district reference (VD locator and voter statistics).
 *
 * Built from the certified roll by `scripts/build-reference-data.mjs`: counts only, no person. Age bands come from
 * the masked ID's first six digits (see that script); sex cannot be derived; cells under 10 are hidden.
 *
 * TWO NUMBERS FOR "HOW MANY VOTERS", AND THEY DISAGREE. `verified` is the certified roll's count for the district.
 * `registeredSeed` is the figure in the delimitation seed (the gazette's registered voters, split by ward portion).
 * The municipality totals differ (131,963 on the roll; 122,059 in the seed) and a split district's seed figure is
 * a ward portion. Both are shown, labelled, and neither is "corrected" to match the other. A person decides which
 * figure the campaign quotes (SOP-14).
 */
import raw from '@/data/reference/nw405-vd-reference.json';

export const AGE_BANDS = ['18-29', '30-39', '40-49', '50-59', '60-69', '70+'] as const;
export type AgeBand = (typeof AGE_BANDS)[number];
export type AgeBands = Record<AgeBand, number | null>;

export interface VdRow {
  wardCode: string;
  wardNumber: number;
  vdCode: string;
  station: string;
  registeredSeed: number | null;
  verified: number;
  rejected: number;
  ageBands: AgeBands;
  ageUnplaced: number | null;
}
export interface WardRow {
  wardNumber: number;
  verified: number;
  rejected: number;
  ageBands: AgeBands;
}
interface Reference {
  municipalityCode: string;
  generatedFrom: string;
  rollEdition: string;
  ageAt: string;
  minCell: number;
  ageBandsNote: string;
  reconciliation: { vdsCompared: number; vdsNotMatchingCommissionTotals: number };
  totals: { verified: number; rejected: number; wardVdRows: number };
  wards: Record<string, WardRow>;
  voterDistricts: VdRow[];
}

export const VD_REFERENCE = raw as unknown as Reference;
export const VD_ROWS: VdRow[] = VD_REFERENCE.voterDistricts;
export const WARD_ROWS: Array<WardRow & { wardCode: string }> = Object.entries(VD_REFERENCE.wards)
  .map(([wardCode, w]) => ({ wardCode, ...w }))
  .sort((a, b) => a.wardNumber - b.wardNumber);

/** Sum a band across rows; null if any row hides it (a partial sum would understate and look exact). */
export function sumBand(rows: Array<{ ageBands: AgeBands }>, band: AgeBand): number | null {
  let t = 0;
  for (const r of rows) {
    const v = r.ageBands[band];
    if (v === null) return null;
    t += v;
  }
  return t;
}

/** Share of a ward's age-banded voters in a band, or null when any cell needed is hidden. */
export function bandShare(w: { ageBands: AgeBands }, band: AgeBand): number | null {
  const cells = AGE_BANDS.map((b) => w.ageBands[b]);
  if (cells.some((c) => c === null)) return null;
  const total = (cells as number[]).reduce((s, v) => s + v, 0);
  return total ? (w.ageBands[band] as number) / total : null;
}

/** Search stations by name, VD code or ward number. Case-insensitive, all words must match. */
export function searchVds(query: string, rows: VdRow[] = VD_ROWS): VdRow[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return rows;
  return rows.filter((r) => {
    const hay = `${r.station} ${r.vdCode} ward ${r.wardNumber} w${r.wardNumber}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

/** Seed minus roll, or null when the seed has no figure for this row. */
export const seedGap = (r: VdRow): number | null =>
  r.registeredSeed === null ? null : r.registeredSeed - r.verified;
