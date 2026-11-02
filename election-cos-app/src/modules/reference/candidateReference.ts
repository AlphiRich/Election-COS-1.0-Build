/**
 * Election Campaign OS — JB Marks (NW405) candidates as the application shows them.
 *
 * From the Commission's North West list as supplemented on 23 October 2026, extracted by
 * `scripts/extract-reference-candidates.mjs`. Names, party and ward or list position only: the source dataset
 * carries no identity-number column and none is added. The public site serves every municipality; the application
 * bundles only the tenant's own so the offline cache stays small.
 */
import raw from '@/data/reference/nw405-candidates.json';

export interface CandidateRow {
  party: string;
  fullName: string;
  surname: string;
  kind: 'WARD' | 'PR';
  ward?: number;
  rank?: number;
}
interface Candidates {
  municipalityCode: string;
  provenance: {
    source: string;
    url: string;
    fetchedOn: string;
    sha256: string;
    status: string;
    confirmedBy: string;
    confirmedOn: string;
  };
  counts: { total: number; ward: number; pr: number };
  dualNominated: Array<{ name: string; party: string; ward: number; rank: number }>;
  entries: CandidateRow[];
}

export const CANDIDATES = raw as unknown as Candidates;
export const displayName = (c: CandidateRow) => `${c.fullName} ${c.surname}`.trim();

const dualKey = (name: string, party: string) => `${name}|${party}`;
const DUAL = new Set(CANDIDATES.dualNominated.map((d) => dualKey(d.name, d.party)));
/** On both a ward ballot and a party list. Lawful; shown so nobody counts a person twice. */
export const isDual = (c: CandidateRow) => DUAL.has(dualKey(displayName(c), c.party));

export interface Filter {
  kind: 'ALL' | 'WARD' | 'PR';
  ward: number | null;
  party: string;
  query: string;
}

export function filterCandidates(
  f: Filter,
  rows: CandidateRow[] = CANDIDATES.entries,
): CandidateRow[] {
  const q = f.query.trim().toLowerCase();
  return rows.filter(
    (c) =>
      (f.kind === 'ALL' || c.kind === f.kind) &&
      (f.ward === null || c.ward === f.ward) &&
      (!f.party || c.party === f.party) &&
      (!q || displayName(c).toLowerCase().includes(q)),
  );
}

export interface PartySummary {
  party: string;
  ward: number;
  pr: number;
}
export function partySummaries(rows: CandidateRow[] = CANDIDATES.entries): PartySummary[] {
  const m = new Map<string, PartySummary>();
  for (const c of rows) {
    const s = m.get(c.party) ?? { party: c.party, ward: 0, pr: 0 };
    if (c.kind === 'WARD') s.ward++;
    else s.pr++;
    m.set(c.party, s);
  }
  return [...m.values()].sort(
    (a, b) => b.ward + b.pr - (a.ward + a.pr) || a.party.localeCompare(b.party),
  );
}
