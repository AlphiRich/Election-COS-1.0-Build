/**
 * Election Campaign OS — Campaign Director: Firestore checkpoint saver.
 *
 * A LangGraph `BaseCheckpointSaver` backed by Firestore, so an agent run
 * survives the stateless gap between Cloud Function invocations (and a
 * human-in-the-loop pause can be resumed hours later). It is tenant-scoped by
 * construction: every path is
 * `tenants/{tenantId}/agentCheckpoints/{threadId}/checkpoints/...`, and the
 * thread id MUST arrive as `<tenantId>:<threadId>` or the saver throws — it
 * cannot read or write a checkpoint without knowing whose tenant it belongs to
 * (build spec §4.2/§4.4, the harness "Walls").
 *
 * `agentCheckpoints` is a server-only collection (`allow read, write: if false`
 * in firestore.rules): only the Admin SDK touches it, never a client. See the
 * rules + index notes in this folder's README.
 *
 * Adapted from the supplied handoff, corrected to this repo: the thread-id
 * format is a real template string (the handoff PDF rendered it in a math font),
 * and `parseScopedThread` is exported so the tenant-scoping guard is tested on
 * its own (firestoreCheckpointer.test.ts) without a live Firestore — the same
 * split this build uses for sync (syncMerge pure, sync shell).
 */
import type {
  BaseCheckpointSaver,
  Checkpoint,
  CheckpointListOptions,
  CheckpointMetadata,
  CheckpointPendingWrite,
  CheckpointTuple,
  ChannelVersions,
  PendingWrite,
  SerializerProtocol,
} from '@langchain/langgraph-checkpoint';
import { BaseCheckpointSaver as BaseSaver } from '@langchain/langgraph-checkpoint';
import type { RunnableConfig } from '@langchain/core/runnables';
import type { Firestore } from 'firebase-admin/firestore';

interface StoredCheckpointDoc {
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

interface StoredWriteDoc {
  taskId: string;
  idx: number;
  channel: string;
  type: string;
  valueBase64: string;
}

/**
 * Pull the tenantId and raw threadId out of a `<tenantId>:<threadId>` string.
 * Fails closed: no colon, empty tenant, or empty thread throws rather than
 * guessing — a checkpoint is never read or written tenant-unscoped.
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
  return { tenantId, threadId };
}

function scopedThreadId(tenantId: string, threadId: string): string {
  return `${tenantId}:${threadId}`;
}

export class FirestoreCheckpointSaver extends (BaseSaver as typeof BaseCheckpointSaver) {
  private readonly db: Firestore;

  constructor(db: Firestore, serde?: SerializerProtocol) {
    super(serde);
    this.db = db;
  }

  private threadDoc(tenantId: string, threadId: string) {
    return this.db.collection('tenants').doc(tenantId).collection('agentCheckpoints').doc(threadId);
  }

  private checkpointsCol(tenantId: string, threadId: string) {
    return this.threadDoc(tenantId, threadId).collection('checkpoints');
  }

  private writesCol(tenantId: string, threadId: string, checkpointId: string) {
    return this.checkpointsCol(tenantId, threadId).doc(checkpointId).collection('writes');
  }

  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    const { tenantId, threadId } = parseScopedThread(config.configurable?.thread_id);
    const checkpointNs = (config.configurable?.checkpoint_ns as string) ?? '';
    const checkpointId = config.configurable?.checkpoint_id as string | undefined;

    let data: StoredCheckpointDoc | undefined;
    if (checkpointId) {
      const snap = await this.checkpointsCol(tenantId, threadId).doc(checkpointId).get();
      if (!snap.exists) return undefined;
      data = snap.data() as StoredCheckpointDoc;
    } else {
      const snap = await this.checkpointsCol(tenantId, threadId)
        .where('checkpointNs', '==', checkpointNs)
        .where('deletedAt', '==', null)
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();
      if (snap.empty) return undefined;
      data = snap.docs[0].data() as StoredCheckpointDoc;
    }
    if (!data || data.deletedAt !== null) return undefined;

    const checkpoint = (await this.serde.loadsTyped(
      data.type,
      Buffer.from(data.checkpointBase64, 'base64'),
    )) as Checkpoint;
    const metadata = (await this.serde.loadsTyped(
      data.metadataType,
      Buffer.from(data.metadataBase64, 'base64'),
    )) as CheckpointMetadata;

    const writesSnap = await this.writesCol(tenantId, threadId, data.checkpointId).orderBy('idx', 'asc').get();
    const pendingWrites: CheckpointPendingWrite[] = [];
    for (const wDoc of writesSnap.docs) {
      const w = wDoc.data() as StoredWriteDoc;
      const value = await this.serde.loadsTyped(w.type, Buffer.from(w.valueBase64, 'base64'));
      pendingWrites.push([w.taskId, w.channel, value]);
    }

    return {
      config: {
        configurable: {
          thread_id: scopedThreadId(tenantId, threadId),
          checkpoint_ns: data.checkpointNs,
          checkpoint_id: data.checkpointId,
        },
      },
      checkpoint,
      metadata,
      parentConfig: data.parentCheckpointId
        ? {
            configurable: {
              thread_id: scopedThreadId(tenantId, threadId),
              checkpoint_ns: data.checkpointNs,
              checkpoint_id: data.parentCheckpointId,
            },
          }
        : undefined,
      pendingWrites,
    };
  }

  async *list(config: RunnableConfig, options?: CheckpointListOptions): AsyncGenerator<CheckpointTuple> {
    const { tenantId, threadId } = parseScopedThread(config.configurable?.thread_id);
    const checkpointNs = (config.configurable?.checkpoint_ns as string) ?? '';

    let query = this.checkpointsCol(tenantId, threadId)
      .where('checkpointNs', '==', checkpointNs)
      .where('deletedAt', '==', null)
      .orderBy('createdAt', 'desc');
    if (options?.limit) query = query.limit(options.limit);

    const snap = await query.get();
    for (const doc of snap.docs) {
      const data = doc.data() as StoredCheckpointDoc;
      const tuple = await this.getTuple({
        configurable: {
          thread_id: scopedThreadId(tenantId, threadId),
          checkpoint_ns: data.checkpointNs,
          checkpoint_id: data.checkpointId,
        },
      });
      if (tuple) yield tuple;
    }
  }

  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata,
    _newVersions: ChannelVersions,
  ): Promise<RunnableConfig> {
    const { tenantId, threadId } = parseScopedThread(config.configurable?.thread_id);
    const checkpointNs = (config.configurable?.checkpoint_ns as string) ?? '';
    const parentCheckpointId = (config.configurable?.checkpoint_id as string | undefined) ?? null;

    const [type, serializedCheckpoint] = await this.serde.dumpsTyped(checkpoint);
    const [metadataType, serializedMetadata] = await this.serde.dumpsTyped(metadata);

    const payload: StoredCheckpointDoc = {
      tenantId,
      threadId,
      checkpointNs,
      checkpointId: checkpoint.id,
      parentCheckpointId,
      type,
      checkpointBase64: Buffer.from(serializedCheckpoint).toString('base64'),
      metadataType,
      metadataBase64: Buffer.from(serializedMetadata).toString('base64'),
      createdAt: Date.now(),
      deletedAt: null,
    };
    await this.checkpointsCol(tenantId, threadId).doc(checkpoint.id).set(payload);

    return {
      configurable: {
        thread_id: scopedThreadId(tenantId, threadId),
        checkpoint_ns: checkpointNs,
        checkpoint_id: checkpoint.id,
      },
    };
  }

  async putWrites(config: RunnableConfig, writes: PendingWrite[], taskId: string): Promise<void> {
    const { tenantId, threadId } = parseScopedThread(config.configurable?.thread_id);
    const checkpointId = config.configurable?.checkpoint_id as string | undefined;
    if (!checkpointId) {
      throw new Error('FirestoreCheckpointSaver.putWrites: checkpoint_id is required.');
    }
    const batch = this.db.batch();
    const col = this.writesCol(tenantId, threadId, checkpointId);
    for (let idx = 0; idx < writes.length; idx += 1) {
      const [channel, value] = writes[idx];
      const [type, serializedValue] = await this.serde.dumpsTyped(value);
      const writeDoc: StoredWriteDoc = {
        taskId,
        idx,
        channel: String(channel),
        type,
        valueBase64: Buffer.from(serializedValue).toString('base64'),
      };
      batch.set(col.doc(`${taskId}_${idx}`), writeDoc);
    }
    await batch.commit();
  }

  /** Soft-delete, to honour the ECOS SOFT_DELETE policy rather than hard-removing history. */
  async deleteThread(rawThreadId: string): Promise<void> {
    const { tenantId, threadId } = parseScopedThread(rawThreadId);
    const snap = await this.checkpointsCol(tenantId, threadId).where('deletedAt', '==', null).get();
    if (snap.empty) return;
    const batch = this.db.batch();
    const now = Date.now();
    for (const doc of snap.docs) batch.update(doc.ref, { deletedAt: now });
    await batch.commit();
  }
}
