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
  REGISTERED_TOTAL,
  searchVds,
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
  it('has 34 wards and 135 voting-district rows, and registered voters add up to 122,059 at every level', () => {
    expect(WARD_ROWS).toHaveLength(34);
    expect(VD_ROWS).toHaveLength(135);
    expect(REGISTERED_TOTAL).toBe(122059);
    expect(VD_ROWS.reduce((s, r) => s + r.registered, 0)).toBe(122059);
    expect(WARD_ROWS.reduce((s, w) => s + w.registered, 0)).toBe(122059);
    for (const w of WARD_ROWS) {
      expect(VD_ROWS.filter((r) => r.wardNumber === w.wardNumber).reduce((s, r) => s + r.registered, 0)).toBe(w.registered);
    }
  });
  it('carries no roll count: the 131,963 figure and every verified/rejected count are gone', () => {
    const text = JSON.stringify(raw);
    expect(text).not.toContain('131963');
    expect(text).not.toContain('52176');
    for (const k of ['"verified"', '"rejected"', '"ageUnplaced"', '"registeredSeed"']) expect(text).not.toContain(k);
  });
  it('agrees with the Commission’s printed total for every roll district it compared', () => {
    expect(VD_REFERENCE.reconciliation.vdsCompared).toBe(106);
    expect(VD_REFERENCE.reconciliation.vdsNotMatchingCommissionTotals).toBe(0);
  });
  it('holds no personal data: no ID number, phone number or person field anywhere in the file', () => {
    const text = JSON.stringify(raw);
    expect(findPii(text)).toEqual([]);
    for (const k of ['idNumber', 'id_number', 'surname', 'fullName', 'full_names', 'address']) {
      expect(text, k).not.toContain(`"${k}`);
    }
    expect(Object.keys(VD_ROWS[0]).sort()).toEqual(
      ['ageMix', 'registered', 'split', 'station', 'vdCode', 'wardCode', 'wardNumber'].sort(),
    );
  });
  it('shows only percentages, never exactly one hidden cell in a row, and no group that could be under the minimum', () => {
    const rows = [...VD_ROWS, ...WARD_ROWS].filter((r) => r.ageMix);
    expect(rows.length).toBeGreaterThan(100);
    for (const r of rows) {
      const cells = AGE_BANDS.map((b) => r.ageMix![b]);
      for (const c of cells) if (c !== null) { expect(c).toBeGreaterThan(0); expect(c).toBeLessThanOrEqual(100); }
      expect(cells.filter((c) => c === null).length).not.toBe(1);
      const sum = cells.reduce<number>((t, c) => t + (c ?? 0), 0);
      expect(sum).toBeLessThanOrEqual(100.5);
    }
  });
  it('has an age mix for 104 of 135 rows and says null, not a guess, for the rest', () => {
    expect(VD_ROWS.filter((r) => r.ageMix).length).toBe(VD_REFERENCE.totals.withAgeMix);
    expect(VD_ROWS.filter((r) => !r.ageMix).length).toBe(135 - VD_REFERENCE.totals.withAgeMix);
  });
  it('finds stations by name, code and ward, all words required', () => {
    expect(searchVds('uniting reformed').length).toBeGreaterThan(0);
    expect(searchVds('86821094').every((r) => r.vdCode === '86821094')).toBe(true);
    expect(searchVds('zzzz')).toEqual([]);
    expect(searchVds('')).toHaveLength(135);
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
