import { describe, expect, it } from 'vitest';
import { REGISTER_ENTRIES } from '@/modules/reference/municipalRegister';
import { allCouncils, ballotsFor, findCouncil, searchCouncils } from './councilFinder';
import { JB_MARKS_WARD_COUNT, findStations } from './wardFinder';
import { majorityThreshold, minimalMajorities, seatsHeld } from './coalition';

describe('council finder', () => {
  it('serves every municipality in the register, and only those', () => {
    expect(allCouncils()).toHaveLength(REGISTER_ENTRIES.length);
    expect(allCouncils()).toHaveLength(258);
  });

  it('states JB Marks as the register does: 67 councillors, 34 wards, so 33 PR', () => {
    const c = findCouncil('NW405')!;
    expect(c.councillors).toBe(67);
    expect(c.wards).toBe(34);
    expect(c.prCouncillors).toBe(33);
  });

  it('never gives a district council a ward or PR figure', () => {
    const districts = allCouncils().filter((c) => c.category === 'C');
    expect(districts).toHaveLength(44);
    for (const d of districts) {
      expect(d.wards).toBeNull();
      expect(d.prCouncillors).toBeNull();
    }
  });

  it('keeps ward + PR equal to the council size for every warded municipality', () => {
    const warded = allCouncils().filter((c) => c.wards !== null);
    expect(warded).toHaveLength(214);
    for (const c of warded) {
      expect(c.wards! + c.prCouncillors!).toBe(c.councillors);
      expect(c.prCouncillors!).toBeGreaterThan(0);
    }
  });

  it('searches by name, exact code and province, and is case-insensitive', () => {
    expect(searchCouncils('jb marks').map((c) => c.code)).toContain('NW405');
    expect(searchCouncils('nw405')[0].code).toBe('NW405');
    expect(searchCouncils('north west').every((c) => c.province === 'North West')).toBe(true);
    expect(searchCouncils('zzzz-no-such')).toEqual([]);
  });

  it('describes two ballots for a metro, three for a local municipality', () => {
    expect(ballotsFor(findCouncil('BUF')!)).toHaveLength(2);
    expect(ballotsFor(findCouncil('NW405')!)).toHaveLength(3);
  });
});

describe('ward and voting-station finder', () => {
  it('holds the 34 wards the register says JB Marks has', () => {
    expect(JB_MARKS_WARD_COUNT).toBe(findCouncil('NW405')!.wards);
  });

  it('matches a number to that ward only, not to Ward 13 or 30', () => {
    const hits = findStations('3');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((h) => h.wardNumber === 3)).toBe(true);
  });

  it('orders wards numerically, so Ward 2 comes before Ward 10', () => {
    const hits = findStations('school');
    const nums = hits.map((h) => h.wardNumber);
    expect(nums).toEqual([...nums].sort((a, b) => a - b));
  });

  it('finds a known station by name and returns nothing for an empty query', () => {
    expect(findStations('sarafina').some((h) => h.wardNumber === 1)).toBe(true);
    expect(findStations('   ')).toEqual([]);
  });
});

describe('coalition arithmetic', () => {
  const council = [
    { id: 'A', name: 'A', seats: 30 },
    { id: 'B', name: 'B', seats: 20 },
    { id: 'C', name: 'C', seats: 10 },
    { id: 'D', name: 'D', seats: 7 },
  ];

  it('needs more than half: 34 of 67, 33 of 66', () => {
    expect(majorityThreshold(67)).toBe(34);
    expect(majorityThreshold(66)).toBe(34);
    expect(majorityThreshold(1)).toBe(1);
  });

  it('adds only the chosen parties', () => {
    expect(seatsHeld(council, new Set(['A', 'C']))).toBe(40);
    expect(seatsHeld(council, new Set())).toBe(0);
  });

  it('lists every smallest majority and nothing that has a spare member', () => {
    // total 67, need 34
    const sets = minimalMajorities(council)!;
    const key = sets.map((s) => s.ids.join('+')).sort();
    expect(key).toEqual(['A+B', 'A+C', 'A+D', 'B+C+D']);
    // A+B+C is a majority but not minimal, so it must be absent.
    expect(key).not.toContain('A+B+C');
    for (const s of sets) expect(s.seats).toBeGreaterThanOrEqual(34);
  });

  it('refuses to enumerate more than 14 parties rather than freeze', () => {
    const many = Array.from({ length: 15 }, (_, i) => ({ id: `P${i}`, name: `P${i}`, seats: 2 }));
    expect(minimalMajorities(many)).toBeNull();
  });
});
