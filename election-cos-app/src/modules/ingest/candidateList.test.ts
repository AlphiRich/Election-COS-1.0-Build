import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ingestCandidateCsv,
  publishableCandidates,
  readCsv,
  REQUIRED_HEADERS,
  type CandidateDataset,
} from './candidateList';

/** Invented names throughout: no real person appears in a test. */
const HEAD = REQUIRED_HEADERS.join(',');
const row = (o: Partial<Record<(typeof REQUIRED_HEADERS)[number], string>>) =>
  [
    o.province ?? 'North West',
    o.province_code ?? 'NW',
    o.district ?? 'Dr Kenneth Kaunda District (DC40)',
    o.municipality_code ?? 'NW405',
    o.municipality_name ?? 'JB Marks',
    o.party ?? 'TEST PARTY ONE',
    o.candidate_type ?? 'Ward Candidate (Ward 3)',
    o.list_order_or_ward ?? '64005003',
    o.fullname ?? 'TESTA ONE',
    o.surname ?? 'EXAMPLE',
    o.id_number_masked ?? '800101****08*',
  ].join(',');
const csv = (...rows: string[]) => [HEAD, ...rows].join('\r\n');
const run = (...rows: string[]) => {
  const r = ingestCandidateCsv(csv(...rows));
  if (!r.ok) throw new Error(r.reason);
  return r.report;
};

describe('candidate CSV ingester: what it refuses', () => {
  it('stops on an unmapped format and lists every column it found', () => {
    const r = ingestCandidateCsv('Name,Party,Votes\nA,B,1');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.columns).toEqual(['Name', 'Party', 'Votes']);
      expect(r.reason).toMatch(/No mapping/);
    }
  });

  it('never carries the ID column into a record, and says why it was refused', () => {
    const rep = run(row({ id_number_masked: '800101****08*' }));
    expect(JSON.stringify(rep.entries)).not.toMatch(/\d{6}\*|\*{2,}|800101/);
    expect(rep.idColumn).toEqual({ present: true, rowsShowingDateOfBirth: 1 });
    expect(
      rep.findings.some((f) => f.severity === 'blocking' && /date of birth/.test(f.text)),
    ).toBe(true);
  });

  it('rejects an unknown municipality, a wrong name, a wrong province and a ward the municipality lacks', () => {
    const rep = run(
      row({ municipality_code: 'ZZ999' }),
      row({ municipality_name: 'Somewhere Else' }),
      row({ province: 'Gauteng' }),
      row({ candidate_type: 'Ward Candidate (Ward 35)', list_order_or_ward: '64005035' }),
    );
    expect(rep.entries).toHaveLength(0);
    expect(rep.rejected.map((r) => r.reason).join(' | ')).toMatch(
      /not in the delimitation register/,
    );
    expect(rep.rejected.map((r) => r.reason).join(' | ')).toMatch(/has wards 1 to 34, not 35/);
    expect(rep.rejected).toHaveLength(4);
  });

  it('rejects a ward that disagrees with its own ward id and a rank that disagrees with its own position', () => {
    const rep = run(
      row({ candidate_type: 'Ward Candidate (Ward 4)', list_order_or_ward: '64005003' }),
      row({ candidate_type: 'PR List Candidate (Rank 2)', list_order_or_ward: '7' }),
    );
    expect(rep.entries).toHaveLength(0);
    expect(rep.rejected).toHaveLength(2);
  });

  it('does not place a ward candidate whose ward number is not stated', () => {
    const rep = run(
      row({
        municipality_code: 'NW375',
        municipality_name: 'Moses Kotane',
        candidate_type: 'Ward Candidate',
        list_order_or_ward: '63705004',
      }),
    );
    expect(rep.entries).toHaveLength(0);
    expect(rep.rejected[0].reason).toMatch(/not stated/);
  });

  it('drops an exact repeat but refuses two different people in one place', () => {
    const rep = run(
      row({}),
      row({}),
      row({ party: 'TEST PARTY TWO', fullname: 'TESTB TWO' }),
      row({ party: 'TEST PARTY TWO', fullname: 'TESTC THREE' }),
    );
    expect(rep.entries.filter((e) => e.party === 'TEST PARTY ONE')).toHaveLength(1);
    expect(rep.entries.filter((e) => e.party === 'TEST PARTY TWO')).toHaveLength(0);
    expect(
      rep.findings.some((f) => f.severity === 'blocking' && /Two different people/.test(f.text)),
    ).toBe(true);
  });
});

describe('candidate CSV ingester: what it reports', () => {
  it('flags the file PARTIAL when wards have no candidate or a list has gaps', () => {
    const rep = run(
      row({}),
      row({
        candidate_type: 'PR List Candidate (Rank 3)',
        list_order_or_ward: '3',
        fullname: 'TESTD FOUR',
      }),
    );
    expect(rep.status).toBe('PARTIAL');
    const jb = rep.coverage.find((c) => c.municipalityCode === 'NW405')!;
    expect(jb.wardsWithACandidate).toBe(1);
    expect(jb.wardsWithNoCandidate).toHaveLength(33);
    expect(jb.parties[0].prRankGaps).toEqual([1, 2]);
  });

  it('finds a dual nomination only when the same person is in both rows in the file', () => {
    const both = run(
      row({}),
      row({ candidate_type: 'PR List Candidate (Rank 2)', list_order_or_ward: '2' }),
    );
    expect(both.dualNominated).toEqual([
      {
        name: 'TESTA ONE EXAMPLE',
        municipalityCode: 'NW405',
        party: 'TEST PARTY ONE',
        ward: 3,
        rank: 2,
      },
    ]);
    const none = run(
      row({}),
      row({
        candidate_type: 'PR List Candidate (Rank 2)',
        list_order_or_ward: '2',
        fullname: 'TESTE FIVE',
      }),
    );
    expect(none.dualNominated).toEqual([]);
  });

  it('reads quoted fields and CRLF', () => {
    expect(readCsv('a,"b,c",d\r\n1,"x ""y""",3\r\n')).toEqual([
      ['a', 'b,c', 'd'],
      ['1', 'x "y"', '3'],
    ]);
  });
});

describe('nothing reaches a voter until a named person confirms it', () => {
  const base: CandidateDataset = {
    provenance: {
      suppliedFile: 'x.csv',
      sha256: 'a'.repeat(64),
      bytes: 1,
      receivedOn: '2026-11-01',
      producedBy: 'test',
      sourceDocumentNamed: 'test',
      sourceDocumentSupplied: false,
      status: 'UNCONFIRMED',
      confirmedBy: null,
      confirmedOn: null,
    },
    status: 'PARTIAL',
    entries: [
      {
        municipalityCode: 'NW405',
        party: 'P',
        kind: 'WARD',
        wardNumber: 1,
        fullName: 'A',
        surname: 'B',
      },
    ],
  };
  const withProv = (p: Partial<CandidateDataset['provenance']>): CandidateDataset => ({
    ...base,
    provenance: { ...base.provenance, ...p },
  });

  it('publishes nothing while unconfirmed, flagged confirmed with nobody named, or undated', () => {
    expect(publishableCandidates(base)).toEqual([]);
    expect(publishableCandidates(withProv({ status: 'CONFIRMED' }))).toEqual([]);
    expect(
      publishableCandidates(
        withProv({ status: 'CONFIRMED', confirmedBy: '  ', confirmedOn: '2026-11-02' }),
      ),
    ).toEqual([]);
    expect(
      publishableCandidates(
        withProv({ status: 'CONFIRMED', confirmedBy: 'Someone', confirmedOn: null }),
      ),
    ).toEqual([]);
  });

  it('publishes once a named person has confirmed it', () => {
    expect(
      publishableCandidates(
        withProv({ status: 'CONFIRMED', confirmedBy: 'Someone', confirmedOn: '2026-11-02' }),
      ),
    ).toHaveLength(1);
  });
});

describe('the supplied North West file as shipped', () => {
  const dir = path.resolve(__dirname, '..', '..', 'data', 'iec');
  const file = path.join(dir, 'candidates-lge2026-notebooklm-2026-10-20.json');
  const data = JSON.parse(readFileSync(file, 'utf-8'));

  it('is recorded as unconfirmed, partial and not from the Commission', () => {
    expect(data.provenance.status).toBe('UNCONFIRMED');
    expect(data.provenance.confirmedBy).toBeNull();
    expect(data.provenance.sourceDocumentSupplied).toBe(false);
    expect(data.provenance.producedBy).toMatch(/not the Electoral Commission/);
    expect(data.provenance.sha256).toBe(
      'b3ca94cc55ecab791408a90349b51aa3e710ee52b9a52b942fb6821990e02ad3',
    );
    expect(data.status).toBe('PARTIAL');
    expect(publishableCandidates(data)).toEqual([]);
  });

  it('holds the 48 placed candidates of the 51 rows, and no ID of any kind', () => {
    expect(data.report.rowsRead).toBe(51);
    expect(data.entries).toHaveLength(48);
    expect(data.report.rejected).toHaveLength(3);
    for (const e of data.entries) {
      expect(Object.keys(e).sort()).toEqual(
        e.kind === 'WARD'
          ? ['fullName', 'kind', 'municipalityCode', 'party', 'surname', 'wardNumber']
          : ['fullName', 'kind', 'listRank', 'municipalityCode', 'party', 'surname'],
      );
    }
    expect(JSON.stringify(data.entries)).not.toMatch(/\*|\b\d{6,}\b/);
  });

  it('shows what the supplied analysis claimed and the file does not contain', () => {
    // The dual-nomination note names eight people as both ward and PR candidates,
    // with PR ranks such as DA 7 and PA 2. None of those ranks is in the file.
    expect(data.report.dualNominated).toEqual([]);
    const ranks = (party: string) =>
      data.entries
        .filter((e: { party: string; kind: string }) => e.party === party && e.kind === 'PR')
        .map((e: { listRank: number }) => e.listRank);
    expect(ranks('DEMOCRATIC ALLIANCE')).not.toContain(7);
    expect(ranks('PATRIOTIC ALLIANCE')).not.toContain(2);
    expect(ranks('ACTIONSA')).toEqual([]);
  });

  it('leaves JB Marks wards 6 to 10 and 29 to 34 with no candidate at all', () => {
    const jb = data.report.coverage.find(
      (c: { municipalityCode: string }) => c.municipalityCode === 'NW405',
    );
    expect(jb.wardsInDelimitation).toBe(34);
    expect(jb.wardsWithNoCandidate).toEqual([6, 7, 8, 9, 10, 29, 30, 31, 32, 33, 34]);
  });

  it('is never imported by the public site, so its names cannot ship in the bundle', () => {
    const site = path.resolve(__dirname, '..', '..', 'site');
    const walk = (d: string): string[] =>
      readdirSync(d).flatMap((n) =>
        statSync(path.join(d, n)).isDirectory() ? walk(path.join(d, n)) : [path.join(d, n)],
      );
    for (const f of walk(site).filter((p) => /\.(ts|tsx)$/.test(p) && !/\.test\./.test(p))) {
      expect(readFileSync(f, 'utf-8'), f).not.toMatch(/candidates-lge2026|ingest\/candidateList/);
    }
  });
});
