/** Election Campaign OS — Firestore adapter: polls. See src/dal/ports/polls.ts. */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import type { PollsRepository, PollTally } from '@/dal/ports/polls';
import { validateDefinition, type PollDefinition } from '@/modules/polls/pollModel';
import { db, stampOnWrite, tenantCollectionPath, toISO } from './base';

const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';
/** 12 random characters from a 32-letter alphabet: 60 bits, not guessable, safe in a URL. */
function newPublicId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('');
}

function fromFirestore(id: string, d: Record<string, unknown>): PollDefinition {
  return {
    id,
    publicId: d.publicId as string,
    question: d.question as string,
    options: (d.options as string[]) ?? [],
    status: (d.status as PollDefinition['status']) ?? 'DRAFT',
    closesAt: (d.closesAt as string | undefined) ?? undefined,
    tokenMode: (d.tokenMode as PollDefinition['tokenMode']) ?? 'open',
    organiser: (d.organiser as string) ?? '',
  };
}

export const pollsRepository: PollsRepository = {
  async list(ctx) {
    const snap = await getDocs(
      query(
        collection(db(), tenantCollectionPath(ctx.tenantId, 'polls')),
        orderBy('createdAt', 'desc'),
      ),
    );
    return snap.docs.map((d) => fromFirestore(d.id, d.data()));
  },
  async create(ctx, def) {
    validateDefinition(def);
    const id = crypto.randomUUID();
    const publicId = newPublicId();
    const body = {
      ...def,
      question: def.question.trim(),
      options: def.options.map((o) => o.trim()),
      organiser: def.organiser.trim(),
      publicId,
    };
    await setDoc(doc(db(), tenantCollectionPath(ctx.tenantId, 'polls'), id), {
      ...body,
      ...stampOnWrite(ctx, true),
    });
    return { id, ...body };
  },
  async setStatus(ctx, id, status) {
    await updateDoc(doc(db(), tenantCollectionPath(ctx.tenantId, 'polls'), id), {
      status,
      ...stampOnWrite(ctx, false),
    });
  },
  async getTally(ctx, id): Promise<PollTally> {
    const snap = await getDoc(doc(db(), tenantCollectionPath(ctx.tenantId, 'pollTallies'), id));
    if (!snap.exists()) return { counts: {}, total: 0, updatedAt: null };
    const d = snap.data();
    return {
      counts: (d.counts as Record<string, number>) ?? {},
      total: (d.total as number) ?? 0,
      updatedAt: toISO(d.updatedAt),
    };
  },
};
