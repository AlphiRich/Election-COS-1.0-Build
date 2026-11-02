/**
 * Election Campaign OS — planned gatherings, and the notice countdown
 * IC-ECOS-BUILD-2026-V2 §6.3, Regulation of Gatherings Act 205 of 1993 s 3.
 *
 * A gathering is a PLANNED event (a rally, a march, a public meeting) —
 * not a diary entry, which is a record of something that already happened.
 * The two were conflated in the first draft of this feature and they are
 * not the same thing: the diary's `RALLY` type logs a rally after it was
 * held; this port exists so that somebody is told, beforehand, that the
 * notice has not been lodged.
 *
 * The countdown itself is derived, never stored: how many hours remain is
 * a function of the clock, and a stored figure would be wrong a minute
 * after it was written. What IS stored is the fact the Act turns on —
 * whether notice was lodged — and the hourly sweep
 * (`functions/src/rgaNoticeScheduled.ts`) raises one alert per stage.
 *
 * Recording that notice was lodged records that the CONVENER SAYS they
 * lodged it. It does not establish that the responsible officer received
 * it or accepted it, and nothing here claims either.
 */
import type { Page, PageRequest, SessionContext, UpsertResult } from './session';

export type NoticeStatus = 'NOT_LODGED' | 'LODGED';

export interface Gathering {
  id: string;
  tenantId: string;
  title: string;
  wardCode: string;
  /** ISO 8601. */
  startsAt: string;
  noticeStatus: NoticeStatus;
  noticeLodgedAt: string | null;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
  deletedAt: string | null;
  schemaVersion: number;
}

export interface GatheringDraft {
  id: string;
  title: string;
  wardCode: string;
  startsAt: string;
  notes?: string;
}

export type AlertStage = 'NOTICE_DUE' | 'URGENT' | 'PROHIBITION_RISK';

/** Written only by the sweep. Clients read it; the rules forbid writing it. */
export interface GatheringAlert {
  id: string;
  gatheringId: string;
  stage: AlertStage;
  severity: 'MEDIUM' | 'HIGH' | 'CRITICAL';
  basis: 'STATUTE' | 'HOUSE_POLICY';
  wardCode: string;
  title: string;
  hoursToStart: number;
  message: string;
  createdAt: string;
}

export interface GatheringsRepository {
  list(ctx: SessionContext, page: PageRequest): Promise<Page<Gathering>>;
  /** Creates a gathering with notice NOT_LODGED. */
  create(ctx: SessionContext, draft: GatheringDraft): Promise<UpsertResult>;
  /** The convener's statement that notice was lodged, timestamped by the server. */
  markNoticeLodged(ctx: SessionContext, id: string): Promise<UpsertResult>;
  listAlerts(ctx: SessionContext, limit: number): Promise<GatheringAlert[]>;
}
