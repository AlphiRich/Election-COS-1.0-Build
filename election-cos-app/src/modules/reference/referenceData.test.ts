import { describe, expect, it } from 'vitest';
import { findPii } from '@/lib/piiScan';
import { BANDS, MIN_CELL, ageFromMask, bandOf, suppress } from '../../../scripts/lib/ageBands.mjs';
import {
  CANDIDATES,
  displayName,
  filterCandidates,
  isDual,
  partySummaries,
} from './candidateReference';
import raw from '@/data/reference/nw405-vd-reference.json';
import {
  AGE_BANDS,
  VD_REFERENCE,
  VD_ROWS,
  WARD_ROWS,
  bandShare,
  searchVds,
  sumBand,
} from './vdReference';

describe('age from a masked ID (polling day 4 Nov 2026)', () => {
  it('reads the century from the rule that everyone on the roll is at least 18', () => {
    expect(ageFromMask('740411 **** 08*')).toBe(52); // 11 Apr 1974
    expect(ageFromMask('070129 **** 08*')).toBe(19); // 29 Jan 2007
    expect(ageFromMask('081104 **** 08*')).toBe(18); // turns 18 on polling day
    expect(ageFromMask('081105 **** 08*')).toBeNull(); // would be 17: read as 1908, 118, implausible
    expect(ageFromMask('090101 **** 08*')).toBeNull();
  });
  it('refuses a mask that is not a date', () => {
    for (const bad of [
      '',
      null,
      undefined,
      '**** ****',
      '991399 ****',
      '740011 ****',
      '7404 ****',
    ]) {
      expect(ageFromMask(bad as never), String(bad)).toBeNull();
    }
  });
  it('places ages in six bands with the right edges', () => {
    expect([18, 29, 30, 39, 40, 49, 50, 59, 60, 69, 70, 100].map(bandOf)).toEqual([
      '18-29',
      '18-29',
      '30-39',
      '30-39',
      '40-49',
      '40-49',
      '50-59',
      '50-59',
      '60-69',
      '60-69',
      '70+',
      '70+',
    ]);
  });
});

describe('small-cell suppression', () => {
  const counts = (o: Partial<Record<string, number>>) =>
    Object.fromEntries(BANDS.map((b) => [b, o[b] ?? 100]));
  it('hides every cell under the minimum', () => {
    const r = suppress(counts({ '18-29': 3, '30-39': 9 }));
    expect(r['18-29']).toBeNull();
    expect(r['30-39']).toBeNull();
    expect(r['40-49']).toBe(100);
  });
  it('never leaves exactly one cell hidden: the total is published, so a lone gap could be subtracted out', () => {
    const r = suppress(counts({ '70+': 4, '60-69': 55 }));
    expect(Object.values(r).filter((v) => v === null)).toHaveLength(2);
    expect(r['70+']).toBeNull();
    expect(r['60-69']).toBeNull(); // the smallest of the others
  });
  it('shows a cell at exactly the minimum', () => {
    expect(MIN_CELL).toBe(10);
    expect(suppress(counts({ '18-29': 10 }))['18-29']).toBe(10);
  });
});

describe('the NW405 voting-district reference', () => {
  it('has 34 wards and 106 voting districts, and the totals add up', () => {
    expect(WARD_ROWS).toHaveLength(34);
    expect(VD_ROWS).toHaveLength(106);
    expect(VD_ROWS.reduce((s, r) => s + r.verified, 0)).toBe(VD_REFERENCE.totals.verified);
    expect(WARD_ROWS.reduce((s, w) => s + w.verified, 0)).toBe(VD_REFERENCE.totals.verified);
    expect(VD_REFERENCE.totals.verified).toBe(131963);
    expect(VD_REFERENCE.totals.rejected).toBe(52176);
  });
  it('agrees with the Commission’s printed total for every district it compared', () => {
    expect(VD_REFERENCE.reconciliation.vdsCompared).toBe(106);
    expect(VD_REFERENCE.reconciliation.vdsNotMatchingCommissionTotals).toBe(0);
  });
  it('holds no personal data: no ID number, phone number or person field anywhere in the file', () => {
    const text = JSON.stringify(raw);
    expect(findPii(text)).toEqual([]);
    for (const k of ['idNumber', 'id_number', 'surname', 'fullName', 'full_names', 'address']) {
      expect(text, k).not.toContain(`"${k}`);
    }
    const keys = new Set(Object.keys(VD_ROWS[0]));
    expect([...keys].sort()).toEqual(
      [
        'ageBands',
        'ageUnplaced',
        'rejected',
        'registeredSeed',
        'station',
        'vdCode',
        'verified',
        'wardCode',
        'wardNumber',
      ].sort(),
    );
  });
  it('shows no cell under the minimum, and never exactly one hidden cell in a row', () => {
    for (const r of [...VD_ROWS, ...WARD_ROWS]) {
      const cells = AGE_BANDS.map((b) => r.ageBands[b]);
      for (const c of cells) if (c !== null) expect(c).toBeGreaterThanOrEqual(MIN_CELL);
      expect(cells.filter((c) => c === null).length).not.toBe(1);
    }
  });
  it('never claims more age-banded people than the row holds, and the gap is small when nothing is hidden', () => {
    for (const r of VD_ROWS) {
      const vis = AGE_BANDS.map((b) => r.ageBands[b]);
      const sum = vis.reduce<number>((s, c) => s + (c ?? 0), 0);
      expect(sum).toBeLessThanOrEqual(r.verified);
      if (!vis.includes(null)) expect(r.verified - sum).toBeLessThan(MIN_CELL * 2);
    }
  });
  it('sums a band across wards only when no ward hides it', () => {
    const total = AGE_BANDS.reduce((s, b) => s + (sumBand(WARD_ROWS, b) ?? 0), 0);
    expect(total).toBeGreaterThan(130000);
    expect(total).toBeLessThanOrEqual(VD_REFERENCE.totals.verified);
    expect(
      sumBand([{ ageBands: { ...WARD_ROWS[0].ageBands, '18-29': null } }], '18-29'),
    ).toBeNull();
  });
  it('computes a share only from complete rows', () => {
    const w = WARD_ROWS[0];
    const s = bandShare(w, '18-29')!;
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(1);
    expect(bandShare({ ageBands: { ...w.ageBands, '70+': null } }, '18-29')).toBeNull();
  });
  it('finds stations by name, code and ward, all words required', () => {
    expect(searchVds('uniting reformed').length).toBeGreaterThan(0);
    expect(searchVds('86821094').every((r) => r.vdCode === '86821094')).toBe(true);
    expect(searchVds('ward 1').every((r) => r.wardNumber === 1)).toBe(false); // "ward 1" also matches 10..19 by substring
    expect(searchVds('zzzz')).toEqual([]);
    expect(searchVds('')).toHaveLength(106);
  });
});

describe('the NW405 candidate reference', () => {
  it('holds the Commission’s 611 entries: 447 ward, 164 party list, 20 parties, 34 wards', () => {
    expect(CANDIDATES.counts).toEqual({ total: 611, ward: 447, pr: 164 });
    expect(CANDIDATES.entries).toHaveLength(611);
    expect(partySummaries()).toHaveLength(20);
    const wards = new Set(CANDIDATES.entries.filter((c) => c.kind === 'WARD').map((c) => Number(c.ward)));
    expect(wards.size).toBe(34);
    expect(Math.min(...wards)).toBe(1);
    expect(Math.max(...wards)).toBe(34);
  });
  it('records where the list came from and who published it to the application', () => {
    const p = CANDIDATES.provenance;
    expect(p.url).toContain('elections.org.za');
    expect(p.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(p.confirmedBy.trim().length).toBeGreaterThan(0);
  });
  it('carries no identity number or other personal column', () => {
    const text = JSON.stringify(CANDIDATES.entries);
    expect(findPii(text)).toEqual([]);
    const allowed = new Set(['party', 'fullName', 'surname', 'kind', 'ward', 'rank']);
    for (const c of CANDIDATES.entries) {
      for (const k of Object.keys(c)) expect(allowed.has(k), k).toBe(true);
    }
  });
  it('gives every ward candidate a ward and every list candidate a place', () => {
    for (const c of CANDIDATES.entries) {
      if (c.kind === 'WARD') expect(c.ward).toBeGreaterThanOrEqual(1);
      else expect(c.rank).toBeGreaterThanOrEqual(1);
    }
  });
  it('marks the people who are on both ballots, and every marked person is really on both', () => {
    const dual = CANDIDATES.entries.filter(isDual);
    expect(dual.length).toBeGreaterThan(0);
    for (const c of dual) {
      const same = CANDIDATES.entries.filter(
        (e) => displayName(e) === displayName(c) && e.party === c.party,
      );
      expect(new Set(same.map((e) => e.kind))).toEqual(new Set(['WARD', 'PR']));
    }
  });
  it('filters by ballot, ward, party and name, and the party table adds up', () => {
    const ward7 = filterCandidates({ kind: 'WARD', ward: 7, party: '', query: '' });
    expect(ward7.length).toBeGreaterThan(0);
    expect(ward7.every((c) => c.kind === 'WARD' && c.ward === 7)).toBe(true);
    const anc = filterCandidates({
      kind: 'ALL',
      ward: null,
      party: 'AFRICAN NATIONAL CONGRESS',
      query: '',
    });
    expect(anc.every((c) => c.party === 'AFRICAN NATIONAL CONGRESS')).toBe(true);
    expect(filterCandidates({ kind: 'ALL', ward: null, party: '', query: 'zzzzqq' })).toEqual([]);
    const sums = partySummaries();
    expect(sums.reduce((s, p) => s + p.ward + p.pr, 0)).toBe(611);
  });
});
