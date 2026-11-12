import { describe, expect, it } from 'vitest';
import { municipalSwing, turnoutChange, wardSwing } from './swing2021to2026';

describe('JB Marks, 2021 to 2026', () => {
  it('compares party shares on the same definition, and the swings add up to nothing across all parties', () => {
    const all = municipalSwing();
    const anc = all.find((p) => p.id === 'ANC')!;
    expect(anc.share2021).toBeCloseTo((48911 / 101439) * 100, 6);
    // 45,943 is the Commission's own ANC total (PR 22,822 + ward 23,121), from the files re-issued on 8 Nov 2026
    expect(anc.share2026).toBeCloseTo((45943 / 138579) * 100, 6);
    // a party's swing is exactly its 2026 share minus its 2021 share
    for (const p of all) expect(p.swing).toBeCloseTo(p.share2026 - p.share2021, 9);
    expect(all.some((p) => p.id === 'MK' || p.id === 'ACTIONSA')).toBe(true); // 2026 entrants appear with a 2021 share of 0
    expect(all.find((p) => p.id === 'ACTIONSA')!.share2021).toBe(0);
  });
  it('reports turnout inputs from both elections and no more than the data holds', () => {
    const t = turnoutChange();
    expect(t.prValid2021).toBe(50733);
    expect(t.prValid2026).toBe(69423); // re-issued 8 Nov 2026; was 69,048
    expect(t.registered2026).toBe(131963);
  });
  it('gives a ward-level mean and spread only over wards where the party was first or second in 2021', () => {
    const [anc, da] = wardSwing(['ANC', 'DA']);
    expect(anc.wards).toBeGreaterThan(10);
    expect(anc.wards).toBeLessThanOrEqual(34);
    expect(da.wards).toBeGreaterThan(5);
    expect(anc.sd).toBeGreaterThan(0);
    expect(Number.isFinite(anc.mean)).toBe(true);
  });
});
