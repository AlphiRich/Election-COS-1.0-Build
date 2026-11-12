/**
 * Election Campaign OS — hash-chained audit append (Cloud Functions side).
 *
 * Each entry stores `seq`, `prevHash` and `hash = sha256(prevHash \n canonical fields)`.
 * The head (last seq and hash) lives in `tenants/{t}/auditHead/head` and is read and
 * advanced in the SAME transaction as the entry, so two concurrent writers cannot both
 * extend the same predecessor. The head is denied to clients by the default-deny rule.
 *
 * WHAT THIS PROVES, AND WHAT IT DOES NOT: editing or removing a stored entry breaks the
 * chain from that point and `verifyChain` names it. Someone holding admin credentials who
 * rewrites the whole tail AND the head can still forge a consistent chain; an external
 * anchor (publishing the head hash somewhere outside Firestore) is what would close that
 * and is not built. The in-app wording says so.
 *
 * The same canonical form is verified client-side by src/modules/settings/auditChain.ts;
 * a test in each project pins the same fixture hash so the two cannot drift.
 */
import { createHash } from 'node:crypto';

export const GENESIS = '0'.repeat(64);

export interface ChainFields {
  seq: number;
  occurredAtIso: string;
  actorUid: string;
  action: string;
  targetType: string;
  targetId: string;
}

export function chainHash(prevHash: string, f: ChainFields): string {
  const body = JSON.stringify([
    f.seq,
    f.occurredAtIso,
    f.actorUid,
    f.action,
    f.targetType,
    f.targetId,
  ]);
  return createHash('sha256').update(`${prevHash}\n${body}`).digest('hex');
}

/** The slice of Firestore the append needs, so it can be tested with a fake. */
export interface ChainStore {
  runTransaction<T>(fn: (tx: ChainTx) => Promise<T>): Promise<T>;
}
export interface ChainTx {
  getHead(tenantId: string): Promise<{ seq: number; hash: string } | null>;
  setHead(tenantId: string, head: { seq: number; hash: string }): void;
  addEntry(tenantId: string, entry: Record<string, unknown>): void;
}

export async function appendChained(
  store: ChainStore,
  tenantId: string,
  event: {
    actorUid: string;
    action: string;
    targetType: string;
    targetId: string;
    metadata?: Record<string, unknown>;
  },
  now: Date,
): Promise<{ seq: number; hash: string }> {
  return store.runTransaction(async (tx) => {
    const head = await tx.getHead(tenantId);
    const seq = (head?.seq ?? 0) + 1;
    const prevHash = head?.hash ?? GENESIS;
    const occurredAtIso = now.toISOString();
    const hash = chainHash(prevHash, { seq, occurredAtIso, ...pick(event) });
    tx.addEntry(tenantId, {
      tenantId,
      ...pick(event),
      metadata: event.metadata ?? {},
      seq,
      occurredAtIso,
      prevHash,
      hash,
    });
    tx.setHead(tenantId, { seq, hash });
    return { seq, hash };
  });
}

function pick(e: { actorUid: string; action: string; targetType: string; targetId: string }) {
  return { actorUid: e.actorUid, action: e.action, targetType: e.targetType, targetId: e.targetId };
}

/** The Firestore-backed store used by the real writers. */
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';

export function firestoreChainStore(): ChainStore {
  const db = getFirestore();
  return {
    runTransaction: (fn) =>
      db.runTransaction((t) =>
        fn({
          getHead: async (tenantId) => {
            const s = await t.get(db.doc(`tenants/${tenantId}/auditHead/head`));
            return s.exists ? (s.data() as { seq: number; hash: string }) : null;
          },
          setHead: (tenantId, head) =>
            void t.set(db.doc(`tenants/${tenantId}/auditHead/head`), head),
          addEntry: (tenantId, entry) =>
            void t.set(db.collection(`tenants/${tenantId}/auditLog`).doc(), {
              ...entry,
              occurredAt: Timestamp.fromDate(new Date(entry.occurredAtIso as string)),
              chainedAt: FieldValue.serverTimestamp(),
            }),
        }),
      ),
  };
}
