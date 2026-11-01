/**
 * Election Campaign OS — party agent station log: the arithmetic
 *
 * What the Act lets an agent do at a voting station is observe, not
 * interfere, and lodge objections or bring irregularities to the
 * presiding or counting officer (section 40(3)). This log is therefore a
 * personal record of what an agent saw, with no field for a voter's name,
 * ID number or how anyone voted. It is not the official result and
 * confirms nothing.
 *
 * `checkCount` compares the number of ballot papers an agent wrote down as
 * counted with the party votes plus rejected papers they copied from the
 * result. A difference means a figure was mis-copied or something is worth
 * raising with the counting officer; it is never evidence of wrongdoing.
 */
export interface CountLine {
  party: string;
  votes: number;
}

export interface CountCheck {
  partyVotes: number;
  rejected: number;
  accountedFor: number;
  ballotsCounted: number;
  difference: number;
  balanced: boolean;
}

function whole(n: number): number {
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function checkCount(
  ballotsCounted: number,
  rejected: number,
  lines: CountLine[],
): CountCheck {
  const partyVotes = lines.reduce((n, l) => n + whole(l.votes), 0);
  const rej = whole(rejected);
  const counted = whole(ballotsCounted);
  const accountedFor = partyVotes + rej;
  return {
    partyVotes,
    rejected: rej,
    accountedFor,
    ballotsCounted: counted,
    difference: counted - accountedFor,
    balanced: counted === accountedFor,
  };
}

export interface StationLog {
  station: string;
  opened: string;
  closed: string;
  hourly: Record<string, number>;
  incidents: Array<{ time: string; note: string }>;
  objections: number;
  count: {
    ballot: string;
    counted: string;
    rejected: string;
    lines: Array<{ party: string; votes: string }>;
  };
}

export function emptyLog(): StationLog {
  return {
    station: '',
    opened: '',
    closed: '',
    hourly: {},
    incidents: [],
    objections: 0,
    count: { ballot: 'Ward', counted: '', rejected: '', lines: [] },
  };
}

export const HOURS = Array.from({ length: 14 }, (_, i) => `${String(7 + i).padStart(2, '0')}:00`);

/** A spreadsheet treats a cell starting with = + - @ as a formula; defuse it. */
function cell(v: string | number): string {
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCsv(log: StationLog): string {
  const rows: Array<Array<string | number>> = [
    ['Section', 'Item', 'Value'],
    ['Station', 'Name or code', log.station],
    ['Station', 'Opened at', log.opened],
    ['Station', 'Closed at', log.closed],
    ['Objections', 'Lodged in writing', log.objections],
  ];
  for (const h of HOURS) rows.push(['Voters observed', h, log.hourly[h] ?? 0]);
  for (const i of log.incidents) rows.push(['Incident', i.time, i.note]);
  rows.push(['Count', 'Ballot', log.count.ballot]);
  rows.push(['Count', 'Ballot papers counted', log.count.counted]);
  rows.push(['Count', 'Rejected', log.count.rejected]);
  for (const l of log.count.lines) rows.push(['Count', l.party, l.votes]);
  return rows.map((r) => r.map(cell).join(',')).join('\r\n');
}
