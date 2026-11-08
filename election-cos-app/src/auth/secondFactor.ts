/**
 * Election Campaign OS — second sign-in factor, client side.
 *
 * Email sign-in first; then, for every role above the volunteer / canvasser, a one-time code sent
 * by SMS to the number on the staff profile. The decision is made on the server (`mfaOK()` in
 * firestore.rules reads the `mfaUntil` token claim); this file only decides what to SHOW, so a
 * person who has not passed it sees the code screen and not a wall of permission errors.
 *
 * Which roles owe the code is decided on the server (functions/src/secondFactor.ts) and arrives as
 * the `mfaRequired` claim; nothing here names a role. The phone number never reaches the browser: the server reads it from the profile and
 * returns a mask.
 */
import { httpsCallable } from 'firebase/functions';
import { getFirebaseAuth, getFunctionsClient } from '@/dal/adapters/firestore/client';

/**
 * Whether the person has cleared the second step. `mfaRequired` is the server's decision, stamped
 * on the token; an absent claim counts as required (fail closed), matching firestore.rules.
 */
export function secondFactorSatisfied(
  session: { mfaRequired?: boolean; mfaUntil?: number },
  nowMs: number = Date.now(),
): boolean {
  if (session.mfaRequired === false) return true;
  return typeof session.mfaUntil === 'number' && session.mfaUntil * 1000 > nowMs;
}

export type CodeRequest =
  | { ok: true; challengeId: string; phoneMasked: string; expiresAt: number }
  | { ok: false; message: string };

export type CodeCheck = { ok: true } | { ok: false; message: string };

/** The seam tests replace; the real one calls the two Cloud Functions. */
export interface SecondFactorGateway {
  request(): Promise<CodeRequest>;
  verify(challengeId: string, code: string): Promise<CodeCheck>;
}

function messageFor(error: unknown): string {
  const e = error as { code?: string; message?: string };
  if (e?.code?.endsWith('resource-exhausted')) return 'A code was just sent. Wait a minute before asking for another.';
  if (e?.code?.endsWith('failed-precondition') && e.message) return e.message;
  return 'The code could not be sent. Try again in a moment.';
}

export const firebaseGateway: SecondFactorGateway = {
  async request() {
    try {
      const call = httpsCallable<unknown, { challengeId: string; phoneMasked: string; expiresAt: number }>(
        getFunctionsClient(),
        'requestSecondFactorCode',
      );
      return { ok: true, ...(await call({})).data };
    } catch (error) {
      return { ok: false, message: messageFor(error) };
    }
  },
  async verify(challengeId, code) {
    try {
      const call = httpsCallable<{ challengeId: string; code: string }, { kind: string; attemptsRemaining?: number }>(
        getFunctionsClient(),
        'verifySecondFactorCode',
      );
      const { data } = await call({ challengeId, code });
      if (data.kind === 'VERIFIED') {
        // The new claim only reaches the browser with a fresh token; AuthProvider's
        // onIdTokenChanged then re-renders the Shell past this screen.
        await getFirebaseAuth().currentUser?.getIdToken(true);
        return { ok: true };
      }
      const why: Record<string, string> = {
        WRONG: `That code is not right. ${data.attemptsRemaining ?? 0} tries left.`,
        LOCKED: 'Too many wrong tries. Request a new code.',
        EXPIRED: 'That code has expired. Request a new one.',
        ALREADY_VERIFIED: 'That code was already used. Request a new one.',
      };
      return { ok: false, message: why[data.kind] ?? 'That code could not be checked. Request a new one.' };
    } catch {
      return { ok: false, message: 'The code could not be checked. Try again.' };
    }
  },
};
