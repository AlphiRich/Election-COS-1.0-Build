/**
 * Election Campaign OS — change between election cycles for one council.
 *
 * Works on the stored council documents, so the same call serves 2016 vs 2021 vs 2026 once those cycles are loaded. Only
 * cycles that are in the database can be compared; this file never supplies a figure for one that is not.
 */
import type { CouncilDoc, PartyVote } from './model';

export type BallotKey = 'ward' | 'pr';

export interface PartyChange {
  party: string;
  before: number | null;
  after: number | null;
  /** Percentage points; a party absent from a cycle counts as 0 share. */
  swing: number;
}

const total = (rows: PartyVote[]): number => rows.reduce((n, r) => n + r.votes, 0);

export function shares(rows: PartyVote[]): Map<string, number> {
  const t = total(rows);
  return new Map(rows.map((r) => [r.party, t > 0 ? (100 * r.votes) / t : 0]));
}

/** Turnout against ONE ballot, never the sum of two (a voter casts both). */
export function turnout(c: Pick<CouncilDoc, 'registered' | 'ballots'>, ballot: BallotKey = 'pr'): number | null {
  const b = c.ballots[ballot];
  return c.registered > 0 ? (100 * (b.valid + b.spoilt)) / c.registered : null;
}

export function swing(before: CouncilDoc, after: CouncilDoc, ballot: BallotKey = 'pr'): PartyChange[] {
  if (before.code !== after.code) {
    throw new Error(`Not the same council: ${before.code} and ${after.code}. A code can be reused for a different municipality across delimitations.`);
  }
  const a = shares(before.parties[ballot]);
  const b = shares(after.parties[ballot]);
  const names = new Set([...a.keys(), ...b.keys()]);
  return [...names]
    .map((party) => ({ party, before: a.get(party) ?? null, after: b.get(party) ?? null, swing: (b.get(party) ?? 0) - (a.get(party) ?? 0) }))
    .sort((x, y) => Math.abs(y.swing) - Math.abs(x.swing));
}
