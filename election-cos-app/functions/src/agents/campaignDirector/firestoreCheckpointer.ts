/**
 * Election Campaign OS — Campaign Director: the durable checkpoint saver.
 *
 * A LangGraph `BaseCheckpointSaver` over a minimal document-store interface, so
 * an agent run survives the stateless gap between requests — a conversation
 * continues on its thread, and a run paused for human approval can be resumed on
 * a later request. ONE implementation, three stores:
 *
 *   - `firebaseAdminDocStore(db)` — Cloud Functions (Path A, held);
 *   - the worker's Firestore-REST store (`worker/src/index.ts`, Path B);
 *   - `memoryDocStore()` — tests and the workerd harness.
 *
 * TENANT-SCOPED BY CONSTRUCTION
 *
 * Every path is `tenants/{tenantId}/agentCheckpoints/{threadId}/...`, and the
 * thread id must arrive as `<tenantId>:<threadId>` or the saver throws. The
 * caller derives that tenant from the verified token (runAgent), so a checkpoint
 * can never be read or resumed across tenants. `agentCheckpoints` is server-only
 * in firestore.rules (`allow read, write: if false`).
 *
 * LAYOUT
 *
 *   .../agentCheckpoints/{threadId}/heads/{nsKey}                  { checkpointId }
 *   .../agentCheckpoints/{threadId}/checkpoints/{checkpointId}     the checkpoint
 *   .../checkpoints/{checkpointId}/writes/{taskId}_{idx}           pending writes
 *
 * The `heads` pointer means loading a thread's latest state costs a fixed few
 * reads, not a listing of everything it has ever saved — on the edge every read
 * is a metered subrequest. Writes go out as one atomic batch per step.
 *
 * Corrected from the first version: "latest" is the head pointer, not a
 * `createdAt` millisecond sort (two checkpoints in one millisecond ordered
 * arbitrarily); pending writes are replayed in the library's own
 * `writesSortKey` order (by task path), not by index alone; serialisation uses
 * `btoa`/`atob`, which exist in both Node and workerd, not Node's `Buffer`.
 */
import {
  BaseCheckpointSaver,
  compareWritesSortKeys,
  writesSortKey,
  type ChannelVersions,
  type Checkpoint,
  type CheckpointListOptions,
  type CheckpointMetadata,
  type CheckpointPendingWrite,
  type CheckpointTuple,
  type PendingWrite,
  type SerializerProtocol,
} from '@langchain/langgraph-checkpoint';
import type { RunnableConfig } from '@langchain/core/runnables';
import type { Firestore } from 'firebase-admin/firestore';

// ---------------------------------------------------------------- the store

export type DocData = Record<string, unknown>;

/** The three operations the saver needs. Values are JSON-safe primitives. */
export interface CheckpointDocStore {
  get(path: string): Promise<DocData | null>;
  /** Atomic batch of full-document writes (create or replace). */
  setMany(writes: Array<{ path: string; data: DocData }>): Promise<void>;
  /** Every document directly in a collection. */
  list(collectionPath: string): Promise<Array<{ id: string; data: DocData }>>;
}

/** Firestore documents cap at 1 MiB; base64 inflates by a third. Refuse well before. */
export const MAX_CHECKPOINT_CHARS = 900_000;

export class CheckpointTooLargeError extends Error {
  constructor(chars: number) {
    super(`CheckpointTooLargeError: a checkpoint of ${chars} characters exceeds ${MAX_CHECKPOINT_CHARS}; start a new thread.`);
    this.name = 'CheckpointTooLargeError';
  }
}

// --------------------------------------------------------------- scoping

/**
 * Pull the tenantId and raw threadId out of a `<tenantId>:<threadId>` string.
 * Fails closed: no colon, an empty half, or a `/` (which would escape the
 * document path) throws rather than guessing.
 */
export function parseScopedThread(rawThreadId: unknown): { tenantId: string; threadId: string } {
  if (typeof rawThreadId !== 'string' || !rawThreadId.includes(':')) {
    throw new Error("FirestoreCheckpointSaver: thread_id must be tenant-scoped as '<tenantId>:<threadId>'.");
  }
  const idx = rawThreadId.indexOf(':');
  const tenantId = rawThreadId.slice(0, idx).trim();
  const threadId = rawThreadId.slice(idx + 1).trim();
  if (!tenantId || !threadId) {
    throw new Error('FirestoreCheckpointSaver: invalid tenantId or threadId.');
  }
  if (tenantId.includes('/') || threadId.includes('/')) {
    throw new Error('FirestoreCheckpointSaver: tenantId and threadId may not contain "/".');
  }
  return { tenantId, threadId };
}

// ------------------------------------------------------------- encoding

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

/** A namespace as a document id: '' → 'root', otherwise hex (ids may not hold '/'). */
function nsKey(ns: string): string {
  if (!ns) return 'root';
  return `ns-${Array.from(new TextEncoder().encode(ns), (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

interface StoredCheckpoint {
  tenantId: string;
  threadId: string;
  checkpointNs: string;
  checkpointId: string;
  parentCheckpointId: string | null;
  type: string;
  checkpointBase64: string;
  metadataType: string;
  metadataBase64: string;
  createdAt: number;
  deletedAt: number | null;
}

interface StoredWrite {
  taskId: string;
  taskPath: string;
  idx: number;
  channel: string;
  type: string;
  valueBase64: string;
}

// ---------------------------------------------------------------- saver

export class DocStoreCheckpointSaver extends BaseCheckpointSaver {
  private readonly store: CheckpointDocStore;

  constructor(store: CheckpointDocStore, serde?: SerializerProtocol) {
    super(serde);
    this.store = store;
  }

  private base(t: string, th: string) {
    return `tenants/${t}/agentCheckpoints/${th}`;
  }
  private checkpointPath(t: string, th: string, id: string) {
    return `${this.base(t, th)}/checkpoints/${id}`;
  }
  private headPath(t: string, th: string, ns: string) {
    return `${this.base(t, th)}/heads/${nsKey(ns)}`;
  }

  private async toTuple(t: string, th: string, cp: StoredCheckpoint): Promise<CheckpointTuple> {
    const checkpoint = (await this.serde.loadsTyped(cp.type, fromBase64(cp.checkpointBase64))) as Checkpoint;
    const metadata = (await this.serde.loadsTyped(cp.metadataType, fromBase64(cp.metadataBase64))) as CheckpointMetadata;

    const rows = (await this.store.list(`${this.checkpointPath(t, th, cp.checkpointId)}/writes`)).map(
      (d) => d.data as unknown as StoredWrite,
    );
    rows.sort((a, b) =>
      compareWritesSortKeys(writesSortKey(a.taskPath ?? '', a.taskId, a.idx), writesSortKey(b.taskPath ?? '', b.taskId, b.idx)),
    );
    const pendingWrites: CheckpointPendingWrite[] = [];
    for (const w of rows) {
      pendingWrites.push([w.taskId, w.channel, await this.serde.loadsTyped(w.type, fromBase64(w.valueBase64))]);
    }

    const thread_id = `${t}:${th}`;
    return {
      config: { configurable: { thread_id, checkpoint_ns: cp.checkpointNs, checkpoint_id: cp.checkpointId } },
      checkpoint,
      metadata,
      parentConfig: cp.parentCheckpointId
        ? { configurable: { thread_id, checkpoint_ns: cp.checkpointNs, checkpoint_id: cp.parentCheckpointId } }
        : undefined,
      pendingWrites,
    };
  }

  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    const { tenantId, threadId } = parseScopedThread(config.configurable?.thread_id);
    const ns = (config.configurable?.checkpoint_ns as string | undefined) ?? '';
    let id = config.configurable?.checkpoint_id as string | undefined;
    if (!id) {
      const head = await this.store.get(this.headPath(tenantId, threadId, ns));
      id = typeof head?.checkpointId === 'string' ? head.checkpointId : undefined;
      if (!id) return undefined;
    }
    const cp = (await this.store.get(this.checkpointPath(tenantId, threadId, id))) as StoredCheckpoint | null;
    if (!cp || cp.deletedAt !== null || cp.checkpointNs !== ns) return undefined;
    return this.toTuple(tenantId, threadId, cp);
  }

  async *list(config: RunnableConfig, options?: CheckpointListOptions): AsyncGenerator<CheckpointTuple> {
    const { tenantId, threadId } = parseScopedThread(config.configurable?.thread_id);
    const ns = (config.configurable?.checkpoint_ns as string | undefined) ?? '';
    const before = options?.before?.configurable?.checkpoint_id as string | undefined;

    const rows = (await this.store.list(`${this.base(tenantId, threadId)}/checkpoints`))
      .map((d) => d.data as unknown as StoredCheckpoint)
      .filter((c) => c.checkpointNs === ns && c.deletedAt === null && (!before || c.checkpointId < before))
      // LangGraph checkpoint ids are time-ordered (uuid6): newest first.
      .sort((a, b) => (a.checkpointId < b.checkpointId ? 1 : a.checkpointId > b.checkpointId ? -1 : 0));

    let yielded = 0;
    for (const cp of rows) {
      if (options?.limit !== undefined && yielded >= options.limit) return;
      const tuple = await this.toTuple(tenantId, threadId, cp);
      if (options?.filter) {
        const md = tuple.metadata as Record<string, unknown> | undefined;
        if (!Object.entries(options.filter).every(([k, v]) => md?.[k] === v)) continue;
      }
      yielded += 1;
      yield tuple;
    }
  }

  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata,
    _newVersions: ChannelVersions,
  ): Promise<RunnableConfig> {
    const { tenantId, threadId } = parseScopedThread(config.configurable?.thread_id);
    const ns = (config.configurable?.checkpoint_ns as string | undefined) ?? '';
    const parentCheckpointId = (config.configurable?.checkpoint_id as string | undefined) ?? null;

    const [type, cpBytes] = await this.serde.dumpsTyped(checkpoint);
    const [metadataType, mdBytes] = await this.serde.dumpsTyped(metadata);
    const checkpointBase64 = toBase64(cpBytes);
    const metadataBase64 = toBase64(mdBytes);
    const chars = checkpointBase64.length + metadataBase64.length;
    if (chars > MAX_CHECKPOINT_CHARS) throw new CheckpointTooLargeError(chars);

    const doc: StoredCheckpoint = {
      tenantId,
      threadId,
      checkpointNs: ns,
      checkpointId: checkpoint.id,
      parentCheckpointId,
      type,
      checkpointBase64,
      metadataType,
      metadataBase64,
      createdAt: Date.now(),
      deletedAt: null,
    };
    // The checkpoint and the head pointer move together, or not at all.
    await this.store.setMany([
      { path: this.checkpointPath(tenantId, threadId, checkpoint.id), data: doc as unknown as DocData },
      { path: this.headPath(tenantId, threadId, ns), data: { checkpointId: checkpoint.id, checkpointNs: ns } },
    ]);
    return { configurable: { thread_id: `${tenantId}:${threadId}`, checkpoint_ns: ns, checkpoint_id: checkpoint.id } };
  }

  async putWrites(config: RunnableConfig, writes: PendingWrite[], taskId: string, taskPath?: string): Promise<void> {
    const { tenantId, threadId } = parseScopedThread(config.configurable?.thread_id);
    const checkpointId = config.configurable?.checkpoint_id as string | undefined;
    if (!checkpointId) throw new Error('FirestoreCheckpointSaver.putWrites: checkpoint_id is required.');
    if (writes.length === 0) return;

    const col = `${this.checkpointPath(tenantId, threadId, checkpointId)}/writes`;
    const batch: Array<{ path: string; data: DocData }> = [];
    for (let idx = 0; idx < writes.length; idx += 1) {
      const [channel, value] = writes[idx];
      const [type, bytes] = await this.serde.dumpsTyped(value);
      const row: StoredWrite = {
        taskId,
        taskPath: taskPath ?? '',
        idx,
        channel: String(channel),
        type,
        valueBase64: toBase64(bytes),
      };
      // Each write is its own document, under the same 1 MiB Firestore limit.
      if (row.valueBase64.length > MAX_CHECKPOINT_CHARS) throw new CheckpointTooLargeError(row.valueBase64.length);
      batch.push({ path: `${col}/${taskId}_${idx}`, data: row as unknown as DocData });
    }
    await this.store.setMany(batch);
  }

  /** Soft-delete, honouring the ECOS SOFT_DELETE policy rather than removing history. */
  async deleteThread(rawThreadId: string): Promise<void> {
    const { tenantId, threadId } = parseScopedThread(rawThreadId);
    const now = Date.now();
    const cps = await this.store.list(`${this.base(tenantId, threadId)}/checkpoints`);
    const heads = await this.store.list(`${this.base(tenantId, threadId)}/heads`);
    const batch = [
      ...cps
        .filter((d) => (d.data as unknown as StoredCheckpoint).deletedAt === null)
        .map((d) => ({ path: `${this.base(tenantId, threadId)}/checkpoints/${d.id}`, data: { ...d.data, deletedAt: now } })),
      ...heads.map((d) => ({ path: `${this.base(tenantId, threadId)}/heads/${d.id}`, data: { ...d.data, checkpointId: null } })),
    ];
    if (batch.length) await this.store.setMany(batch);
  }
}

// --------------------------------------------------------------- stores

/** Cloud Functions store (firebase-admin). Batches chunked under Firestore's 500-write cap. */
export function firebaseAdminDocStore(db: Firestore): CheckpointDocStore {
  return {
    async get(path) {
      const snap = await db.doc(path).get();
      return snap.exists ? (snap.data() as DocData) : null;
    },
    async setMany(writes) {
      for (let i = 0; i < writes.length; i += 400) {
        const batch = db.batch();
        for (const w of writes.slice(i, i + 400)) batch.set(db.doc(w.path), w.data);
        await batch.commit();
      }
    },
    async list(collectionPath) {
      const snap = await db.collection(collectionPath).get();
      return snap.docs.map((d) => ({ id: d.id, data: d.data() as DocData }));
    },
  };
}

/**
 * In-memory store for tests and the workerd harness. Values round-trip through
 * JSON, as they would through Firestore, so a non-serialisable value fails here
 * rather than in production.
 */
export function memoryDocStore(): CheckpointDocStore & { paths(): string[] } {
  const docs = new Map<string, string>();
  return {
    async get(path) {
      const v = docs.get(path);
      return v === undefined ? null : (JSON.parse(v) as DocData);
    },
    async setMany(writes) {
      for (const w of writes) docs.set(w.path, JSON.stringify(w.data));
    },
    async list(collectionPath) {
      const prefix = `${collectionPath}/`;
      return [...docs.entries()]
        .filter(([p]) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'))
        .map(([p, v]) => ({ id: p.slice(prefix.length), data: JSON.parse(v) as DocData }));
    },
    paths: () => [...docs.keys()].sort(),
  };
}

/** The Cloud Functions saver, unchanged at its call site. */
export class FirestoreCheckpointSaver extends DocStoreCheckpointSaver {
  constructor(db: Firestore, serde?: SerializerProtocol) {
    super(firebaseAdminDocStore(db), serde);
  }
}
