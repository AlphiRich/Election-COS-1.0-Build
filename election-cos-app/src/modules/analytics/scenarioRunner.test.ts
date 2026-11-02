import { describe, expect, it } from 'vitest';
import { projectCouncil } from './wardScenario';
import {
  MAX_DRAWS,
  RUNNER_CAVEAT,
  RunnerSpecError,
  frequencySe,
  normal,
  percentile,
  rng,
  runScenarios,
  sampleSwing,
  sensitivity,
  validateSpec,
  type RunnerSpec,
} from './scenarioRunner';

const base: RunnerSpec = { swingMean: {}, swingSd: {}, draws: 300, seed: 7 };

describe('the generator and the statistics', () => {
  it('is reproducible from its seed and differs between seeds', () => {
    const a = rng(1);
    const b = rng(1);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(rng(1)()).not.toBe(rng(2)());
  });
  it('draws standard normals with mean ~0 and sd ~1', () => {
    const u = rng(42);
    const xs = Array.from({ length: 20_000 }, () => normal(u));
    const m = xs.reduce((s, v) => s + v, 0) / xs.length;
    const sd = Math.sqrt(xs.reduce((s, v) => s + (v - m) ** 2, 0) / (xs.length - 1));
    expect(Math.abs(m)).toBeLessThan(0.03);
    expect(Math.abs(sd - 1)).toBeLessThan(0.03);
  });
  it('percentile is nearest-rank on a hand-worked array', () => {
    const s = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(percentile(s, 50)).toBe(5);
    expect(percentile(s, 95)).toBe(10);
    expect(percentile(s, 5)).toBe(1);
  });
  it('frequency standard error is sqrt(p(1-p)/n)', () => {
    expect(frequencySe(0.5, 10_000)).toBeCloseTo(0.005, 6);
    expect(frequencySe(0, 100)).toBe(0);
  });
});

describe('the runner', () => {
  it('with no uncertainty reproduces the single deterministic projection exactly, every draw', () => {
    const swing = { DA: 3, ANC: -3 };
    const det = projectCouncil({ swing }).allocation.parties;
    const r = runScenarios({ ...base, swingMean: swing });
    for (const p of r.parties) {
      const expected = det.find((d) => d.id === p.id)!.totalSeats;
      expect([p.min, p.p50, p.max, p.mean]).toEqual([expected, expected, expected, expected]);
      expect(p.sd).toBe(0);
    }
  });
  it('with zero swing and no spread returns the certified 2021 seats (67 of 67)', () => {
    const r = runScenarios(base);
    expect(r.parties.reduce((s, p) => s + p.p50, 0)).toBe(67);
    for (const p of r.parties) expect(p.p50).toBe(p.seats2021);
  });
  it('is reproducible, and a different seed changes the draws', () => {
    const spec = { ...base, swingSd: { DA: 3, ANC: 3 }, zeroSum: true };
    expect(runScenarios(spec)).toEqual(runScenarios(spec));
    expect(runScenarios({ ...spec, seed: 8 }).parties).not.toEqual(runScenarios(spec).parties);
  });
  it('spreads seats when uncertainty is added, and keeps every draw at the council size', () => {
    const r = runScenarios({ ...base, swingSd: { DA: 4, ANC: 4 }, zeroSum: true });
    const da = r.parties.find((p) => p.id === 'DA')!;
    expect(da.sd).toBeGreaterThan(0);
    expect(da.min).toBeLessThanOrEqual(da.p5);
    expect(da.p95).toBeLessThanOrEqual(da.max);
  });
  it('majority frequencies plus none sum to 1', () => {
    const r = runScenarios({ ...base, swingSd: { DA: 5, ANC: 5 }, zeroSum: true });
    const total = Object.values(r.majority.byParty).reduce((s, v) => s + v, 0) + r.majority.none;
    expect(total).toBeCloseTo(1, 10);
  });
  it('zero-sum draws keep the net swing at the sum of the means; independent draws do not', () => {
    const spec: RunnerSpec = {
      ...base,
      swingMean: { DA: 2, ANC: -1 },
      swingSd: { DA: 3, ANC: 3, EFF: 3 },
    };
    const net = (zeroSum: boolean, seed: number) => {
      const sw = sampleSwing({ ...spec, zeroSum }, rng(seed));
      return Object.values(sw).reduce((s, v) => s + v, 0);
    };
    let spread = 0;
    for (let seed = 1; seed <= 50; seed++) {
      expect(net(true, seed)).toBeCloseTo(1, 9);
      spread += Math.abs(net(false, seed) - 1);
    }
    expect(spread / 50).toBeGreaterThan(0.5);
  });
  it('carries the conditional caveat in its result', () => {
    expect(runScenarios(base).caveat).toBe(RUNNER_CAVEAT);
    expect(RUNNER_CAVEAT).toMatch(/not a forecast/);
  });
});

describe('spec validation', () => {
  it('rejects bad draws, seeds, spreads and swings', () => {
    expect(() => validateSpec({ ...base, draws: 10 })).toThrow(RunnerSpecError);
    expect(() => validateSpec({ ...base, draws: MAX_DRAWS + 1 })).toThrow(RunnerSpecError);
    expect(() => validateSpec({ ...base, seed: 1.5 })).toThrow(RunnerSpecError);
    expect(() => validateSpec({ ...base, swingSd: { DA: -1 } })).toThrow(RunnerSpecError);
    expect(() => validateSpec({ ...base, swingSd: { DA: 99 } })).toThrow(RunnerSpecError);
    expect(() => validateSpec({ ...base, swingMean: { DA: NaN } })).toThrow(RunnerSpecError);
  });
});

describe('sensitivity', () => {
  it('ranks the belief the result leans on most first and is deterministic', () => {
    const spec: RunnerSpec = { ...base, swingSd: { DA: 5, EFF: 0.2 } };
    const rows = sensitivity(spec, 'DA');
    expect(rows[0].party).toBe('DA');
    expect(rows[0].range).toBeGreaterThanOrEqual(rows[rows.length - 1].range);
    expect(sensitivity(spec, 'DA')).toEqual(rows);
    expect(rows[0].high).toBeGreaterThanOrEqual(rows[0].low);
  });
  it('skips parties held fixed', () => {
    expect(sensitivity({ ...base, swingSd: { DA: 0 } }, 'DA')).toEqual([]);
  });
});
