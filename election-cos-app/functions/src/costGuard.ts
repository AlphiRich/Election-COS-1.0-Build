/**
 * Election Campaign OS — monthly paid-usage guard (Admin SDK ledger).
 *
 * The rule and its pure logic live in `costGuardCore.ts`, re-exported here, so the worker can use
 * them without bundling firebase-admin. This file adds the Firestore ledger for Cloud Functions.
 */
export * from './costGuardCore';
import type { Approval, SpendStore } from './costGuardCore';

/* ------------------------------------------------------------- Firestore */
import { getFirestore } from 'firebase-admin/firestore';

/** Ledger at `platform/spend_YYYY-MM`; approval at `platform/costApproval`. Admin SDK only. */
export function firestoreSpendStore(): SpendStore {
  const db = getFirestore();
  return {
    runTransaction: (fn) =>
      db.runTransaction((t) =>
        fn({
          getSpent: async (period) => {
            const s = await t.get(db.doc(`platform/spend_${period}`));
            return s.exists ? Number((s.data() as { cents?: number }).cents ?? 0) : 0;
          },
          getApproval: async () => {
            const s = await t.get(db.doc('platform/costApproval'));
            return s.exists ? (s.data() as Approval) : null;
          },
          setSpent: (period, cents) => void t.set(db.doc(`platform/spend_${period}`), { cents }),
        }),
      ),
  };
}
