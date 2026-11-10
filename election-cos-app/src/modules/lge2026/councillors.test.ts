/**
 * The councillors-elect file: everyone it names is elected, every ward is accounted for, and its vacant seats are the
 * Commission's own "Potential Forfeiture" flags.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { council, type CouncillorsFile, type ProvinceFile } from './nationalResults';
import type { IecReport } from './reconcile';

const DIR = path.resolve(__dirname, '../../data/lge2026/national');
const read = <T>(f: string): T => JSON.parse(readFileSync(path.join(DIR, f), 'utf8')) as T;
const file = read<CouncillorsFile>('councillors-2026.json');
const councils = readdirSync(DIR).filter((f) => /^[A-Z]{2}\.json$/.test(f)).flatMap((f) => Object.values(read<ProvinceFile>(f).municipalities));
const iec = read<{ municipalities: Record<string, IecReport & { potentialForfeiture: boolean }>; notPublished: string[] }>('seat-calculation-iec.json');
const all = Object.values(file.councils);

describe('ward councillors-elect', () => {
  it('one entry for every ward in the country, in ward order', () => {
    for (const m of councils) {
      expect(file.councils[m.code].ward.map((w) => w.ward), m.code).toEqual(m.wardResults.map((w) => w.wardNumber));
    }
    expect(all.reduce((s, c) => s + c.ward.length, 0)).toBe(4485);
  });
  it('names a councillor wherever the lists allow, and says why not where they do not', () => {
    const by = (s: string) => all.flatMap((c) => c.ward.filter((w) => w.status === s).map((w) => `${c.code}/${w.ward}`));
    expect(by('elected')).toHaveLength(4464);
    expect(by('independentNamed')).toHaveLength(18);
    expect(by('noMatch')).toEqual([]);
    expect(by('tieUnresolved')).toEqual(['EC122/7']);
    expect(by('countIncomplete')).toEqual(['KZN216/13']);
    expect(by('independentUnnamed')).toHaveLength(1);
    for (const c of all) for (const w of c.ward) expect(w.name === null, `${c.code}/${w.ward}`).toBe(!['elected', 'independentNamed'].includes(w.status));
  });
  it('the ward winner agrees with the council seats', () => {
    for (const c of all) {
      const s = council(c.code);
      if (s.iec === 'laterCount') continue; // the report's ward split is a later count than the ward results
      const byParty = new Map<string, number>();
      for (const w of c.ward) if (w.party !== 'INDEPENDENT') byParty.set(w.party, (byParty.get(w.party) ?? 0) + 1);
      const total = [...byParty.values()].reduce((a, b) => a + b, 0);
      expect(total + c.ward.filter((w) => w.party === 'INDEPENDENT').length, c.code).toBe(s.wards);
      expect(s.holders.reduce((a, h) => a + h.wardSeats, 0), c.code).toBe(s.wards);
    }
  });
});

describe('PR councillors-elect and vacant list seats', () => {
  it('fill each party’s list seats in rank order; what cannot be filled is vacant', () => {
    for (const c of all) {
      const s = council(c.code);
      const listSeats = s.holders.filter((h) => !['IND', 'TIED'].includes(h.id)).reduce((a, h) => a + h.seats - h.wardSeats, 0);
      const vacant = c.vacant.reduce((a, v) => a + v.vacant, 0);
      expect(c.pr.length + vacant, c.code).toBe(listSeats);
      const byParty = new Map<string, number[]>();
      for (const p of c.pr) byParty.set(p.party, [...(byParty.get(p.party) ?? []), p.rank]);
      for (const [p, ranks] of byParty) expect(ranks, `${c.code} ${p}`).toEqual([...ranks].sort((a, b) => a - b));
    }
  });
  it('the councils with vacant seats are exactly the ones the Commission flags "(PF) Potential Forfeiture"', () => {
    const ours = all.filter((c) => c.vacant.length).map((c) => c.code).sort();
    const theirs = Object.values(iec.municipalities).filter((m) => m.potentialForfeiture).map((m) => m.code).sort();
    // EC122's report is not published, so the Commission has not flagged it.
    expect(ours.filter((c) => !iec.notPublished.includes(c))).toEqual(theirs);
    expect(theirs).toHaveLength(144);
    expect(all.reduce((s, c) => s + c.vacant.reduce((a, v) => a + v.vacant, 0), 0)).toBe(1083);
  });
});

describe('privacy', () => {
  it('holds names of the elected only: no ID numbers, no dates of birth', () => {
    const text = JSON.stringify(file);
    expect(text).not.toMatch(/\d{6}\*{4}/);
    expect(text).not.toMatch(/\d{13}/);
  });
  it('records the source list for every province, and which list predates the 23 Oct supplement', () => {
    expect(file.lists.map((l) => l.province).sort()).toEqual(['EC', 'FS', 'GP', 'KZN', 'LP', 'MP', 'NC', 'NW', 'WC']);
    expect(file.lists.filter((l) => !l.supplemented).map((l) => l.province)).toEqual(['MP']);
  });
});
