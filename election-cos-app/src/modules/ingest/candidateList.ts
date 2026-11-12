/**
 * Election Campaign OS — candidate list ingester
 *
 * Reads a supplied candidate CSV into records, checks it against the
 * proclaimed delimitation, and says plainly what it is and is not.
 *
 * WHAT IT REFUSES, AND WHY EACH ONE EXISTS
 *
 *  - A file whose columns it has no mapping for: it lists the headings and
 *    stops. It never matches a column by similarity.
 *  - The ID-number column. In every supplied file so far the mask opens
 *    with a full date of birth (`YYMMDD****08*`), which this project has
 *    already refused once (`docs/nw-candidate-list-2026-review.md` §5). The
 *    column is read only to be reported on; it is never copied into a
 *    record, and the output is tested to contain no such value.
 *  - A municipality that is not in the delimitation, a ward the municipality
 *    does not have, a ward whose number disagrees with its own ward id, a PR
 *    rank that disagrees with its own list position, and a ward row for a
 *    municipality that has no wards.
 *  - Two different people in one ward for one party, or at one rank on one
 *    party's list.
 *
 * WHAT IT DOES NOT DO
 *
 * It confirms nothing. Confirmation is a person comparing the records with
 * the Electoral Commission's own list and putting their name on it. Until
 * then the dataset is UNCONFIRMED and `publishableCandidates` returns
 * nothing, so an unverified name cannot reach a voter.
 *
 * COVERAGE IS REPORTED, NEVER ASSUMED
 *
 * A file can arrive intact and short. The report lists, per municipality,
 * the wards with no candidate at all and, per party, PR lists that do not
 * start at rank 1 or have gaps. Any of those makes the dataset PARTIAL.
 */
import { lookupMunicipality } from '@/modules/reference/municipalRegister';

export const REQUIRED_HEADERS = [
  'province',
  'province_code',
  'district',
  'municipality_code',
  'municipality_name',
  'party',
  'candidate_type',
  'list_order_or_ward',
  'fullname',
  'surname',
  'id_number_masked',
] as const;

export interface CandidateEntry {
  municipalityCode: string;
  party: string;
  kind: 'WARD' | 'PR';
  /** WARD only. */
  wardNumber?: number;
  /** PR only: position on the party's list, 1 = top. */
  listRank?: number;
  fullName: string;
  surname: string;
}

export interface Finding {
  severity: 'blocking' | 'warning' | 'info';
  text: string;
}

export interface Rejection {
  row: number;
  reason: string;
}

export interface Coverage {
  municipalityCode: string;
  municipality: string;
  wardsInDelimitation: number | null;
  wardsWithACandidate: number;
  wardsWithNoCandidate: number[];
  parties: Array<{
    party: string;
    wardCandidates: number;
    prCandidates: number;
    prRanksPresent: number[];
    /** Ranks missing between 1 and the highest rank present. */
    prRankGaps: number[];
  }>;
}

export interface IngestReport {
  rowsRead: number;
  entries: CandidateEntry[];
  rejected: Rejection[];
  findings: Finding[];
  coverage: Coverage[];
  /** Candidates named as both a ward and a PR candidate in this file. */
  dualNominated: Array<{
    name: string;
    municipalityCode: string;
    party: string;
    ward: number;
    rank: number;
  }>;
  idColumn: { present: boolean; rowsShowingDateOfBirth: number };
  status: 'PARTIAL' | 'NO_GAPS_FOUND';
}

export type IngestOutcome =
  | { ok: false; reason: string; columns: string[] }
  | { ok: true; report: IngestReport };

/** Minimal CSV reader: quoted fields, doubled quotes, CRLF. */
export function readCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const src = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      if (row.some((v) => v.trim() !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((v) => v.trim() !== '')) rows.push(row);
  return rows;
}

const tidy = (s: string) => s.replace(/\s+/g, ' ').trim();
const DOB_MASK = /^\d{6}\*{4}\d{2}\*$/;

export function ingestCandidateCsv(text: string): IngestOutcome {
  const table = readCsv(text);
  if (table.length === 0) return { ok: false, reason: 'The file is empty.', columns: [] };
  const header = table[0].map(tidy);
  const missing = REQUIRED_HEADERS.filter((h) => !header.includes(h));
  if (missing.length > 0) {
    return {
      ok: false,
      reason: `No mapping for this format. Missing columns: ${missing.join(', ')}. Add a mapping rather than guessing which column is which.`,
      columns: header,
    };
  }
  const at = (row: string[], h: (typeof REQUIRED_HEADERS)[number]) =>
    tidy(row[header.indexOf(h)] ?? '');

  const entries: CandidateEntry[] = [];
  const rejected: Rejection[] = [];
  const findings: Finding[] = [];
  let dobRows = 0;
  let idRows = 0;

  table.slice(1).forEach((row, i) => {
    const n = i + 2;
    const reject = (reason: string) => void rejected.push({ row: n, reason });

    const mask = at(row, 'id_number_masked');
    if (mask !== '') {
      idRows++;
      if (DOB_MASK.test(mask)) dobRows++;
    }

    const code = at(row, 'municipality_code');
    const reg = lookupMunicipality(code);
    if (!reg) return reject(`${code || '(blank)'} is not in the delimitation register.`);
    if (tidy(reg.name).toLowerCase() !== at(row, 'municipality_name').toLowerCase()) {
      return reject(
        `${code} is ${reg.name} in the delimitation, not "${at(row, 'municipality_name')}".`,
      );
    }
    if (reg.province.toLowerCase() !== at(row, 'province').toLowerCase()) {
      return reject(`${reg.name} is in ${reg.province}, not "${at(row, 'province')}".`);
    }

    const party = at(row, 'party');
    const fullName = at(row, 'fullname');
    const surname = at(row, 'surname');
    if (!party) return reject('The party is blank.');
    if (!fullName || !surname) return reject('A name is blank.');

    const type = at(row, 'candidate_type');
    const order = at(row, 'list_order_or_ward');
    const ward = /^Ward Candidate \(Ward (\d+)\)$/.exec(type);
    const pr = /^PR List Candidate \(Rank (\d+)\)$/.exec(type);

    if (ward) {
      const w = Number(ward[1]);
      if (!reg.wards)
        return reject(`${reg.name} has no wards, so it cannot have a ward candidate.`);
      if (w < 1 || w > reg.wards)
        return reject(`${reg.name} has wards 1 to ${reg.wards}, not ${w}.`);
      if (!/^\d{8}$/.test(order) || Number(order.slice(-3)) !== w) {
        return reject(`Ward ${w} does not match its own ward id "${order}".`);
      }
      entries.push({
        municipalityCode: code,
        party,
        kind: 'WARD',
        wardNumber: w,
        fullName,
        surname,
      });
    } else if (pr) {
      const r = Number(pr[1]);
      if (r < 1) return reject('A PR rank must be 1 or more.');
      if (order !== String(r))
        return reject(`PR rank ${r} does not match its own list position "${order}".`);
      entries.push({ municipalityCode: code, party, kind: 'PR', listRank: r, fullName, surname });
    } else if (type === 'Ward Candidate' && /^\d{8}$/.test(order)) {
      // The ward number is not stated, only a ward id. The suffix would give a
      // ward number, but the id layout is confirmed for NW405 alone, so the
      // row is held out rather than placed.
      reject(`The ward is not stated for ${reg.name} (only id ${order}); not placed in a ward.`);
    } else {
      reject(`Unrecognised candidate type "${type}".`);
    }
  });

  // Exact repeats are dropped; two different people in one slot are a conflict.
  const seen = new Map<string, CandidateEntry>();
  const unique: CandidateEntry[] = [];
  const conflicts = new Set<string>();
  for (const e of entries) {
    const slot = `${e.municipalityCode}|${e.party}|${e.kind}|${e.kind === 'WARD' ? e.wardNumber : e.listRank}`;
    const prev = seen.get(slot);
    if (!prev) {
      seen.set(slot, e);
      unique.push(e);
    } else if (prev.fullName === e.fullName && prev.surname === e.surname) {
      findings.push({
        severity: 'info',
        text: `Exact repeat dropped: ${e.fullName} ${e.surname}, ${slot}.`,
      });
    } else {
      conflicts.add(slot);
    }
  }
  for (const slot of conflicts) {
    findings.push({
      severity: 'blocking',
      text: `Two different people in one place: ${slot}. Neither can be trusted.`,
    });
  }
  const clean = unique.filter(
    (e) =>
      !conflicts.has(
        `${e.municipalityCode}|${e.party}|${e.kind}|${e.kind === 'WARD' ? e.wardNumber : e.listRank}`,
      ),
  );

  if (idRows > 0) {
    findings.push({
      severity: dobRows > 0 ? 'blocking' : 'warning',
      text:
        dobRows > 0
          ? `The ID column was refused: ${dobRows} of ${idRows} values open with a full date of birth. It was read only to be counted and was not copied.`
          : `The ID column was not copied (${idRows} values).`,
    });
  }

  // Dual nominations that this file itself shows.
  const wardBy = new Map<string, CandidateEntry>();
  for (const e of clean)
    if (e.kind === 'WARD')
      wardBy.set(`${e.municipalityCode}|${e.party}|${e.fullName}|${e.surname}`, e);
  const dualNominated = clean
    .filter((e) => e.kind === 'PR')
    .flatMap((p) => {
      const w = wardBy.get(`${p.municipalityCode}|${p.party}|${p.fullName}|${p.surname}`);
      return w
        ? [
            {
              name: `${p.fullName} ${p.surname}`,
              municipalityCode: p.municipalityCode,
              party: p.party,
              ward: w.wardNumber!,
              rank: p.listRank!,
            },
          ]
        : [];
    });

  // Coverage.
  const coverage: Coverage[] = [];
  const codes = [...new Set(clean.map((e) => e.municipalityCode))].sort();
  for (const code of codes) {
    const reg = lookupMunicipality(code)!;
    const mine = clean.filter((e) => e.municipalityCode === code);
    const wardsWith = new Set(mine.filter((e) => e.kind === 'WARD').map((e) => e.wardNumber!));
    const noCandidate = reg.wards
      ? Array.from({ length: reg.wards }, (_, k) => k + 1).filter((w) => !wardsWith.has(w))
      : [];
    const parties = [...new Set(mine.map((e) => e.party))].sort().map((party) => {
      const pm = mine.filter((e) => e.party === party);
      const ranks = pm
        .filter((e) => e.kind === 'PR')
        .map((e) => e.listRank!)
        .sort((a, b) => a - b);
      const top = ranks.length ? ranks[ranks.length - 1] : 0;
      const gaps = Array.from({ length: top }, (_, k) => k + 1).filter((r) => !ranks.includes(r));
      return {
        party,
        wardCandidates: pm.filter((e) => e.kind === 'WARD').length,
        prCandidates: ranks.length,
        prRanksPresent: ranks,
        prRankGaps: gaps,
      };
    });
    coverage.push({
      municipalityCode: code,
      municipality: reg.name,
      wardsInDelimitation: reg.wards ?? null,
      wardsWithACandidate: wardsWith.size,
      wardsWithNoCandidate: noCandidate,
      parties,
    });
  }

  const partial = coverage.some(
    (c) => c.wardsWithNoCandidate.length > 0 || c.parties.some((p) => p.prRankGaps.length > 0),
  );
  if (partial) {
    findings.push({
      severity: 'blocking',
      text: 'The file is PARTIAL: some wards have no candidate at all and some PR lists have gaps. A voter looking at it would see a ward as uncontested, or a list as shorter than it is.',
    });
  }
  if (rejected.length > 0)
    findings.push({
      severity: 'warning',
      text: `${rejected.length} row(s) were rejected; see the list.`,
    });

  return {
    ok: true,
    report: {
      rowsRead: table.length - 1,
      entries: clean,
      rejected,
      findings,
      coverage,
      dualNominated,
      idColumn: { present: true, rowsShowingDateOfBirth: dobRows },
      status: partial ? 'PARTIAL' : 'NO_GAPS_FOUND',
    },
  };
}

export interface CandidateDataset {
  provenance: {
    /** What a person was handed. */
    suppliedFile: string;
    sha256: string;
    bytes: number;
    receivedOn: string;
    producedBy: string;
    sourceDocumentNamed: string;
    sourceDocumentSupplied: boolean;
    status: 'UNCONFIRMED' | 'CONFIRMED';
    /** A person, never a flag. Null until somebody has compared the records with the Commission's list. */
    confirmedBy: string | null;
    confirmedOn: string | null;
  };
  status: IngestReport['status'];
  entries: CandidateEntry[];
}

/**
 * The only door to a voter. Nothing is publishable until a named person has
 * confirmed the dataset against the Commission's own list, and a dataset that
 * is still PARTIAL is published only with that fact attached by the caller.
 */
export function publishableCandidates(d: CandidateDataset): CandidateEntry[] {
  const p = d.provenance;
  if (p.status !== 'CONFIRMED' || !p.confirmedBy || !p.confirmedBy.trim() || !p.confirmedOn)
    return [];
  return d.entries;
}
