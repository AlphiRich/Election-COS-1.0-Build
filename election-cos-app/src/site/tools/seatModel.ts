/**
 * Election Campaign OS — seat allocation model (campaign teams)
 *
 * A what-if model for a municipality, built on `allocateSeats`, which
 * reproduces every figure on the Electoral Commission's 2021 JB Marks seat
 * calculation report (see `seatCalculator.test.ts`). It replaces an earlier
 * mock-up with these differences, each one a correction:
 *
 *  - COUNCIL SIZE comes from the proclaimed delimitation (Annexure A to IEC
 *    Circular 1 of 2025), not from a formula typed in. The mock-up's
 *    "registered voters ÷ 8,600 + 48" had no source, and the council size
 *    is not a model input: it is fixed for this cycle (build rule 1).
 *  - WARD AND PR SPLIT is wards from the register, with PR seats the
 *    remainder, not "half rounded up".
 *  - THE QUOTA IS DRAWN FROM THE PR BALLOT. The mock-up added ward votes
 *    to PR votes, counting each voter twice. Ward-ballot votes decide who
 *    wins a ward, which the user enters as ward seats won; they do not
 *    enter the quota.
 *  - NO MINIMUM THRESHOLD. The mock-up excluded parties under 1%; the
 *    formula this build implements has no such cut-off, so the model does
 *    not invent one.
 *  - OVERHANG expands the council rather than re-running the quota without
 *    the over-represented party, and tied remainders are flagged for the
 *    Commission rather than assigned by array order.
 *  - INDEPENDENT AND LIST-LESS WARD WINNERS are deducted from the quota's
 *    denominator as `C` and `D`, as the Commission's own report prints.
 *  - DISTRICT COUNCILS are refused: they use a different Schedule.
 *
 * It is a what-if for planning and teaching. It does not forecast anything
 * and its results are not official.
 */
import { allocateSeats, type SeatAllocationResult } from '@/modules/analytics/seatCalculator';
import { lookupMunicipality } from '@/modules/reference/municipalRegister';
import { findCouncil } from './councilFinder';

export interface ModelParty {
  id: string;
  name: string;
  /** Votes on the proportional (PR) ballot: the basis of the quota. */
  prVotes: number;
  /** Ward seats the party wins. */
  wardSeatsWon: number;
}

export interface ModelInput {
  municipalityCode: string;
  parties: ModelParty[];
  /** C: ward seats won by independents. */
  independentWardSeats: number;
  /** D: ward seats won by parties that submitted no PR list. */
  noPRListWardSeats: number;
}

export interface ModelFinding {
  severity: 'blocking' | 'warning' | 'info';
  text: string;
}

export interface ModelOutput {
  council: {
    name: string;
    councillors: number;
    wards: number;
    prSeats: number;
    registeredVoters: number;
  };
  result: SeatAllocationResult;
  totalValidVotes: number;
  /** PR-ballot votes as a share of the roll the delimitation counted, 0–100. */
  turnoutPercent: number;
  majority: number;
  findings: ModelFinding[];
}

export type ModelResult = { ok: true; output: ModelOutput } | { ok: false; reason: string };

const whole = (n: number) => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

export function runModel(input: ModelInput): ModelResult {
  const council = findCouncil(input.municipalityCode);
  const reg = lookupMunicipality(input.municipalityCode);
  if (!council || !reg)
    return { ok: false, reason: 'Choose a municipality from the delimitation.' };
  if (council.wards === null || council.prCouncillors === null) {
    return {
      ok: false,
      reason: `${council.name} is a district council. District council seats are allocated under a different Schedule that this model does not implement.`,
    };
  }

  const parties = input.parties.map((p) => ({
    id: p.id,
    name: p.name.trim() || p.id,
    votes: whole(p.prVotes),
    wardSeatsWon: whole(p.wardSeatsWon),
  }));
  const totalValidVotes = parties.reduce((n, p) => n + p.votes, 0);
  const C = whole(input.independentWardSeats);
  const D = whole(input.noPRListWardSeats);
  const findings: ModelFinding[] = [];

  const partyWards = parties.reduce((n, p) => n + p.wardSeatsWon, 0);
  const decided = partyWards + C + D;
  if (decided > council.wards) {
    return {
      ok: false,
      reason: `${decided} ward seats are entered but ${council.name} has ${council.wards} wards. The delimitation is fixed, so the ward seats entered are wrong.`,
    };
  }
  if (decided < council.wards) {
    findings.push({
      severity: 'warning',
      text: `${council.wards - decided} of ${council.wards} wards have no winner entered. The quota assumes every ward is decided.`,
    });
  }
  if (totalValidVotes === 0) return { ok: false, reason: 'Enter PR votes for at least one party.' };
  if (C + D >= council.councillors)
    return {
      ok: false,
      reason: 'Independent and list-less ward seats cannot fill the whole council.',
    };

  for (const p of parties) {
    if (p.wardSeatsWon > 0 && p.votes === 0) {
      findings.push({
        severity: 'warning',
        text: `${p.name} has ward seats but no PR votes. A party with no PR list belongs in the “no PR list” box, not here.`,
      });
    }
  }

  let result: SeatAllocationResult;
  try {
    result = allocateSeats({
      totalSeats: council.councillors,
      totalValidVotes,
      parties,
      independentWardSeats: C,
      noPRListWardSeats: D,
      municipalityCode: council.code,
    });
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'The model could not run.' };
  }

  if (result.councilSizeFinal > council.councillors) {
    findings.push({
      severity: 'info',
      text: `Overhang: a party won more wards than its vote share entitles it to, so the council grows from ${council.councillors} to ${result.councilSizeFinal} seats.`,
    });
  }
  for (const t of result.tieFlags) {
    findings.push({
      severity: 'blocking',
      text: `A tie on the remainder (${t.remainder}) between ${t.partyIds.join(', ')} leaves ${t.seatsContested} seat${t.seatsContested === 1 ? '' : 's'} unawarded. The Electoral Commission resolves ties, not this model.`,
    });
  }
  const turnoutPercent = Math.round((totalValidVotes / council.registeredVoters) * 1000) / 10;
  if (turnoutPercent > 100) {
    findings.push({
      severity: 'warning',
      text: 'PR votes exceed the roll the delimitation counted. Check the figures; the roll has grown since, but not usually by that much.',
    });
  }

  return {
    ok: true,
    output: {
      council: {
        name: council.name,
        councillors: council.councillors,
        wards: council.wards,
        prSeats: council.prCouncillors,
        registeredVoters: council.registeredVoters,
      },
      result,
      totalValidVotes,
      turnoutPercent,
      majority: Math.floor(result.councilSizeFinal / 2) + 1,
      findings,
    },
  };
}

export interface CsvParse {
  parties: ModelParty[];
  errors: string[];
}

export const CSV_MAX_BYTES = 100_000;
export const CSV_MAX_PARTIES = 40;

/**
 * `Name,PRVotes,WardSeats` with a header row. Plain integers only: a comma
 * is the separator, so a thousands separator would corrupt the row, and the
 * parser says so rather than guessing.
 */
export function parseCsv(text: string): CsvParse {
  const errors: string[] = [];
  if (text.length > CSV_MAX_BYTES)
    return { parties: [], errors: ['The file is too large for this tool.'] };
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '');
  const parties: ModelParty[] = [];
  lines.slice(1).forEach((line, i) => {
    const row = i + 2;
    const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    if (cols.length < 3) return void errors.push(`Row ${row}: expected Name, PRVotes, WardSeats.`);
    const [name, pr, ward] = cols;
    if (!name) return void errors.push(`Row ${row}: the party name is blank.`);
    if (!/^\d+$/.test(pr) || !/^\d+$/.test(ward)) {
      return void errors.push(
        `Row ${row}: votes and seats must be whole numbers without spaces or commas.`,
      );
    }
    parties.push({ id: `csv-${i}`, name, prVotes: Number(pr), wardSeatsWon: Number(ward) });
  });
  if (parties.length > CSV_MAX_PARTIES) {
    return { parties: [], errors: [`More than ${CSV_MAX_PARTIES} parties. Check the file.`] };
  }
  if (lines.length < 2) errors.push('The file needs a header row and at least one party.');
  return { parties: errors.length > 0 ? [] : parties, errors };
}
