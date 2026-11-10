/**
 * Election Campaign OS — compare this build's Schedule 1 result for a council with the Electoral Commission's own
 * "Seat Calculation Detail" report (as extracted by tools/lge2026/extract-seat-calculation.py).
 *
 * The report identifies a party row by its vote total (names wrap across lines in the PDF), so a row matches when this
 * build has a party with the same votes and the same seats. Returns the differences in words; an empty list means the
 * council reconciles: same B, C and D, same A and quota (or Item 16 quota), every seated party's seats and ward/list
 * split, and the same total.
 */
import { partySeatsOf, seatAllocationOf, seatInputOf, type CouncilBallots, type CouncilHolder, type CouncilTies } from './councilResults';

export interface IecReportRow {
  votes: number;
  round1: number;
  round2: number;
  seats: number;
  wardSeats: number;
  prSeats: number;
}
export interface IecReport {
  code: string;
  excessiveCase: boolean;
  Q: number;
  A: number;
  totalSeats: number;
  independentWardSeats: number;
  noPrListWardSeats: number;
  excessiveVotes: number;
  excessiveSeats: number;
  rows: IecReportRow[];
  partySeatsTotal: number;
  /** The report allocates fewer seats than the council has (Round 2 is zero for every party). */
  incomplete?: boolean;
  unallocatedSeats?: number;
}

/**
 * The council as the Commission's report allocates it, for a council whose report was computed on a later count than its
 * downloadable results file (KZN216, KZN225, FS184 on 10 Nov 2026: every party's report total is slightly higher).
 *
 * The report has no reliable party names, so only its rows that hold seats are named: the k seated rows, in order of
 * votes, are matched to this build's k largest parties in the same order. That is only accepted when it is unambiguous:
 * every pair within 5%, and this build's first party outside the k at least 5% below the smallest seated row (so the set
 * of seated parties cannot be in doubt). Two adjacent rows could have swapped places between the counts when the gap
 * between them is smaller than the two parties' changes added together; then the swap must not change the council: both
 * rows hold the same seats and ward seats. Otherwise this returns null and the council is not shown as matched.
 */
export function holdersFromIecReport(m: CouncilBallots, councillors: number, iec: IecReport, ties?: CouncilTies): CouncilHolder[] | null {
  const mine = [...seatInputOf(m, councillors, ties).parties].sort((a, b) => b.votes - a.votes);
  const seated = iec.rows.filter((x) => x.seats > 0).sort((a, b) => b.votes - a.votes);
  const k = seated.length;
  if (mine.length < k) return null;
  const within = (a: number, b: number) => Math.abs(a - b) <= 0.05 * Math.max(a, b);
  for (let i = 0; i < k; i++) {
    if (!within(mine[i].votes, seated[i].votes)) return null;
    if (i > 0) {
      const gap = seated[i - 1].votes - seated[i].votes;
      const moved = Math.abs(mine[i].votes - seated[i].votes) + Math.abs(mine[i - 1].votes - seated[i - 1].votes);
      const sameCouncil = seated[i].seats === seated[i - 1].seats && seated[i].wardSeats === seated[i - 1].wardSeats;
      if (gap < moved && !sameCouncil) return null;
    }
  }
  if (mine[k] && mine[k].votes > 0.95 * seated[k - 1].votes) return null;
  const out: CouncilHolder[] = seated.map((r, i) => ({ id: mine[i].id, name: mine[i].name, seats: r.seats, wardSeats: r.wardSeats }));
  if (iec.independentWardSeats > 0) out.push({ id: 'IND', name: 'Independent ward councillors', seats: iec.independentWardSeats, wardSeats: iec.independentWardSeats });
  if (out.reduce((s, h) => s + h.seats, 0) + iec.noPrListWardSeats !== iec.totalSeats) return null;
  return out.sort((a, b) => b.seats - a.seats || a.name.localeCompare(b.name));
}

export function reconcile(m: CouncilBallots, councillors: number, iec: IecReport, ties?: CouncilTies): string[] {
  const out: string[] = [];
  const i = seatInputOf(m, councillors, ties);
  const mine = seatAllocationOf(m, councillors, ties);
  const { parties, pending } = partySeatsOf(m, councillors, ties);
  if (i.totalSeats !== iec.totalSeats) out.push(`B ${i.totalSeats} vs ${iec.totalSeats}`);
  if (i.independentWardSeats !== iec.independentWardSeats) out.push(`C ${i.independentWardSeats} vs ${iec.independentWardSeats}`);
  if (i.noPRListWardSeats !== iec.noPrListWardSeats) out.push(`D ${i.noPRListWardSeats} vs ${iec.noPrListWardSeats}`);
  if (!iec.excessiveCase) {
    if (i.totalValidVotes !== iec.A) out.push(`A ${i.totalValidVotes} vs ${iec.A}`);
    if (mine.quota !== iec.Q) out.push(`Q ${mine.quota} vs ${iec.Q}`);
  } else if (mine.newQuota !== iec.Q) out.push(`Item 16 quota ${mine.newQuota} vs ${iec.Q}`);
  // An incomplete report's seat columns are short by design; compare only its inputs (B, C, D, A, Q).
  if (iec.incomplete) return out;
  for (const r of iec.rows.filter((x) => x.seats > 0)) {
    const row = parties.find((p) => p.votes === r.votes && p.totalSeats === r.seats);
    if (!row) out.push(`no party with ${r.votes} votes holding ${r.seats} seats`);
    else if (row.wardSeatsWon !== r.wardSeats) out.push(`${row.name}: ${row.wardSeatsWon} ward seats vs ${r.wardSeats}`);
  }
  if (pending) out.push(`${pending} seat(s) left pending by a tie with no recorded resolution`);
  const seats = parties.reduce((s, p) => s + p.totalSeats, 0) + i.independentWardSeats + i.noPRListWardSeats;
  if (seats !== iec.totalSeats) out.push(`seats add to ${seats}, not ${iec.totalSeats}`);
  return out;
}
