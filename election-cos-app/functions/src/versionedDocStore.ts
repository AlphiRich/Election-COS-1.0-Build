/**
 * Election Campaign OS — a document store with optimistic concurrency.
 *
 * The smallest surface that lets a runtime with no transactions SDK (the
 * Cloudflare worker, over Firestore REST) still make an atomic
 * read-check-write: read a document with its version, then commit only if the
 * version is unchanged (or, for `ifVersion: null`, only if it still does not
 * exist). A `false` from `commit` means someone else wrote first; the caller
 * re-reads and decides again.
 *
 * Used by the paid-usage ledger (`optimisticSpendStore`, costGuardCore.ts) and
 * the Campaign Director's thread lease (`versionedThreadLease`). Pure: no
 * firebase-admin, so the worker can bundle it.
 */
export type DocFields = Record<string, unknown>;

export interface VersionedDoc {
  data: DocFields;
  /** Opaque; Firestore's `updateTime`. */
  version: string;
}

export interface VersionedWrite {
  path: string;
  /** Full replacement; omit with `delete: true`. */
  data?: DocFields;
  delete?: true;
  /** `undefined` → unconditional; `null` → must not exist; a version → must be unchanged. */
  ifVersion?: string | null;
}

export interface VersionedDocStore {
  getVersioned(path: string): Promise<VersionedDoc | null>;
  /** All writes or none. `false` when a precondition failed (a concurrent writer). */
  commit(writes: VersionedWrite[]): Promise<boolean>;
}

/** In-memory store with real precondition semantics (tests). */
export function memoryVersionedStore(): VersionedDocStore & { peek(path: string): DocFields | undefined } {
  const docs = new Map<string, { data: DocFields; version: string }>();
  let clock = 0;
  return {
    peek: (path) => docs.get(path)?.data,
    async getVersioned(path) {
      const d = docs.get(path);
      return d ? { data: structuredClone(d.data), version: d.version } : null;
    },
    async commit(writes) {
      for (const w of writes) {
        if (w.ifVersion === undefined) continue;
        const cur = docs.get(w.path);
        if (w.ifVersion === null ? cur !== undefined : cur?.version !== w.ifVersion) return false;
      }
      for (const w of writes) {
        if (w.delete) docs.delete(w.path);
        else docs.set(w.path, { data: structuredClone(w.data ?? {}), version: `v${(clock += 1)}` });
      }
      return true;
    },
  };
}
