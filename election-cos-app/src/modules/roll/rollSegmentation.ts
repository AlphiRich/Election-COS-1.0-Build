/**
 * Election Campaign OS — voters'-roll segmentation (module `voter-verification`)
 *
 * THE ENTERPRISE VIEW, AND WHY IT IS AN AGGREGATE
 *
 * A tenant- or municipality-wide planner needs the SHAPE of their own
 * lawfully-held roll — how the voters they may canvass are spread across
 * wards, voting districts and addresses — to plan where the doors are.
 * They do not need, and this view never gives them, a list of people.
 *
 * So segmentation reads `roll_addresses` (ward, VD, a raw address and a
 * COUNT), never `roll_entries` (which carry surname, full names and the
 * IEC mask). Every number it returns is a count or a distribution. No
 * individual's name, masked ID, or isolated address ever leaves this
 * function. That is the POPIA minimisation: the planner sees structure,
 * the canvasser at the door sees the person — and only with consent.
 *
 * THREE GUARDRAILS, all enforced before any number is computed:
 *
 *  1. CAPABILITY. `roll.segment` — held by the HQ Admin and Municipal Team
 *     Lead only. A field role (ward/VD) has `roll.view`/`roll.capture` and
 *     the door screen, not this.
 *  2. SCOPE. TENANT or MUNICIPALITY only. A ward- or VD-scoped token is
 *     refused outright: aggregating one ward's roll would de-aggregate it.
 *  3. SECOND FACTOR. Bulk roll access requires a passed second factor
 *     (`mfaOK` in firestore.rules gates the reads too; this refuses early
 *     with a clear reason rather than a wall of permission errors).
 *
 * SMALL-CELL SUPPRESSION. Any ward or VD whose voter total is below
 * SMALL_CELL is withheld and counted in `suppressedCells`, the same floor
 * `groundIntelligence.ts` uses. Individual addresses are listed only where
 * the roll registers CONCENTRATION_MIN or more voters at them — a hostel,
 * a block of flats, an old-age home: operational sites, never a dwelling
 * that a single person could be read out of.
 *
 * Pure functions. The page and the tests call `assertCanSegment` then
 * `segmentRoll`; nothing here reads Firestore or holds state.
 */
import type { RollAddress } from '@/dal/ports/roll';
import type { SessionContext } from '@/dal/ports/session';
import { secondFactorSatisfied } from '@/auth/secondFactor';
import { toCsv } from '@/lib/csv';

/** A ward or VD segment with fewer than this many voters is suppressed. */
export const SMALL_CELL = 5;
/** An address is listed individually only at or above this many registered voters. */
export const CONCENTRATION_MIN = 25;

export class SegmentationRefused extends Error {
  constructor(
    readonly reason: 'NO_CAPABILITY' | 'SCOPE_TOO_NARROW' | 'SECOND_FACTOR',
    message: string,
  ) {
    super(message);
    this.name = 'SegmentationRefused';
  }
}

/**
 * The three guardrails. Throws `SegmentationRefused` with a reason a screen
 * can show; returns nothing when the caller may segment.
 */
export function assertCanSegment(ctx: SessionContext, nowMs: number = Date.now()): void {
  if (!ctx.caps.includes('roll.segment')) {
    throw new SegmentationRefused(
      'NO_CAPABILITY',
      'Roll segmentation is available to tenant and municipality leads only.',
    );
  }
  if (ctx.geoScope !== 'TENANT' && ctx.geoScope !== 'MUNICIPALITY') {
    throw new SegmentationRefused(
      'SCOPE_TOO_NARROW',
      'Segmentation needs a tenant- or municipality-wide role. Use the field screen for your own district.',
    );
  }
  if (!secondFactorSatisfied(ctx, nowMs)) {
    throw new SegmentationRefused(
      'SECOND_FACTOR',
      'Pass the second sign-in step before reading the roll in bulk.',
    );
  }
}

export interface WardSegment {
  wardCode: string;
  addresses: number;
  voters: number;
  /** voters ÷ addresses, two decimals; 0 when there are no addresses. */
  votersPerAddress: number;
}

export interface VdSegment {
  wardCode: string;
  vdCode: string;
  addresses: number;
  voters: number;
}

export interface DensityBand {
  label: string;
  minVoters: number;
  /** null = open-ended (the top band). */
  maxVoters: number | null;
  addresses: number;
  voters: number;
}

export interface ConcentratedAddress {
  wardCode: string;
  vdCode: string;
  addressRaw: string;
  voterCount: number;
}

export interface RollSegmentation {
  edition: string;
  scope: SessionContext['geoScope'];
  totals: { wards: number; vds: number; addresses: number; voters: number };
  byWard: WardSegment[];
  byVd: VdSegment[];
  density: DensityBand[];
  /** Multi-voter sites only (>= CONCENTRATION_MIN), biggest first. */
  concentratedAddresses: ConcentratedAddress[];
  /** How many ward/VD cells were withheld for being below SMALL_CELL. */
  suppressedCells: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

const DENSITY_BANDS: ReadonlyArray<{ label: string; min: number; max: number | null }> = [
  { label: 'Single registered voter', min: 1, max: 1 },
  { label: '2–4 voters', min: 2, max: 4 },
  { label: '5–9 voters', min: 5, max: 9 },
  { label: '10–24 voters', min: 10, max: 24 },
  { label: '25 or more voters', min: 25, max: null },
];

/**
 * Segment the in-scope roll addresses of one edition. `addresses` is what
 * `RollRepository.listAddresses(ctx, edition)` returns — already narrowed
 * to the caller's scope and edition by the rules, so this does not re-filter
 * by scope; it only drops anything not of `edition` defensively.
 */
export function segmentRoll(addresses: RollAddress[], edition: string): RollSegmentation {
  const inEdition = addresses.filter((a) => a.rollEdition === edition);

  const wardMap = new Map<string, { addresses: number; voters: number }>();
  const vdMap = new Map<string, { wardCode: string; vdCode: string; addresses: number; voters: number }>();
  const bandCounts = DENSITY_BANDS.map(() => ({ addresses: 0, voters: 0 }));
  const concentrated: ConcentratedAddress[] = [];

  let totalVoters = 0;
  for (const a of inEdition) {
    const voters = Number.isFinite(a.voterCount) ? Math.max(0, Math.trunc(a.voterCount)) : 0;
    totalVoters += voters;

    let w = wardMap.get(a.wardCode);
    if (!w) {
      w = { addresses: 0, voters: 0 };
      wardMap.set(a.wardCode, w);
    }
    w.addresses += 1;
    w.voters += voters;

    const vdKey = `${a.wardCode}::${a.vdCode}`;
    let v = vdMap.get(vdKey);
    if (!v) {
      v = { wardCode: a.wardCode, vdCode: a.vdCode, addresses: 0, voters: 0 };
      vdMap.set(vdKey, v);
    }
    v.addresses += 1;
    v.voters += voters;

    const bi = DENSITY_BANDS.findIndex((b) => voters >= b.min && (b.max === null || voters <= b.max));
    if (bi >= 0) {
      bandCounts[bi].addresses += 1;
      bandCounts[bi].voters += voters;
    }

    if (voters >= CONCENTRATION_MIN) {
      concentrated.push({ wardCode: a.wardCode, vdCode: a.vdCode, addressRaw: a.addressRaw, voterCount: voters });
    }
  }

  let suppressedCells = 0;

  const byWard: WardSegment[] = [];
  for (const [wardCode, agg] of wardMap) {
    if (agg.voters < SMALL_CELL) {
      suppressedCells += 1;
      continue;
    }
    byWard.push({
      wardCode,
      addresses: agg.addresses,
      voters: agg.voters,
      votersPerAddress: agg.addresses ? round2(agg.voters / agg.addresses) : 0,
    });
  }
  byWard.sort((a, b) => b.voters - a.voters || a.wardCode.localeCompare(b.wardCode));

  const byVd: VdSegment[] = [];
  for (const agg of vdMap.values()) {
    if (agg.voters < SMALL_CELL) {
      suppressedCells += 1;
      continue;
    }
    byVd.push({ wardCode: agg.wardCode, vdCode: agg.vdCode, addresses: agg.addresses, voters: agg.voters });
  }
  byVd.sort((a, b) => b.voters - a.voters || `${a.wardCode}${a.vdCode}`.localeCompare(`${b.wardCode}${b.vdCode}`));

  const density: DensityBand[] = DENSITY_BANDS.map((b, i) => ({
    label: b.label,
    minVoters: b.min,
    maxVoters: b.max,
    addresses: bandCounts[i].addresses,
    voters: bandCounts[i].voters,
  }));

  concentrated.sort((a, b) => b.voterCount - a.voterCount || a.addressRaw.localeCompare(b.addressRaw));

  return {
    edition,
    scope: 'TENANT', // overwritten by the caller via segmentRollFor; kept valid here
    totals: { wards: wardMap.size, vds: vdMap.size, addresses: inEdition.length, voters: totalVoters },
    byWard,
    byVd,
    density,
    concentratedAddresses: concentrated,
    suppressedCells,
  };
}

/**
 * Guard, then segment, then stamp the real scope. The single entry point a
 * screen should call: it cannot compute an aggregate without passing the
 * three guardrails first.
 */
export function segmentRollFor(
  ctx: SessionContext,
  addresses: RollAddress[],
  edition: string,
  nowMs: number = Date.now(),
): RollSegmentation {
  assertCanSegment(ctx, nowMs);
  return { ...segmentRoll(addresses, edition), scope: ctx.geoScope };
}

/**
 * The aggregate as a formula-safe CSV: ward rows, then VD rows, then the
 * density bands. No individual record is ever written — only counts — so
 * the export carries no personal data to leak.
 */
export function segmentationCsv(seg: RollSegmentation): string {
  const rows: Array<Array<string | number>> = [];
  rows.push(['Section', 'Ward', 'Voting district', 'Addresses', 'Voters', 'Voters per address']);
  for (const w of seg.byWard) {
    rows.push(['Ward', w.wardCode, '', w.addresses, w.voters, w.votersPerAddress]);
  }
  for (const v of seg.byVd) {
    rows.push(['Voting district', v.wardCode, v.vdCode, v.addresses, v.voters, '']);
  }
  for (const d of seg.density) {
    rows.push(['Address density', d.label, '', d.addresses, d.voters, '']);
  }
  return toCsv(rows);
}
