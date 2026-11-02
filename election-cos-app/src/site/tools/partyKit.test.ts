import { describe, expect, it } from 'vitest';
import { checkCount, emptyLog, toCsv, HOURS } from './agentLog';
import { stationMapLinks } from './mapLinks';
import { manifestoLinks } from './manifestoLinks';
import { bandPosition, nationalVoters, provinceTotals } from './areaStats';
import { REGISTER_ENTRIES } from '@/modules/reference/municipalRegister';
import { shares, validateFeed, type ResultsFeed } from './resultsFeed';
import { candidatesFor, validateCandidates, CERTIFIED_CANDIDATES } from './candidates';

describe('agent count check', () => {
  it('balances when party votes plus rejected equal the papers counted', () => {
    const c = checkCount(100, 4, [
      { party: 'A', votes: 60 },
      { party: 'B', votes: 36 },
    ]);
    expect(c.balanced).toBe(true);
    expect(c.difference).toBe(0);
  });
  it('reports the difference, signed, when it does not', () => {
    expect(checkCount(100, 4, [{ party: 'A', votes: 60 }]).difference).toBe(36);
    expect(checkCount(90, 0, [{ party: 'A', votes: 95 }]).difference).toBe(-5);
  });
  it('treats junk as zero rather than NaN', () => {
    const c = checkCount(Number.NaN, -3, [{ party: 'A', votes: Number.NaN }]);
    expect(c.accountedFor).toBe(0);
    expect(c.balanced).toBe(true);
  });
});

describe('agent CSV', () => {
  it('defuses spreadsheet formulas and escapes quotes', () => {
    const log = emptyLog();
    log.station = '=HYPERLINK("http://x")';
    log.incidents.push({ time: '09:10', note: 'He said "stop"' });
    const csv = toCsv(log);
    expect(csv).toContain('"\'=HYPERLINK(""http://x"")"');
    expect(csv).toContain('"He said ""stop"""');
  });
  it('writes every voting hour', () => {
    expect(HOURS).toHaveLength(14);
    expect(
      toCsv(emptyLog())
        .split('\r\n')
        .filter((r) => r.startsWith('"Voters observed"')),
    ).toHaveLength(14);
  });
});

describe('map links', () => {
  it('encodes the station name and names the place, and uses no coordinates', () => {
    const l = stationMapLinks('Sarafina High School & Annex', 'JB Marks, North West');
    expect(l.google).toBe(
      'https://www.google.com/maps/search/?api=1&query=Sarafina%20High%20School%20%26%20Annex%2C%20JB%20Marks%2C%20North%20West%2C%20South%20Africa',
    );
    expect(l.googleDirections).toContain('destination=');
    expect(l.googleDirections).not.toContain('origin=');
    expect(l.waze).toContain('navigate=yes');
  });
});

describe('manifesto links', () => {
  it('builds the same two searches for any party and none for an empty name', () => {
    const a = manifestoLinks('  Some  Party ')!;
    expect(a.web).toContain(encodeURIComponent('Some Party manifesto 2026'));
    expect(a.video).toContain('youtube.com/results');
    expect(manifestoLinks(' ')).toBeNull();
  });
});

describe('area statistics', () => {
  it('adds up: province voters exclude district councils and sum to the national figure', () => {
    const total = REGISTER_ENTRIES.filter((m) => m.category !== 'C').reduce(
      (n, m) => n + m.registeredVoters,
      0,
    );
    expect(nationalVoters()).toBe(total);
    expect(provinceTotals()).toHaveLength(9);
    expect(provinceTotals().reduce((n, p) => n + p.municipalities, 0)).toBe(258);
  });
  it('places a ward against the band edges', () => {
    expect(bandPosition(3050, 3051, 4127)).toBe('below');
    expect(bandPosition(3051, 3051, 4127)).toBe('within');
    expect(bandPosition(4127, 3051, 4127)).toBe('within');
    expect(bandPosition(4128, 3051, 4127)).toBe('above');
  });
});

describe('results feed validation', () => {
  const good: ResultsFeed = {
    schemaVersion: 1,
    source: 'Test fixture',
    generatedAt: '2026-11-05T08:00:00+02:00',
    municipalities: [
      {
        code: 'NW405',
        ballot: 'PR',
        votingDistrictsReported: 10,
        votingDistrictsTotal: 108,
        parties: [
          { name: 'A', votes: 70 },
          { name: 'B', votes: 30 },
        ],
      },
    ],
  };
  const now = Date.parse('2026-11-05T12:00:00+02:00');
  it('accepts a well-formed feed', () => {
    expect(validateFeed(good, now).ok).toBe(true);
  });
  it('refuses relationships that cannot be true', () => {
    const bad = (m: Partial<ResultsFeed['municipalities'][0]>) =>
      validateFeed({ ...good, municipalities: [{ ...good.municipalities[0], ...m }] }, now);
    expect(bad({ code: 'ZZ999' }).ok).toBe(false);
    expect(bad({ votingDistrictsReported: 109 }).ok).toBe(false);
    expect(bad({ parties: [{ name: 'A', votes: -1 }] }).ok).toBe(false);
    expect(validateFeed({ ...good, generatedAt: '2026-11-06T08:00:00+02:00' }, now).ok).toBe(false);
    expect(
      validateFeed(
        { ...good, municipalities: [good.municipalities[0], good.municipalities[0]] },
        now,
      ).ok,
    ).toBe(false);
    expect(validateFeed(null, now).ok).toBe(false);
  });
  it('computes shares of votes counted, largest first, and nothing else', () => {
    const s = shares(good.municipalities[0].parties);
    expect(s.map((p) => p.percent)).toEqual([70, 30]);
    expect(shares([]).length).toBe(0);
    expect(shares([{ name: 'A', votes: 0 }])[0].percent).toBe(0);
  });
});

describe('candidates', () => {
  it('ships empty, because no certified list has been loaded', () => {
    expect(CERTIFIED_CANDIDATES).toEqual([]);
    expect(validateCandidates(CERTIFIED_CANDIDATES)).toEqual([]);
  });
  it('looks up by ward and refuses an impossible ward or a duplicate', () => {
    const list = [
      { municipalityCode: 'NW405', wardNumber: 3, name: 'B Example', party: 'Independent' },
      { municipalityCode: 'NW405', wardNumber: 3, name: 'A Example', party: 'Party X' },
      { municipalityCode: 'NW405', wardNumber: 4, name: 'C Example', party: 'Party X' },
    ];
    expect(candidatesFor(list, 'NW405', 3).map((c) => c.name)).toEqual(['A Example', 'B Example']);
    expect(validateCandidates(list)).toEqual([]);
    expect(validateCandidates([{ ...list[0], wardNumber: 35 }])).toHaveLength(1);
    expect(validateCandidates([{ ...list[0], municipalityCode: 'DC40' }])).toHaveLength(1);
    expect(validateCandidates([list[0], list[0]])).toHaveLength(1);
  });
});
