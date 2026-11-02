/**
 * Election Campaign OS — Regulation of Gatherings Act notice countdown
 * IC-ECOS-BUILD-2026-V2 §6.3 (field operations), knowledge advisory
 * `GatheringsAdvisoryPage`.
 *
 * WHAT THE LAW SAYS, AND WHAT IS HOUSE POLICY
 *
 * Regulation of Gatherings Act 205 of 1993, s 3: the convener gives
 * written notice to the responsible officer not later than seven days
 * before the gathering. Where seven days is not reasonably possible,
 * notice is given at the earliest opportunity with reasons. Where notice
 * is given less than 48 hours before the gathering, the responsible
 * officer may prohibit it. (The repository's own advisory page carries
 * the same reading; this module does not restate the Act beyond it.)
 *
 * Two of the three points below are therefore statutory and one is not:
 *
 *   NOTICE_DUE        seven days or fewer to go, no notice lodged.
 *                     STATUTE — the seven-day point.
 *   URGENT            72 hours or fewer. HOUSE POLICY — a warning
 *                     rung placed between the two statutory points so
 *                     a ward lead is told before the cliff, not at it.
 *                     The Act has no 72-hour rule and the alert says so.
 *   PROHIBITION_RISK  under 48 hours. STATUTE — the officer may
 *                     prohibit. This is the alert that matters.
 *
 * This is an operational aid. It does not say notice was valid, was
 * received, or will be accepted, and it never says a gathering is
 * lawful. It reports what the record shows and who must act.
 *
 * WHY IT IS BUILT TO BE RUN TWICE
 *
 * A scheduled sweep fires on a clock, and clocks overlap: a slow run, a
 * retry, two instances. The reference implementation this was modelled
 * on inserted a notification per event on every run, so an hourly sweep
 * would raise the same alert every hour. That is the same defect class
 * as the War Room counters (`warRoomCounters.ts`): an at-least-once
 * delivery meeting a non-idempotent write.
 *
 * The fix is the same too: the identity of an alert is a function of
 * WHAT it is about — the gathering and the stage — and never of WHEN it
 * was raised. `alertDocId(gathering, stage)` is deterministic, and the
 * store writes it with create-if-absent, which Firestore makes atomic.
 * Running the sweep once or a hundred times against the same state
 * leaves the same alerts. A gathering that deteriorates from
 * NOTICE_DUE to URGENT to PROHIBITION_RISK raises exactly three, one per
 * stage, each once.
 *
 * Pure: no Firebase import. `rgaNoticeScheduled.ts` binds it to
 * Firestore and the clock.
 */
import { createHash } from 'node:crypto';

/** Statutory: notice not later than seven days before. */
export const NOTICE_WINDOW_HOURS = 168;
/** House policy: a rung between the two statutory points. */
export const URGENT_WINDOW_HOURS = 72;
/** Statutory: notice given under this many hours before may be prohibited. */
export const PROHIBITION_WINDOW_HOURS = 48;

export type NoticeStatus = 'NOT_LODGED' | 'LODGED';
export type RgaStage = 'NOTICE_DUE' | 'URGENT' | 'PROHIBITION_RISK';
export type StageBasis = 'STATUTE' | 'HOUSE_POLICY';
export type Severity = 'MEDIUM' | 'HIGH' | 'CRITICAL';

export const STAGE_BASIS: Record<RgaStage, StageBasis> = {
  NOTICE_DUE: 'STATUTE',
  URGENT: 'HOUSE_POLICY',
  PROHIBITION_RISK: 'STATUTE',
};

export const STAGE_SEVERITY: Record<RgaStage, Severity> = {
  NOTICE_DUE: 'MEDIUM',
  URGENT: 'HIGH',
  PROHIBITION_RISK: 'CRITICAL',
};

export interface GatheringRecord {
  tenantId: string;
  id: string;
  title: string;
  wardCode: string;
  startsAtMillis: number;
  noticeStatus: NoticeStatus;
  deleted: boolean;
}

export interface RgaAlert {
  tenantId: string;
  gatheringId: string;
  stage: RgaStage;
  severity: Severity;
  basis: StageBasis;
  wardCode: string;
  title: string;
  /** Whole hours to the start at the moment this alert was raised. */
  hoursToStart: number;
  message: string;
}

export function hoursUntil(startsAtMillis: number, nowMillis: number): number {
  return (startsAtMillis - nowMillis) / 3_600_000;
}

/**
 * Which stage an unlodged gathering is in, or `null` if none applies —
 * more than seven days away (nothing is late yet) or already begun
 * (nothing a notice can now do; it is a record, not an alert).
 *
 * Boundaries follow the Act's wording. "Not later than seven days before"
 * means notice at exactly 168 hours is still in time, so the alert fires
 * AT the seven-day point, as a last-moment warning rather than a late
 * one. "Less than 48 hours" is strict: at exactly 48.0 hours the cliff
 * has not yet been crossed.
 */
export function stageFor(hoursToStart: number): RgaStage | null {
  if (!Number.isFinite(hoursToStart) || hoursToStart <= 0) return null;
  if (hoursToStart < PROHIBITION_WINDOW_HOURS) return 'PROHIBITION_RISK';
  if (hoursToStart <= URGENT_WINDOW_HOURS) return 'URGENT';
  if (hoursToStart <= NOTICE_WINDOW_HOURS) return 'NOTICE_DUE';
  return null;
}

function messageFor(stage: RgaStage, hours: number, title: string): string {
  const h = Math.floor(hours);
  switch (stage) {
    case 'PROHIBITION_RISK':
      return (
        `No notice is recorded for "${title}", which starts in about ${h} hours. ` +
        'Under the Regulation of Gatherings Act the responsible officer may prohibit a ' +
        'gathering noticed less than 48 hours before it begins. Lodge notice now and ' +
        'confirm with the responsible officer.'
      );
    case 'URGENT':
      return (
        `No notice is recorded for "${title}", which starts in about ${h} hours. ` +
        'The Act requires notice not later than seven days before and that point has ' +
        'passed; the 48-hour prohibition point is next. (The 72-hour warning is this ' +
        "product's own policy, not a statutory deadline.)"
      );
    case 'NOTICE_DUE':
      return (
        `No notice is recorded for "${title}", which starts in about ${h} hours. ` +
        'The Act requires written notice to the responsible officer not later than ' +
        'seven days before the gathering.'
      );
  }
}

/**
 * The identity of an alert. Deterministic in the gathering and the stage,
 * and in nothing else — no timestamp, no run id, no counter.
 *
 * Readable prefix plus a fingerprint of the ORIGINAL id: two ids that
 * sanitise to the same string would otherwise share a document and one
 * gathering's alert would silently suppress another's. (Same shape and
 * same reason as `counterEventDocId`.)
 */
export function alertDocId(gatheringId: string, stage: RgaStage): string {
  const fingerprint = createHash('sha256').update(gatheringId, 'utf8').digest('hex').slice(0, 16);
  const readable = gatheringId.replace(/[^A-Za-z0-9-]/g, '_').slice(0, 60);
  return `${readable}~${fingerprint}~${stage}`;
}

/** What this sweep would raise, given the gatherings and the clock. */
export function planAlerts(
  gatherings: readonly GatheringRecord[],
  nowMillis: number,
): RgaAlert[] {
  const out: RgaAlert[] = [];
  for (const g of gatherings) {
    if (g.deleted || g.noticeStatus !== 'NOT_LODGED') continue;
    const hours = hoursUntil(g.startsAtMillis, nowMillis);
    const stage = stageFor(hours);
    if (!stage) continue;
    out.push({
      tenantId: g.tenantId,
      gatheringId: g.id,
      stage,
      severity: STAGE_SEVERITY[stage],
      basis: STAGE_BASIS[stage],
      wardCode: g.wardCode,
      title: g.title,
      hoursToStart: Math.floor(hours),
      message: messageFor(stage, hours, g.title),
    });
  }
  return out;
}

/**
 * Persistence, narrowed to the one operation idempotency depends on.
 * Resolves `true` if THIS call created the alert, `false` if it already
 * existed. Must be atomic: two concurrent calls with the same id must
 * produce exactly one `true`.
 */
export interface AlertStore {
  createIfAbsent(tenantId: string, docId: string, alert: RgaAlert): Promise<boolean>;
}

export interface SweepResult {
  considered: number;
  created: number;
  alreadyRaised: number;
}

export async function runRgaSweep(
  gatherings: readonly GatheringRecord[],
  store: AlertStore,
  nowMillis: number,
): Promise<SweepResult> {
  const plan = planAlerts(gatherings, nowMillis);
  let created = 0;
  for (const alert of plan) {
    const fresh = await store.createIfAbsent(
      alert.tenantId,
      alertDocId(alert.gatheringId, alert.stage),
      alert,
    );
    if (fresh) created += 1;
  }
  return { considered: plan.length, created, alreadyRaised: plan.length - created };
}
