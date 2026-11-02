import { describe, expect, it } from 'vitest';
import { NW405_2021_EXAMPLE } from './nw405Example';
import {
  NW405_PARTIES_2026,
  contestingIds2021,
  displayNameFor,
  entrantsWithout2021,
  notOnList,
} from './nw405Parties2026';

describe('the 2026 NW405 party list', () => {
  it('holds twenty parties and 610 candidate rows, as counted from the list', () => {
    expect(NW405_PARTIES_2026).toHaveLength(20);
    expect(NW405_PARTIES_2026.reduce((s, p) => s + p.candidates, 0)).toBe(610);
  });
  it('shows each name as the list prints it, differing only in letter case', () => {
    for (const p of NW405_PARTIES_2026) {
      expect(p.displayName.toUpperCase(), p.listName).toBe(p.listName);
    }
  });
  it('has unique list names and unique 2021 ids', () => {
    expect(new Set(NW405_PARTIES_2026.map((p) => p.listName)).size).toBe(20);
    const ids = NW405_PARTIES_2026.flatMap((p) => (p.id2021 ? [p.id2021] : []));
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('links to 2021 parties that really exist in the 2021 result', () => {
    const known = new Set(NW405_2021_EXAMPLE.parties.map((p) => p.id));
    for (const id of contestingIds2021()) expect(known.has(id), id).toBe(true);
  });
});

describe('what the list says about the 2021 parties', () => {
  it('five 2021 parties are contesting and four are not on the list', () => {
    expect([...contestingIds2021()].sort()).toEqual(['ANC', 'DA', 'EFF', 'PA', 'VFP']);
    expect(
      notOnList(NW405_2021_EXAMPLE.parties)
        .map((p) => p.id)
        .sort(),
    ).toEqual(['ABC', 'ATM', 'BLF', 'F4SD']);
  });
  it('fifteen parties are contesting with no 2021 result to swing from', () => {
    expect(entrantsWithout2021()).toHaveLength(15);
    expect(entrantsWithout2021().map((p) => p.displayName)).toContain('Umkhonto Wesizwe Party');
  });
  it('uses the list’s name for a contesting party and the 2021 name otherwise', () => {
    expect(displayNameFor('VFP', 'Vryheidsfront Plus')).toBe(
      'Vryheidsfront Plus | Freedom Front Plus',
    );
    expect(displayNameFor('ABC', 'Abantu Batho Congress')).toBe('Abantu Batho Congress');
  });
});
