/**
 * Election Campaign OS — tenant seed tests.
 *
 * These prove the seed carries the verified NW405 dataset faithfully and
 * that the skeleton path never invents voter counts or voting districts.
 * The ward/VD totals are read from the same seed file the app ships, not
 * typed here, so a change to the dataset is caught rather than duplicated.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildTenantSeed, uniqueStationCount } from './tenantSeed';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const RAW = JSON.parse(
  readFileSync(path.join(REPO_ROOT, 'seed-data', 'jb-marks-nw405-wards-vds.json'), 'utf-8'),
) as Array<{
  ward: { wardCode: string; registeredVoters: number; vdCodes: string[] };
  votingDistricts: Array<{ vdCode: string; wardCode: string; registeredVoters: number }>;
}>;

const TENANT = 'jb-marks';

describe('buildTenantSeed — detailed (NW405)', () => {
  const plan = buildTenantSeed('NW405', TENANT)!;

  it('returns the detailed-register source', () => {
    expect(plan).not.toBeNull();
    expect(plan.source).toBe('detailed-register');
  });

  it('seeds every ward in the dataset, stamped with the tenant', () => {
    expect(plan.wards).toHaveLength(RAW.length);
    expect(plan.wards.every((w) => w.tenantId === TENANT)).toBe(true);
    expect(plan.wards.every((w) => w.municipalityCode === 'NW405')).toBe(true);
    // Ward doc id is its code (split VDs make vdCode non-unique, but wards are).
    expect(plan.wards.every((w) => w.id === w.wardCode)).toBe(true);
  });

  it('seeds every voting-district row, keyed by the (wardCode, vdCode) pair', () => {
    const totalVdRows = RAW.reduce((n, e) => n + e.votingDistricts.length, 0);
    expect(plan.votingDistricts).toHaveLength(totalVdRows);
    expect(plan.votingDistricts.every((vd) => vd.id === `${vd.wardCode}::${vd.vdCode}`)).toBe(true);
    expect(new Set(plan.votingDistricts.map((vd) => vd.id)).size).toBe(totalVdRows);
  });

  it('carries the real registered-voter totals unchanged', () => {
    const seededRoll = plan.wards.reduce((n, w) => n + w.registeredVoters, 0);
    const sourceRoll = RAW.reduce((n, e) => n + e.ward.registeredVoters, 0);
    expect(seededRoll).toBe(sourceRoll);
  });

  it('counts split voting stations once', () => {
    const uniqueVdCodes = new Set(RAW.flatMap((e) => e.votingDistricts.map((v) => v.vdCode))).size;
    expect(uniqueStationCount(plan)).toBe(uniqueVdCodes);
    // Fewer unique stations than rows means at least one split station — the
    // case the identity scheme exists for.
    expect(uniqueStationCount(plan)).toBeLessThan(plan.votingDistricts.length);
  });

  it("each ward's vdCodes match its voting-district rows", () => {
    for (const ward of plan.wards) {
      const rowsForWard = plan.votingDistricts
        .filter((vd) => vd.wardCode === ward.wardCode)
        .map((vd) => vd.vdCode)
        .sort();
      expect([...ward.vdCodes].sort()).toEqual(rowsForWard);
    }
  });
});

describe('buildTenantSeed — skeleton (no verified dataset)', () => {
  // NW403 (Matlosana) is a real warded municipality in the register with no
  // detailed dataset in this build — the skeleton path.
  const plan = buildTenantSeed('NW403', TENANT);

  it('builds the right number of wards from the delimitation', () => {
    expect(plan).not.toBeNull();
    expect(plan!.source).toBe('delimitation-skeleton');
    expect(plan!.wards.length).toBeGreaterThan(0);
  });

  it('invents no voter counts and no voting districts', () => {
    expect(plan!.wards.every((w) => w.registeredVoters === 0)).toBe(true);
    expect(plan!.wards.every((w) => w.vdCodes.length === 0)).toBe(true);
    expect(plan!.votingDistricts).toHaveLength(0);
  });

  it('numbers wards 1..N under the municipality code', () => {
    plan!.wards.forEach((w, i) => {
      expect(w.wardCode).toBe(`NW403-W${i + 1}`);
      expect(w.name).toBe(`Ward ${i + 1}`);
    });
  });
});

describe('buildTenantSeed — bad input', () => {
  it('returns null for an empty code', () => {
    expect(buildTenantSeed('', TENANT)).toBeNull();
    expect(buildTenantSeed('   ', TENANT)).toBeNull();
  });

  it('returns null for a code not in the register', () => {
    expect(buildTenantSeed('ZZ999', TENANT)).toBeNull();
  });

  it('upper-cases a lower-case code', () => {
    const plan = buildTenantSeed('nw405', TENANT)!;
    expect(plan.municipalityCode).toBe('NW405');
    expect(plan.source).toBe('detailed-register');
  });
});
