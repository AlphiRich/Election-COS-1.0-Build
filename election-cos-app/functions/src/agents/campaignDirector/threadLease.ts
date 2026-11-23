/**
 * Election Campaign OS — Campaign Director: one run per thread at a time.
 *
 * Two requests on the same durable thread would each load the same checkpoint,
 * run, and write — forking the history, and, on a resume, dispatching the same
 * approved incident twice. So a run on a durable thread first takes a short
 * LEASE on it; a second request while the lease is held is refused
 * (`thread-busy`), never queued or merged.
 *
 * The lease is a document beside the thread's checkpoints
 * (`tenants/{t}/agentCheckpoints/{thread}/lease/current`), covered by the same
 * server-only rule. It expires after `LEASE_TTL_MS`, so a run that died without
 * releasing does not lock the thread for ever. Acquisition is atomic in every
 * back end: a create-if-absent, or a takeover of an EXPIRED lease conditioned on
 * the exact version read.
 *
 * Library module — no `@deployable` marker.
 */
import { parseScopedThread } from './firestoreCheckpointer';
import type { VersionedDocStore } from '../../versionedDocStore';

/** Longer than any single run (8 model calls); short enough to self-heal. */
export const LEASE_TTL_MS = 120_000;

export interface ThreadLease {
  /** A token when the lease was taken; null when another run holds it. */
  acquire(scopedThreadId: string, nowMs: number): Promise<string | null>;
  /** Release only if `token` still holds it (a taken-over lease is left alone). */
  release(scopedThreadId: string, token: string): Promise<void>;
}

/** Where a scoped thread's lease document lives. */
export function leasePath(scopedThreadId: string): string {
  const { tenantId, threadId } = parseScopedThread(scopedThreadId);
  return `tenants/${tenantId}/agentCheckpoints/${threadId}/lease/current`;
}

export function newLeaseToken(): string {
  return globalThis.crypto.randomUUID();
}

/** In-process lease (tests; a single isolate). */
export function memoryThreadLease(): ThreadLease {
  const held = new Map<string, { token: string; expiresAt: number }>();
  return {
    async acquire(id, nowMs) {
      const path = leasePath(id);
      const cur = held.get(path);
      if (cur && cur.expiresAt > nowMs) return null;
      const token = newLeaseToken();
      held.set(path, { token, expiresAt: nowMs + LEASE_TTL_MS });
      return token;
    },
    async release(id, token) {
      const path = leasePath(id);
      if (held.get(path)?.token === token) held.delete(path);
    },
  };
}

/** Minimal Admin SDK surface, typed structurally so this file imports no firebase-admin. */
interface AdminDocRef {
  get(): Promise<{ exists: boolean; data(): unknown }>;
}
interface AdminLike {
  doc(path: string): AdminDocRef;
  runTransaction<T>(
    fn: (tx: {
      get(ref: AdminDocRef): Promise<{ exists: boolean; data(): unknown }>;
      set(ref: AdminDocRef, data: Record<string, unknown>): unknown;
      delete(ref: AdminDocRef): unknown;
    }) => Promise<T>,
  ): Promise<T>;
}

/** Cloud Functions lease, over an Admin SDK transaction. */
export function firebaseAdminThreadLease(db: AdminLike): ThreadLease {
  return {
    acquire: (id, nowMs) =>
      db.runTransaction(async (tx) => {
        const ref = db.doc(leasePath(id));
        const snap = await tx.get(ref);
        const cur = snap.exists ? (snap.data() as { expiresAt?: number }) : null;
        if (cur && typeof cur.expiresAt === 'number' && cur.expiresAt > nowMs) return null;
        const token = newLeaseToken();
        tx.set(ref, { token, expiresAt: nowMs + LEASE_TTL_MS });
        return token;
      }),
    release: (id, token) =>
      db.runTransaction(async (tx) => {
        const ref = db.doc(leasePath(id));
        const snap = await tx.get(ref);
        if (snap.exists && (snap.data() as { token?: string }).token === token) tx.delete(ref);
      }),
  };
}

/**
 * The lease over a store with optimistic concurrency (the worker's Firestore
 * REST). Create-if-absent; or take over an EXPIRED lease only if it is
 * unchanged since read. Release deletes only the lease this run still holds.
 */
export function versionedThreadLease(store: VersionedDocStore): ThreadLease {
  return {
    async acquire(id, nowMs) {
      const path = leasePath(id);
      const token = newLeaseToken();
      const data = { token, expiresAt: nowMs + LEASE_TTL_MS };
      if (await store.commit([{ path, data, ifVersion: null }])) return token;
      const cur = await store.getVersioned(path);
      if (!cur) return (await store.commit([{ path, data, ifVersion: null }])) ? token : null;
      const expiresAt = cur.data.expiresAt;
      if (typeof expiresAt === 'number' && expiresAt > nowMs) return null;
      return (await store.commit([{ path, data, ifVersion: cur.version }])) ? token : null;
    },
    async release(id, token) {
      const path = leasePath(id);
      const cur = await store.getVersioned(path);
      if (cur?.data.token === token) await store.commit([{ path, delete: true, ifVersion: cur.version }]);
    },
  };
}
