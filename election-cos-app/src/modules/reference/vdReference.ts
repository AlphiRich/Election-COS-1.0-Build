/**
 * Election Campaign OS — the NW405 voting-district reference (VD locator and voter statistics).
 *
 * REGISTERED VOTERS are the gazetted baseline: 122,059 for NW405 (IEC Circular 1 of 2025, Annexure A), split by
 * ward and voting district in the delimitation seed. That is the only voter count this application shows.
 *
 * AGE comes from the certified roll via `scripts/build-reference-data.mjs`, reduced there to a PERCENTAGE of the
 * entries that could be placed in a band. No roll count is shipped. Age is read from the masked ID's first six
 * digits; sex cannot be derived; groups under 10 people are hidden. Where a district has no roll row the age mix
 * is null (shown as "not available"), never estimated.
 */
import raw from '@/data/reference/nw405-vd-reference.json';

export const AGE_BANDS = ['18-29', '30-39', '40-49', '50-59', '60-69', '70+'] as const;
export type AgeBand = (typeof AGE_BANDS)[number];
/** Percent of the row's age-placed entries in each band; null where the group is hidden. */
export type AgeMix = Record<AgeBand, number | null>;

export interface VdRow {
  wardCode: string;
  wardNumber: number;
  vdCode: string;
  station: string;
  registered: number;
  /** The district is shared between wards; `registered` is this ward's portion. */
  split: boolean;
  ageMix: AgeMix | null;
}
export interface WardRow {
  wardNumber: number;
  registered: number;
  ageMix: AgeMix | null;
}
interface Reference {
  municipalityCode: string;
  registeredSource: string;
  ageSource: string;
  rollEdition: string;
  ageAt: string;
  minCell: number;
  ageBandsNote: string;
  reconciliation: { vdsCompared: number; vdsNotMatchingCommissionTotals: number };
  totals: { registered: number; wards: number; votingDistrictRows: number; withAgeMix: number };
  municipalityAgeMix: AgeMix | null;
  wards: Record<string, WardRow>;
  voterDistricts: VdRow[];
}

export const VD_REFERENCE = raw as unknown as Reference;
export const VD_ROWS: VdRow[] = VD_REFERENCE.voterDistricts;
export const WARD_ROWS: Array<WardRow & { wardCode: string }> = Object.entries(VD_REFERENCE.wards)
  .map(([wardCode, w]) => ({ wardCode, ...w }))
  .sort((a, b) => a.wardNumber - b.wardNumber);
/** Registered voters, whole municipality: 122,059. */
export const REGISTERED_TOTAL = VD_REFERENCE.totals.registered;

/** Search stations by name, VD code or ward number. Case-insensitive, all words must match. */
export function searchVds(query: string, rows: VdRow[] = VD_ROWS): VdRow[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return rows;
  return rows.filter((r) => {
    const hay = `${r.station} ${r.vdCode} ward ${r.wardNumber} w${r.wardNumber}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}
