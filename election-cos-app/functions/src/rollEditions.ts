/**
 * Election Campaign OS — roll-edition activation: the decision
 *
 * Which voters'-roll edition devices use is a single pointer, `roll_meta/active`.
 * Bulk roll records are written only by the server-side ingest (tools/voters-roll),
 * never a client; this file decides whether an authorized admin may flip that
 * pointer to an edition that is already fully loaded. The Firestore and Auth
 * wiring is in rollEditionsCallables.ts; the guards are here, pure and tested.
 *
 * An edition's own document (`roll_meta/{edition}`) carries a load status:
 *   LOADING — the ingest is mid-run; not safe to activate.
 *   LOADED  — fully written and reconciled; activatable.
 *   FAILED  — the ingest refused or broke; never activatable.
 * Active-ness is NOT a status: it is the pointer. So activating one edition
 * does not mutate another's status — it only moves `active`.
 */
export type RollEditionStatus = 'LOADING' | 'LOADED' | 'FAILED';

export interface RollEditionMeta {
  edition: string;
  status: RollEditionStatus;
  entries: number;
  addresses: number;
  /** ISO 8601, when the ingest finished. */
  loadedAt: string | null;
  note?: string;
}

export type ActivationDecision =
  | { ok: true }
  | { ok: false; code: 'permission-denied' | 'failed-precondition' | 'not-found' | 'invalid-argument'; message: string };

/** Mirrors the client's secondFactorSatisfied: an exempt token (mfaRequired === false) passes; otherwise mfaUntil must be live. */
export function mfaSatisfied(
  token: { mfaRequired?: boolean; mfaUntil?: number },
  nowMs: number,
): boolean {
  if (token.mfaRequired === false) return true;
  return typeof token.mfaUntil === 'number' && token.mfaUntil * 1000 > nowMs;
}

export function decideActivation(input: {
  caps: string[];
  token: { mfaRequired?: boolean; mfaUntil?: number };
  nowMs: number;
  edition: string;
  editionDoc: Pick<RollEditionMeta, 'status'> | null;
}): ActivationDecision {
  if (!input.edition || typeof input.edition !== 'string') {
    return { ok: false, code: 'invalid-argument', message: 'Name the edition to activate.' };
  }
  // The pointer doc itself must never be addressed as an edition.
  if (input.edition === 'active') {
    return { ok: false, code: 'invalid-argument', message: '"active" is the pointer, not an edition.' };
  }
  if (!input.caps.includes('roll.manage')) {
    return { ok: false, code: 'permission-denied', message: 'Requires the roll.manage capability.' };
  }
  if (!mfaSatisfied(input.token, input.nowMs)) {
    return { ok: false, code: 'failed-precondition', message: 'Pass the second sign-in step before changing the live roll.' };
  }
  if (!input.editionDoc) {
    return { ok: false, code: 'not-found', message: `No roll edition "${input.edition}" is loaded.` };
  }
  if (input.editionDoc.status !== 'LOADED') {
    return {
      ok: false,
      code: 'failed-precondition',
      message:
        input.editionDoc.status === 'LOADING'
          ? 'That edition is still loading. Wait until the ingest reports it loaded.'
          : 'That edition did not load cleanly and cannot be made active.',
    };
  }
  return { ok: true };
}
