/**
 * Election Campaign OS — tenant onboarding seed (wards + voting districts)
 *
 * WHY THIS EXISTS
 *
 * A fresh tenant is empty: `tenants/{tid}/wards` and
 * `tenants/{tid}/votingDistricts` have no documents until something writes
 * them. The whole application scopes to wards — the war room, the ward
 * map, every voter/VD selector, the segmentation planner — so an empty
 * tenant renders a shell of dropdowns with nothing in them, which is
 * exactly the "empty and arduous" state the owner hit on first sign-in.
 *
 * Setting a municipality in Municipality Config stores the profile but
 * creates no ward documents. This module turns a configured municipality
 * into the ward and voting-district records the app reads, so the moment
 * an HQ admin sets NW405 the 34 wards and 108 voting districts appear and
 * every dropdown fills.
 *
 * WHAT IT WILL AND WILL NOT INVENT (ecos-build-discipline)
 *
 *  - Where this build holds a verified ward/VD dataset for the
 *    municipality — today only JB Marks / NW405, the proclaimed
 *    delimitation parsed into `seed-data/jb-marks-nw405-wards-vds.json`
 *    and reconciled against the IEC's own VD totals — the seed carries the
 *    real ward names, real voting-station names, real registered-voter
 *    counts and the real (wardCode, vdCode) identities, split stations
 *    included.
 *  - For any other municipality we have no per-ward data for, the seed
 *    builds a SKELETON from the proclaimed delimitation: the correct
 *    NUMBER of wards (the MEC's determination, which this build treats as
 *    source of truth), numbered 1..N, with registered voters left at 0 and
 *    no voting districts. It fills the ward dropdowns without inventing a
 *    single voter count or voting station. A 0 means "not loaded", never a
 *    claim that a ward is empty.
 *
 * It never writes voters: voter capture is a field role's job
 * (`voters.edit` / `roll.capture`), an HQ admin does not hold it, and a
 * fabricated voter would carry a fabricated POPIA consent. This module
 * stops at structure.
 */
import seed from '../../../seed-data/jb-marks-nw405-wards-vds.json';
import type { WardDraft } from '@/dal/ports/wards';
import type { VotingDistrictDraft } from '@/dal/ports/votingDistricts';
import { delimitationFor } from '@/modules/reference/municipalRegister';

export type SeedSource = 'detailed-register' | 'delimitation-skeleton';

export interface TenantSeedPlan {
  /** The municipality code the plan was built for, upper-cased. */
  municipalityCode: string;
  /** Whether wards carry verified per-ward data or only a delimitation skeleton. */
  source: SeedSource;
  wards: WardDraft[];
  votingDistricts: VotingDistrictDraft[];
}

/**
 * One entry per ward in the verified dataset: the ward and its voting
 * districts. Mirrors `seed-data/jb-marks-nw405-wards-vds.json`.
 */
type DetailedWardEntry = {
  ward: {
    wardCode: string;
    municipalityCode: string;
    name: string;
    registeredVoters: number;
    vdCodes: string[];
  };
  votingDistricts: Array<{
    vdCode: string;
    wardCode: string;
    name: string;
    registeredVoters: number;
  }>;
};

/**
 * Municipalities this build holds a verified ward + voting-district
 * dataset for, keyed by municipality code. Add a municipality here only
 * once its data has been acquired and reconciled the way NW405 was
 * (see docs/nw405-seed-data.md and the iec-data-ingestion skill) — never
 * by hand-typing wards.
 */
const DETAILED_DATASETS: Record<string, DetailedWardEntry[]> = {
  NW405: seed as DetailedWardEntry[],
};

/** VD document identity is the (wardCode, vdCode) pair — see votingDistricts port. */
function vdDocId(wardCode: string, vdCode: string): string {
  return `${wardCode}::${vdCode}`;
}

/**
 * Build the ward + voting-district records to write for a configured
 * municipality, or `null` when neither a verified dataset nor a
 * delimitation baseline is available for the code (a mistyped code, since
 * every municipality contesting on 4 November is in the register).
 */
export function buildTenantSeed(municipalityCodeRaw: string, tenantId: string): TenantSeedPlan | null {
  const municipalityCode = municipalityCodeRaw.trim().toUpperCase();
  if (!municipalityCode) return null;

  const detailed = DETAILED_DATASETS[municipalityCode];
  if (detailed) {
    const wards: WardDraft[] = [];
    const votingDistricts: VotingDistrictDraft[] = [];
    for (const { ward, votingDistricts: vds } of detailed) {
      wards.push({
        id: ward.wardCode,
        tenantId,
        wardCode: ward.wardCode,
        municipalityCode: ward.municipalityCode,
        name: ward.name,
        registeredVoters: ward.registeredVoters,
        vdCodes: [...ward.vdCodes],
      });
      for (const vd of vds) {
        votingDistricts.push({
          id: vdDocId(vd.wardCode, vd.vdCode),
          tenantId,
          vdCode: vd.vdCode,
          wardCode: vd.wardCode,
          name: vd.name,
          registeredVoters: vd.registeredVoters,
        });
      }
    }
    return { municipalityCode, source: 'detailed-register', wards, votingDistricts };
  }

  // No verified per-ward data — build a skeleton of the right size from
  // the proclaimed delimitation. Needs a known ward count to be useful.
  const baseline = delimitationFor(municipalityCode);
  if (!baseline || !baseline.wardSeats) return null;

  const wards: WardDraft[] = [];
  for (let n = 1; n <= baseline.wardSeats; n += 1) {
    const wardCode = `${municipalityCode}-W${n}`;
    wards.push({
      id: wardCode,
      tenantId,
      wardCode,
      municipalityCode,
      name: `Ward ${n}`,
      registeredVoters: 0,
      vdCodes: [],
    });
  }
  return { municipalityCode, source: 'delimitation-skeleton', wards, votingDistricts: [] };
}

/** Count of unique voting stations (vdCode) in a plan — split stations counted once. */
export function uniqueStationCount(plan: TenantSeedPlan): number {
  return new Set(plan.votingDistricts.map((vd) => vd.vdCode)).size;
}
