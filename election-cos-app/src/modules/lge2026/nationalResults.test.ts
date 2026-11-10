/**
 * The national LGE 2026 results: what was ingested, and that this build's seats are the Commission's.
 * Reads the per-province files from disk (they are loaded on demand in the app).
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { councilHoldersOf, wardOutcomesOf, type CouncilTies } from './councilResults';
import { COUNCIL_CODES, NATIONAL_SEATS, council, majorityOf, nationalSummary, type ProvinceFile } from './nationalResults';
import { holdersFromIecReport, reconcile, type IecReport } from './reconcile';

const DIR = path.resolve(__dirname, '../../data/lge2026/national');
const read = <T>(f: string): T => JSON.parse(readFileSync(path.join(DIR, f), 'utf8')) as T;
const provinces = readdirSync(DIR).filter((f) => /^[A-Z]{2}\.json$/.test(f)).map((f) => read<ProvinceFile>(f));
const councils = provinces.flatMap((p) => Object.values(p.municipalities));
const iec = read<{ municipalities: Record<string, IecReport>; notPublished: string[] }>('seat-calculation-iec.json');
const ties = read<{ wards: Array<{ code: string; ward: number; awardedTo: string | null; tied: string[] }>; remainders: Array<{ code: string; awardedTo: string[] }> }>('tie-resolutions.json');
const manifest = read<{ files: Array<{ code: string; sha256: string }> }>('manifest.json');
const tiesFor = (code: string): CouncilTies | undefined => {
  const w = ties.wards.filter((x) => x.code === code);
  const r = ties.remainders.find((x) => x.code === code);
  return w.length || r ? { wards: Object.fromEntries(w.map((x) => [x.ward, x.awardedTo])), remainders: r?.awardedTo } : undefined;
};

describe('what was ingested', () => {
  it('every contested metro and local council: 213, in 9 provinces, with all 44 districts', () => {
    expect(provinces).toHaveLength(9);
    expect(councils).toHaveLength(213);
    expect(provinces.flatMap((p) => Object.keys(p.districts))).toHaveLength(44);
    expect(councils.filter((c) => c.category === 'A').map((c) => c.code).sort()).toEqual(['BUF', 'CPT', 'EKU', 'ETH', 'JHB', 'MAN', 'NMA', 'TSH']);
    expect(councils.reduce((s, c) => s + c.wards, 0)).toBe(4485);
  });
  it('records a SHA-256 for every source file', () => {
    expect(manifest.files).toHaveLength(213);
    for (const f of manifest.files) expect(f.sha256, f.code).toMatch(/^[0-9a-f]{64}$/);
  });
  it('closes arithmetically within each council', () => {
    for (const m of councils) {
      for (const b of ['ward', 'pr'] as const) expect(m.parties[b].reduce((s, [, v]) => s + v, 0), `${m.code} ${b}`).toBe(m.ballots[b].valid);
      expect(m.wardResults.reduce((s, w) => s + w.valid, 0), m.code).toBe(m.ballots.ward.valid);
      const notInWards = (m.wardBallotGaps ?? []).reduce((s, g) => s + g.registeredNotInWard, 0);
      expect(m.wardResults.reduce((s, w) => s + w.registered, 0) + notInWards, m.code).toBe(m.registered);
    }
  });
  it('records the one ward whose ward-ballot result is short in the Commission’s file', () => {
    const gaps = councils.flatMap((m) => (m.wardBallotGaps ?? []).map((g) => `${m.code}/${g.wardNumber}:${g.votingDistrictsWithoutWardResult}`));
    expect(gaps).toEqual(['KZN216/13:1']);
  });
  it('holds no personal data: only counts, names of places and parties, and codes', () => {
    expect(provinces.map((p) => JSON.stringify(p)).join('')).not.toMatch(/\d{13}/);
  });
});

describe('reconciled with the Commission’s own Seat Calculation Detail reports', () => {
  it('every report was read: 212 published, EC122 not published', () => {
    expect(Object.keys(iec.municipalities)).toHaveLength(212);
    expect(iec.notPublished).toEqual(['EC122']);
  });
  for (const m of councils) {
    const status = NATIONAL_SEATS.councils[m.code]?.iec;
    if (status !== 'reconciled') continue;
    it(`${m.code}: same A, quota and every party's seats and ward/list split`, () => {
      expect(reconcile(m, m.councillors, iec.municipalities[m.code], tiesFor(m.code))).toEqual([]);
    });
  }
  it('only the named exceptions are not reconciled, each for a recorded reason', () => {
    const by = (s: string) => COUNCIL_CODES.filter((c) => council(c).iec === s);
    expect(by('reconciled')).toHaveLength(208);
    expect(by('laterCount')).toEqual(['FS184', 'KZN216', 'KZN225']);
    expect(by('incomplete')).toEqual(['EC157']);
    expect(by('notPublished')).toEqual(['EC122']);
    expect(council('EC157').iecUnallocated).toBe(9);
  });
  it('a later-count council shows the report’s seats, matched to parties unambiguously', () => {
    for (const code of ['FS184', 'KZN216', 'KZN225']) {
      const m = councils.find((c) => c.code === code)!;
      expect(holdersFromIecReport(m, m.councillors, iec.municipalities[code]), code).toEqual(council(code).holders);
    }
  });
});

describe('ties are never broken by this build', () => {
  it('every exact ward tie in the country is listed, with the Commission’s award or none', () => {
    const found = councils.flatMap((m) => m.wardResults.filter((w) => w.parties[1] && w.parties[0][1] === w.parties[1][1]).map((w) => `${m.code}/${w.wardNumber}`));
    expect(found.sort()).toEqual(ties.wards.map((t) => `${t.code}/${t.ward}`).sort());
  });
  it('a recorded award decides the ward; an unrecorded one is marked unresolved', () => {
    const mp313 = councils.find((c) => c.code === 'MP313')!;
    const w17 = wardOutcomesOf(mp313, tiesFor('MP313')).find((w) => w.wardNumber === 17)!;
    expect([w17.winner, w17.tie]).toEqual(['SOUTH AFRICAN COMMUNIST PARTY', 'resolved']);
    const ec122 = councils.find((c) => c.code === 'EC122')!;
    expect(wardOutcomesOf(ec122, tiesFor('EC122')).find((w) => w.wardNumber === 7)!.tie).toBe('unresolved');
  });
  it('a remainder tie with no recorded award is left as an undecided seat', () => {
    const nc084 = councils.find((c) => c.code === 'NC084')!;
    expect(councilHoldersOf(nc084, nc084.councillors).find((h) => h.id === 'TIED')?.seats).toBe(1);
    expect(councilHoldersOf(nc084, nc084.councillors, tiesFor('NC084')).find((h) => h.id === 'TIED')).toBeUndefined();
  });
});

describe('the compact national seat table', () => {
  it('matches what the engine computes for every council it reconciles', () => {
    for (const m of councils) {
      const c = council(m.code);
      if (c.iec === 'laterCount') continue;
      expect(c.holders, m.code).toEqual(councilHoldersOf(m, m.councillors, tiesFor(m.code)));
    }
  });
  it('every council’s holders add up to its size, and hung means no holder has a majority', () => {
    for (const code of COUNCIL_CODES) {
      const c = council(code);
      expect(c.holders.reduce((s, h) => s + h.seats, 0), code).toBe(c.councillors);
      expect(c.majority).toBe(majorityOf(c.councillors));
      expect(c.hung, code).toBe(Math.max(...c.holders.map((h) => h.seats)) < c.majority);
    }
  });
  it('summarises the country: 139 of 213 councils hung, 11 of 18 in the North West, 7 of 8 metros', () => {
    const s = nationalSummary();
    expect([s.councils, s.hung, s.majority]).toEqual([213, 139, 74]);
    expect(s.byProvince.NW).toEqual({ councils: 18, hung: 11 });
    expect(COUNCIL_CODES.filter((c) => council(c).category === 'A' && council(c).hung)).toHaveLength(7);
  });
});
