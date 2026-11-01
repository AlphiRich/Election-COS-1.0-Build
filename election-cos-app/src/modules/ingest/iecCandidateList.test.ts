import { mkdtempSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REGISTER_ENTRIES } from '@/modules/reference/municipalRegister';
import { publishableCandidates } from './candidateList';
import { publishCandidates } from '../../../scripts/publish-candidates';

const FILE = path.resolve(
  __dirname,
  '..',
  '..',
  'data',
  'iec',
  'candidates-lge2026-iec-nw-23102026.json',
);
const data = JSON.parse(readFileSync(FILE, 'utf-8'));
type E = {
  municipalityCode: string;
  party: string;
  kind: 'WARD' | 'PR';
  wardNumber?: number;
  listRank?: number;
  fullName: string;
  surname: string;
};
const entries: E[] = data.entries;

describe('the Commission’s North West certified list, as fetched on 1 November 2026', () => {
  it('records where it came from, who confirmed it, and on what basis', () => {
    const p = data.provenance;
    expect(p.url).toMatch(
      /^https:\/\/www\.elections\.org\.za\/pw\/Documents\/Candidate Lists\/LGE2026\//,
    );
    expect(p.sha256).toBe('b121e2680b67cc49348703e419f6891b48f99b0d5edaab91bbb2dbfb403cb8f0');
    expect(p.bytes).toBe(3_217_349);
    expect(p.headline).toMatch(/CCT 282\/26/);
    expect(p.status).toBe('CONFIRMED');
    expect(p.confirmedBy).toMatch(/site owner/);
    expect(p.confirmedOn).toBe('2026-11-01');
    expect(p.confirmationBasis).toMatch(/directly from elections\.org\.za/);
    expect(publishableCandidates(data)).toHaveLength(10_018);
  });

  it('holds 10,018 candidates across the 22 North West municipalities, and nothing else', () => {
    expect(entries).toHaveLength(10_018);
    expect(data.totalEntries).toBe(10_018);
    const codes = new Set(entries.map((e) => e.municipalityCode));
    expect(codes.size).toBe(22);
    const nw = new Set(
      REGISTER_ENTRIES.filter((m) => m.province === 'North West').map((m) => m.code),
    );
    for (const c of codes) expect(nw.has(c), c).toBe(true);
  });

  it('carries no ID of any kind, and no field beyond the agreed ones', () => {
    for (const e of entries) {
      expect(Object.keys(e).sort()).toEqual(
        e.kind === 'WARD'
          ? ['fullName', 'kind', 'municipalityCode', 'party', 'surname', 'wardNumber']
          : ['fullName', 'kind', 'listRank', 'municipalityCode', 'party', 'surname'],
      );
    }
    expect(JSON.stringify(entries)).not.toMatch(/\*|\b\d{6}\*/);
  });

  it('keeps district councils to lists and wards inside the delimitation', () => {
    const byCode = new Map(REGISTER_ENTRIES.map((m) => [m.code, m]));
    for (const e of entries) {
      const m = byCode.get(e.municipalityCode)!;
      if (e.kind === 'WARD') {
        expect(m.wards, e.municipalityCode).toBeGreaterThan(0);
        expect(e.wardNumber!).toBeGreaterThanOrEqual(1);
        expect(e.wardNumber!).toBeLessThanOrEqual(m.wards!);
      } else if (m.category === 'C') {
        expect(e.kind).toBe('PR');
      }
    }
  });

  it('has every party’s PR list running 1 to n with no gaps', () => {
    const lists = new Map<string, number[]>();
    for (const e of entries.filter((x) => x.kind === 'PR')) {
      const k = `${e.municipalityCode}|${e.party}`;
      (lists.get(k) ?? lists.set(k, []).get(k)!).push(e.listRank!);
    }
    for (const [k, ranks] of lists)
      expect(
        ranks.sort((a, b) => a - b),
        k,
      ).toEqual(ranks.map((_, i) => i + 1));
  });

  it('gives every JB Marks ward at least one candidate, which the 51-row extract did not', () => {
    const wards = new Set(
      entries
        .filter((e) => e.municipalityCode === 'NW405' && e.kind === 'WARD')
        .map((e) => e.wardNumber),
    );
    expect(wards.size).toBe(34);
  });

  it('contains every one of the 48 North West rows from the supplied extract, name for name', () => {
    const supplied = JSON.parse(
      readFileSync(
        path.resolve(
          __dirname,
          '..',
          '..',
          'data',
          'iec',
          'candidates-lge2026-notebooklm-2026-10-20.json',
        ),
        'utf-8',
      ),
    ).entries as E[];
    const key = (e: E) =>
      `${e.municipalityCode}|${e.party}|${e.kind}|${e.wardNumber ?? e.listRank}|${e.fullName}|${e.surname}`;
    const official = new Set(entries.map(key));
    const missing = supplied.filter(
      (e) => e.municipalityCode.startsWith('NW') && !official.has(key(e)),
    );
    expect(missing).toEqual([]);
  });

  it('shows the dual-nomination note was wrong about most of the people it named', () => {
    const dual = data.dualNominated as Array<{
      name: string;
      municipalityCode: string;
      party: string;
      ward: number;
      rank: number;
    }>;
    const find = (n: string) => dual.filter((d) => d.municipalityCode === 'NW405' && d.name === n);
    // Dual nominated, but not at the ranks the note gave (7 and 4).
    expect(find('WERNER THOMAS HITGE')[0]).toMatchObject({ ward: 2, rank: 27 });
    expect(find('EVERHARDUS JOHANNES JACOBUS LAING')[0]).toMatchObject({ ward: 2, rank: 7 });
    // Named as dual nominees; the Commission's list has no PR row for any of them.
    for (const n of [
      'MOGOROSI JOHN MOYO',
      'RUFANE ALISTAIR MAKOUSA',
      'MICHELLE ZELNA BEUKES',
      'TSHEPANG MOEKETSI',
      'MAHLOMOLA JOHANNES MASHIANE',
    ]) {
      expect(find(n), n).toEqual([]);
    }
  });
});

describe('publishing candidates to the site', () => {
  const make = (confirmed: boolean) => ({
    ...data,
    entries: entries.filter((e) => e.municipalityCode === 'NW405'),
    provenance: confirmed
      ? {
          ...data.provenance,
          status: 'CONFIRMED',
          confirmedBy: 'A. Person',
          confirmedOn: '2026-11-02',
        }
      : { ...data.provenance, status: 'UNCONFIRMED', confirmedBy: null, confirmedOn: null },
  });

  it('writes nothing for an unconfirmed dataset', () => {
    const out = mkdtempSync(path.join(tmpdir(), 'pub-'));
    const r = publishCandidates(make(false), out);
    expect(r.published).toBe(0);
    expect(existsSync(path.join(out, 'candidates'))).toBe(false);
  });

  it('writes one small file per municipality, ward candidates only, naming who confirmed it', () => {
    const out = mkdtempSync(path.join(tmpdir(), 'pub-'));
    const r = publishCandidates(make(true), out);
    expect(r.published).toBe(1);
    expect(readdirSync(path.join(out, 'candidates'))).toEqual(['NW405.json']);
    const f = JSON.parse(readFileSync(path.join(out, 'candidates', 'NW405.json'), 'utf-8'));
    expect(Object.keys(f.wards)).toHaveLength(34);
    expect(f.confirmedBy).toBe('A. Person');
    expect(JSON.stringify(f)).not.toMatch(/listRank|\*/);
    // Ward 1 holds every party's ward-1 candidate, sorted by party then name.
    expect(f.wards['1'].length).toBeGreaterThanOrEqual(1);
  });
});
