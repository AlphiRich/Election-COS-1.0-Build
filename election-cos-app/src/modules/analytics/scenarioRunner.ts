/**
 * Election Campaign OS — scenario runner (Monte Carlo over STATED assumptions).
 *
 * WHAT IT IS. The existing scenario tool answers "given THIS swing, what council does Schedule 1
 * produce?". The runner repeats that question many times with each swing and the turnout drawn
 * from a distribution THE USER STATES (a mean and a spread, in points), and reports how the
 * result varies. Every draw goes through the one authoritative seat calculation
 * (`projectCouncil` -> `allocateSeats`); nothing here re-implements the statute.
 *
 * WHAT IT IS NOT. It is not a forecast. The distributions are the caller's beliefs, not
 * estimated from data (the build holds one certified result, 2021; one election cannot estimate
 * a swing distribution), and nothing has been back-tested. So every frequency it reports is
 * conditional: "in X% of draws FROM THE ASSUMPTIONS YOU SET". It is a way to see how sensitive
 * the council is to the beliefs, and which beliefs matter most, not a probability that anything
 * will happen. The summary carries that sentence with it so an export cannot lose it.
 *
 * METHODS (standard, and stated):
 *  - Monte Carlo propagation of input uncertainty through a deterministic model.
 *  - Seeded generator (mulberry32) so a run is exactly reproducible from its seed.
 *  - Normal swings via Box-Muller; optional ZERO-SUM balancing (a vote gained by one side is lost
 *    by another), which is the structural reason party swings are negatively correlated.
 *  - Percentile summaries (nearest-rank), and Monte Carlo standard errors on every frequency.
 *  - One-at-a-time sensitivity (tornado): each party's swing moved by +/- one stated sd.
 */
import {
  majorityPosition,
  projectCouncil,
  type CouncilProjection,
  type Swing,
} from './wardScenario';
import { NW405_2021_EXAMPLE } from './nw405Example';

export const MAX_DRAWS = 20_000;
export const MIN_DRAWS = 200;

export const RUNNER_CAVEAT =
  'These figures are conditional on the swings and spreads you set. They are not estimated from ' +
  'data, have not been back-tested, and are not a forecast or a probability that any result will occur.';

export interface RunnerSpec {
  /** Mean swing per party, points of the valid vote. Missing = 0. */
  swingMean: Swing;
  /** Standard deviation per party, points. Missing = 0 (that party is held fixed). */
  swingSd: Record<string, number>;
  /** Valid votes: mean and sd. Defaults to the 2021 total, sd 0. */
  turnoutMean?: number;
  turnoutSd?: number;
  /** Subtract the mean random deviation so the sampled swings add up to the means' sum. */
  zeroSum?: boolean;
  draws: number;
  seed: number;
}

export class RunnerSpecError extends Error {}

export function validateSpec(spec: RunnerSpec): void {
  if (!Number.isInteger(spec.draws) || spec.draws < MIN_DRAWS || spec.draws > MAX_DRAWS) {
    throw new RunnerSpecError(`draws must be a whole number from ${MIN_DRAWS} to ${MAX_DRAWS}.`);
  }
  if (!Number.isInteger(spec.seed)) throw new RunnerSpecError('seed must be a whole number.');
  for (const [p, sd] of Object.entries(spec.swingSd)) {
    if (!(sd >= 0) || !Number.isFinite(sd) || sd > 25) {
      throw new RunnerSpecError(`${p}: spread must be from 0 to 25 points.`);
    }
  }
  for (const [p, m] of Object.entries(spec.swingMean)) {
    if (!Number.isFinite(m) || Math.abs(m) > 50)
      throw new RunnerSpecError(`${p}: swing out of range.`);
  }
  if (spec.turnoutSd !== undefined && !(spec.turnoutSd >= 0)) {
    throw new RunnerSpecError('turnout spread must not be negative.');
  }
}

/** mulberry32: small, fast, reproducible. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function normal(u: () => number): number {
  let a = 0;
  while (a === 0) a = u();
  const b = u();
  return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * b);
}

/** Nearest-rank percentile of an ascending array, p in (0,100]. */
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[Math.min(rank, sorted.length) - 1];
}

/** Standard error of a frequency estimated from n independent draws. */
export const frequencySe = (p: number, n: number): number => Math.sqrt((p * (1 - p)) / n);

export interface PartySummary {
  id: string;
  mean: number;
  sd: number;
  min: number;
  p5: number;
  p50: number;
  p95: number;
  max: number;
  /** Seats under the certified 2021 result, for reference. */
  seats2021: number;
}

export interface RunnerResult {
  spec: RunnerSpec;
  draws: number;
  parties: PartySummary[];
  /** Share of draws in which some party holds an outright majority, by party, and none. */
  majority: { byParty: Record<string, number>; none: number; seMax: number };
  /** Share of draws in which each ward changes hands, by ward number. */
  wardFlip: Array<{ wardNumber: number; frequency: number }>;
  /** Draws where the Act leaves a seat undecided (equal remainders and votes). */
  tiePendingDraws: number;
  caveat: string;
}

export function sampleSwing(spec: RunnerSpec, u: () => number): Swing {
  const parties = new Set([...Object.keys(spec.swingMean), ...Object.keys(spec.swingSd)]);
  const dev: Record<string, number> = {};
  for (const p of parties) dev[p] = (spec.swingSd[p] ?? 0) * normal(u);
  if (spec.zeroSum) {
    const moving = [...parties].filter((p) => (spec.swingSd[p] ?? 0) > 0);
    const mean = moving.reduce((s, p) => s + dev[p], 0) / (moving.length || 1);
    for (const p of moving) dev[p] -= mean;
  }
  const out: Swing = {};
  for (const p of parties) out[p] = (spec.swingMean[p] ?? 0) + dev[p];
  return out;
}

function sampleTurnout(spec: RunnerSpec, u: () => number): number {
  const mean = spec.turnoutMean ?? NW405_2021_EXAMPLE.totalValidVotes;
  const sd = spec.turnoutSd ?? 0;
  return Math.max(1000, Math.round(mean + sd * normal(u)));
}

export function runScenarios(spec: RunnerSpec): RunnerResult {
  validateSpec(spec);
  const u = rng(spec.seed);
  const seats: Record<string, number[]> = {};
  const majorityCount: Record<string, number> = {};
  let noMajority = 0;
  let tiePending = 0;
  let wardFlips: number[] = [];
  let baseline: CouncilProjection | null = null;

  for (let i = 0; i < spec.draws; i++) {
    const proj = projectCouncil({
      swing: sampleSwing(spec, u),
      projectedValidVotes: sampleTurnout(spec, u),
    });
    baseline ??= proj;
    for (const p of proj.allocation.parties) (seats[p.id] ??= []).push(p.totalSeats);
    const m = majorityPosition(proj);
    if (m.hasMajority && m.leader)
      majorityCount[m.leader.id] = (majorityCount[m.leader.id] ?? 0) + 1;
    else noMajority++;
    if ((proj.allocation.tieFlags?.length ?? 0) > 0) tiePending++;
    if (wardFlips.length === 0) wardFlips = new Array(proj.wards.length).fill(0);
    proj.wards.forEach((w, idx) => {
      if (w.flips) wardFlips[idx]++;
    });
  }

  const n = spec.draws;
  const before = new Map(baseline!.baseline.parties.map((p) => [p.id, p.totalSeats]));
  const parties: PartySummary[] = Object.entries(seats)
    .map(([id, arr]) => {
      const sorted = [...arr].sort((a, b) => a - b);
      const mean = arr.reduce((s, v) => s + v, 0) / n;
      const sd = Math.sqrt(arr.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, n - 1));
      return {
        id,
        mean,
        sd,
        min: sorted[0],
        p5: percentile(sorted, 5),
        p50: percentile(sorted, 50),
        p95: percentile(sorted, 95),
        max: sorted[sorted.length - 1],
        seats2021: before.get(id) ?? 0,
      };
    })
    .sort((a, b) => b.mean - a.mean);

  const byParty: Record<string, number> = {};
  let seMax = frequencySe(noMajority / n, n);
  for (const [id, c] of Object.entries(majorityCount)) {
    byParty[id] = c / n;
    seMax = Math.max(seMax, frequencySe(c / n, n));
  }
  return {
    spec,
    draws: n,
    parties,
    majority: { byParty, none: noMajority / n, seMax },
    wardFlip: baseline!.wards.map((w, idx) => ({
      wardNumber: w.wardNumber,
      frequency: wardFlips[idx] / n,
    })),
    tiePendingDraws: tiePending,
    caveat: RUNNER_CAVEAT,
  };
}

export interface SensitivityRow {
  party: string;
  /** Council seats of `target` when this party's swing is mean - sd, and mean + sd. */
  low: number;
  high: number;
  range: number;
}

/**
 * One-at-a-time sensitivity of `target`'s seats: each party's swing is moved by -/+ its stated
 * sd while all others stay at their means. Deterministic (no sampling). Sorted by range, so the
 * top row is the belief the result leans on most.
 */
export function sensitivity(spec: RunnerSpec, target: string): SensitivityRow[] {
  const seatsFor = (swing: Swing) =>
    projectCouncil({ swing, projectedValidVotes: spec.turnoutMean }).allocation.parties.find(
      (p) => p.id === target,
    )?.totalSeats ?? 0;
  const rows: SensitivityRow[] = [];
  for (const [party, sd] of Object.entries(spec.swingSd)) {
    if (!(sd > 0)) continue;
    const m = spec.swingMean[party] ?? 0;
    const low = seatsFor({ ...spec.swingMean, [party]: m - sd });
    const high = seatsFor({ ...spec.swingMean, [party]: m + sd });
    rows.push({ party, low, high, range: Math.abs(high - low) });
  }
  return rows.sort((a, b) => b.range - a.range);
}
