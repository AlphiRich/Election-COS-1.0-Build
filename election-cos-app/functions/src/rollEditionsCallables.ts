/**
 * Election Campaign OS — roll-edition activation callable
 *
 * @deployable fails-closed
 *
 * `setActiveRollEdition` moves the `roll_meta/active` pointer to an edition that
 * is already fully loaded. It writes nothing but the pointer: bulk roll records
 * are the ingest's job (tools/voters-roll), and this never touches them. The
 * decision — capability, second factor, the edition exists and is LOADED — is in
 * rollEditions.ts; this file is the Firestore wiring. Caller identity and
 * capability come from the verified token, never the payload, so a client cannot
 * name another tenant or grant itself the capability.
 *
 * roll_meta stays `write: if false` in firestore.rules; this runs with the admin
 * SDK, the one writer of the pointer from the application side.
 */
import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { REGION } from './region';
import { decideActivation, type RollEditionStatus } from './rollEditions';

if (!getApps().length) initializeApp();

function caller(request: CallableRequest): { uid: string; tenantId: string; caps: string[]; mfaRequired?: boolean; mfaUntil?: number } {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  const t = request.auth.token as { tenantId?: unknown; caps?: unknown; mfaRequired?: unknown; mfaUntil?: unknown };
  if (typeof t.tenantId !== 'string' || !t.tenantId) {
    throw new HttpsError('permission-denied', 'This account is not attached to a tenant.');
  }
  return {
    uid: request.auth.uid,
    tenantId: t.tenantId,
    caps: Array.isArray(t.caps) ? (t.caps as string[]) : [],
    mfaRequired: typeof t.mfaRequired === 'boolean' ? t.mfaRequired : undefined,
    mfaUntil: typeof t.mfaUntil === 'number' ? t.mfaUntil : undefined,
  };
}

export const setActiveRollEdition = onCall<{ edition?: unknown }>({ region: REGION }, async (request) => {
  const who = caller(request);
  const edition = typeof request.data?.edition === 'string' ? request.data.edition.trim() : '';

  const db = getFirestore();
  const metaRef = (id: string) => db.doc(`tenants/${who.tenantId}/roll_meta/${id}`);

  // Only read the edition doc once the capability holds, so a caller without it
  // cannot probe which editions exist. decideActivation enforces that order too,
  // but we avoid even the read here.
  if (!who.caps.includes('roll.manage')) {
    throw new HttpsError('permission-denied', 'Requires the roll.manage capability.');
  }

  const snap = edition && edition !== 'active' ? await metaRef(edition).get() : null;
  const editionDoc = snap?.exists ? { status: (snap.data() as { status?: RollEditionStatus }).status ?? 'FAILED' } : null;

  const decision = decideActivation({
    caps: who.caps,
    token: { mfaRequired: who.mfaRequired, mfaUntil: who.mfaUntil },
    nowMs: Date.now(),
    edition,
    editionDoc,
  });
  if (!decision.ok) throw new HttpsError(decision.code, decision.message);

  await metaRef('active').set(
    { edition, updatedAt: FieldValue.serverTimestamp(), updatedBy: who.uid },
    { merge: true },
  );
  return { edition };
});
