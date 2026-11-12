import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { assertLayer, councilDocs, councilPath, wardPath, type CouncilDoc } from './model';
import { shares, swing, turnout } from './crossCycle';
import { loadProvince, NATIONAL_SEATS } from '@/modules/lge2026/nationalResults';

const NW = JSON.parse(readFileSync(path.resolve(__dirname, '../../data/lge2026/national/NW.json'), 'utf8')).municipalities.NW405;

describe('election documents from the Commission file', () => {
  const { council, wards } = councilDocs('EEID1887', 'NW', 'NW405', NW);
  it('keeps the council totals and one document per ward', () => {
    expect(council.registered).toBe(NW.registered);
    expect(wards).toHaveLength(NW.wards);
    expect(council.parties.pr.reduce((n, p) => n + p.votes, 0)).toBe(NW.parties.pr.reduce((n: number, r: [string, number]) => n + r[1], 0));
  });
  it('stores parties as the Commission prints them, unmerged', () => {
    expect(council.parties.pr.map((p) => p.party)).toContain('VRYHEIDSFRONT PLUS | FREEDOM FRONT PLUS');
  });
  it('has addressable, collision-free paths for every ward', () => {
    expect(councilPath('EEID1887', 'NW405')).toBe('elections/EEID1887/councils/NW405');
    expect(new Set(wards.map((w) => wardPath('EEID1887', 'NW405', w.wardId))).size).toBe(wards.length);
  });
  it('covers all 213 councils across the nine provinces', async () => {
    expect(Object.keys(NATIONAL_SEATS.councils)).toHaveLength(213);
    const p = await loadProvince('NW');
    expect(Object.keys(p.municipalities).length).toBeGreaterThan(0);
  });
});

describe('change between cycles', () => {
  const before: CouncilDoc = { ...councilDocs('A', 'NW', 'NW405', NW).council, parties: { ward: [], dc40: [], pr: [{ party: 'X', votes: 60 }, { party: 'Y', votes: 40 }] } };
  const after: CouncilDoc = { ...before, parties: { ward: [], dc40: [], pr: [{ party: 'X', votes: 40 }, { party: 'Y', votes: 40 }, { party: 'Z', votes: 20 }] } };
  it('computes swing in points, counting an absent party as zero', () => {
    const s = Object.fromEntries(swing(before, after).map((r) => [r.party, r.swing]));
    expect(s.X).toBeCloseTo(-20); expect(s.Y).toBeCloseTo(0); expect(s.Z).toBeCloseTo(20);
    expect(swing(before, after)[0].party).not.toBe('Y');
  });
  it('shares sum to 100', () => {
    expect([...shares(after.parties.pr).values()].reduce((a, b) => a + b, 0)).toBeCloseTo(100);
  });
  it('refuses to compare two different councils that share nothing but a name', () => {
    expect(() => swing(before, { ...after, code: 'GT484' })).toThrow(/Not the same council/);
  });
  it('measures turnout against one ballot, never two summed', () => {
    const t = turnout({ registered: 1000, ballots: { pr: { valid: 400, spoilt: 10 }, ward: { valid: 410, spoilt: 10 }, dc40: { valid: 0, spoilt: 0 } } }, 'pr');
    expect(t).toBeCloseTo(41);
  });
});

describe('profile layers must say where they came from', () => {
  const ok = { code: 'NW405', layerId: 'census2022-age', kind: 'census' as const, source: 'Statistics South Africa, Census 2022', vintage: '2022', values: { under18: 0.3 } };
  it('accepts a sourced layer', () => expect(() => assertLayer(ok)).not.toThrow());
  it('refuses no source, no vintage, no values, non-numbers, a bad code', () => {
    expect(() => assertLayer({ ...ok, source: ' ' })).toThrow();
    expect(() => assertLayer({ ...ok, vintage: '' })).toThrow();
    expect(() => assertLayer({ ...ok, values: {} })).toThrow();
    expect(() => assertLayer({ ...ok, values: { a: NaN } })).toThrow();
    expect(() => assertLayer({ ...ok, code: 'jb marks' })).toThrow();
  });
});
