/**
 * Election Campaign OS — Firestore adapter: planned gatherings
 * IC-ECOS-BUILD-2026-V2 §5, §6.3. See src/dal/ports/gatherings.ts.
 */
import { collection, getDocs, limit as fbLimit, orderBy, query, serverTimestamp, Timestamp } from 'firebase/firestore';
import type { SessionContext } from '@/dal/ports/session';
import type {
  Gathering,
  GatheringAlert,
  GatheringDraft,
  GatheringsRepository,
} from '@/dal/ports/gatherings';
import {
  db,
  geoScopeConstraints,
  listPageGeneric,
  tenantCollectionPath,
  toISO,
  upsertGeneric,
} from './base';

function fromFirestore(id: string, data: Record<string, unknown>): Gathering {
  return {
    id,
    tenantId: data.tenantId as string,
    title: (data.title as string) ?? '',
    wardCode: data.wardCode as string,
    startsAt: toISO(data.startsAt as string) ?? '',
    noticeStatus: (data.noticeStatus as Gathering['noticeStatus']) ?? 'NOT_LODGED',
    noticeLodgedAt: toISO(data.noticeLodgedAt as string | null),
    notes: data.notes as string | undefined,
    createdAt: toISO(data.createdAt as string) ?? '',
    updatedAt: toISO(data.updatedAt as string) ?? '',
    updatedBy: data.updatedBy as string,
    deletedAt: toISO(data.deletedAt as string | null),
    schemaVersion: (data.schemaVersion as number) ?? 1,
  };
}

function alertFromFirestore(id: string, data: Record<string, unknown>): GatheringAlert {
  return {
    id,
    gatheringId: data.gatheringId as string,
    stage: data.stage as GatheringAlert['stage'],
    severity: data.severity as GatheringAlert['severity'],
    basis: data.basis as GatheringAlert['basis'],
    wardCode: data.wardCode as string,
    title: (data.title as string) ?? '',
    hoursToStart: (data.hoursToStart as number) ?? 0,
    message: (data.message as string) ?? '',
    createdAt: toISO(data.createdAt as string) ?? '',
  };
}

export const gatheringsRepository: GatheringsRepository = {
  list(ctx: SessionContext, page) {
    return listPageGeneric(ctx, 'gatherings', geoScopeConstraints(ctx), page, fromFirestore);
  },

  create(ctx: SessionContext, draft: GatheringDraft) {
    return upsertGeneric(
      ctx,
      'gatherings',
      draft.id,
      {
        title: draft.title,
        wardCode: draft.wardCode,
        // A Timestamp, not an ISO string: the sweep range-queries this field
        // and Firestore orders strings and timestamps in different places.
        startsAt: Timestamp.fromDate(new Date(draft.startsAt)),
        noticeStatus: 'NOT_LODGED',
        noticeLodgedAt: null,
        ...(draft.notes ? { notes: draft.notes } : {}),
      },
      true,
    );
  },

  markNoticeLodged(ctx: SessionContext, id: string) {
    return upsertGeneric(
      ctx,
      'gatherings',
      id,
      { noticeStatus: 'LODGED', noticeLodgedAt: serverTimestamp() },
      false,
    );
  },

  async listAlerts(ctx: SessionContext, limit: number) {
    const q = query(
      collection(db(), tenantCollectionPath(ctx.tenantId, 'gatheringAlerts')),
      ...geoScopeConstraints(ctx),
      orderBy('createdAt', 'desc'),
      fbLimit(limit),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => alertFromFirestore(d.id, d.data()));
  },
};
