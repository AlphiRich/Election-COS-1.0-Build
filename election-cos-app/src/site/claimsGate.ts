/**
 * Election Campaign OS — the claims gate (white paper C.7) and the
 * neutrality / forbidden-claim lists the lint test enforces.
 *
 * A claim on the public site shows only if its check has passed. "Passed"
 * is judged from the data, not from a flag somebody can flip: a row whose
 * test reference is still a bracketed placeholder has no check behind it
 * yet, and a row whose own text is a placeholder has nothing to show.
 *
 * - 'hidden'  : the row's wording is still a placeholder → not rendered
 * - 'pending' : wording exists but the LEG-03 reference is unfilled →
 *               rendered, labelled as a draft awaiting its check
 * - 'passed'  : wording and reference both present
 */
import { PLACEHOLDER_RE, type ClaimRow } from './siteContent';

export type ClaimGate = 'passed' | 'pending' | 'hidden';

export function claimGate(row: ClaimRow): ClaimGate {
  if (PLACEHOLDER_RE.test(row.does) || PLACEHOLDER_RE.test(row.not)) return 'hidden';
  if (PLACEHOLDER_RE.test(row.ref)) return 'pending';
  return 'passed';
}

export function gatedClaims(rows: readonly ClaimRow[]): { row: ClaimRow; gate: ClaimGate }[] {
  return rows.map((row) => ({ row, gate: claimGate(row) })).filter((c) => c.gate !== 'hidden');
}

/**
 * Wording the site must never assert. Each may appear only inside the
 * "what we will not claim" column, as a negated claim.
 */
export const FORBIDDEN_CLAIMS: readonly RegExp[] = [
  /\bensures? (?:full )?compliance\b/i,
  /\bfiles? (?:\w+ )?with the IEC\b/i,
  /\bdeletes? (?:your |all )?data\b/i,
  /\bdata never leaves South Africa\b/i,
  /\bmanages? gathering permits?\b/i,
];

/**
 * Neutral by construction: no party names on the marketing surfaces.
 * Voter-tool pages that display official register data are outside this
 * lint and are listed in docs/website-reconciliation.md.
 */
export const PARTY_NAMES: readonly RegExp[] = [
  /\bANC\b/,
  /\bEFF\b/,
  /\bIFP\b/,
  /\bActionSA\b/i,
  /\bMK Party\b/i,
  /\bVF Plus\b/i,
  /\bAfrican National Congress\b/i,
  /\bDemocratic Alliance\b/i,
  /\bEconomic Freedom Fighters\b/i,
  /\bInkatha\b/i,
  /\bPatriotic Alliance\b/i,
];
