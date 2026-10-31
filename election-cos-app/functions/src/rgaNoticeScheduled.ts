/**
 * Election Campaign OS — hourly Regulation of Gatherings Act sweep
 * IC-ECOS-BUILD-2026-V2 §6.3.
 *
 * @deployable yes
 *
 * Marked `yes` because the one thing that could make it unsafe to ship —
 * running twice — was proved against the Firestore emulator, not only
 * against the in-memory fake in `rgaNotice.test.ts`. See that file and
 * §44 of docs/asset-control-sheet.md. Two prerequisites, neither
 * expressible in this file:
 *
 *  1. the composite index on `gatherings` (collection-group scope:
 *     noticeStatus, startsAt) in `firestore.indexes.json` must be
 *     deployed, or the query below fails at runtime with FAILED_PRECONDITION;
 *  2. a TTL policy on `gatheringAlerts.expireAt` is optional but
 *     recommended — alerts are operational, not a record.
 *
 * WHAT IT READS
 *
 * Only gatherings that are NOT_LODGED and start within the next seven
 * days. A tenant with no upcoming unlodged gatherings costs nothing, and
 * the query is bounded by the Act's own window, so it does not grow with
 * history. The tenant is taken from the document PATH, never from a field
 * on the document: a field is client-written, the path is not.
 *
 * WHAT IT WRITES
 *
 * `tenants/{tenantId}/gatheringAlerts/{alertDocId}`, create-if-absent.
 * Clients cannot write this collection (see firestore.rules), so an
 * alert cannot be forged or silenced from a handset.
 */
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { getApps, initializeApp } from 'firebase-admin/app';
import { REGION } from './region';
import {
  NOTICE_WINDOW_HOURS,
  runRgaSweep,
  type AlertStore,
  type GatheringRecord,
  type RgaAlert,
  type SweepResult,
} from './rgaNotice';

if (!getApps().length) initializeApp();

/** Alerts are operational. 30 days after the gathering is generous. */
const ALERT_TTL_DAYS = 30;

/** gRPC status ALREADY_EXISTS, as surfaced by the Admin SDK. */
const ALREADY_EXISTS = 6;

/**
 * Firestore-backed store. `create()` fails with ALREADY_EXISTS if the
 * document is there, and that check-and-write is atomic server-side —
 * which is the whole of the idempotency guarantee. A different error is
 * a real failure and is rethrown, not swallowed as "already raised".
 */
export function createAdminAlertStore(db: Firestore, nowMillis: number): AlertStore {
  return {
    async createIfAbsent(tenantId: string, docId: string, alert: RgaAlert): Promise<boolean> {
      const ref = db.doc(`tenants/${tenantId}/gatheringAlerts/${docId}`);
      try {
        await ref.create({
          ...alert,
          createdAt: FieldValue.serverTimestamp(),
          expireAt: Timestamp.fromMillis(nowMillis + ALERT_TTL_DAYS * 86_400_000),
        });
        return true;
      } catch (err) {
        if ((err as { code?: number }).code === ALREADY_EXISTS) return false;
        throw err;
      }
    },
  };
}

/** Read the bounded set of gatherings this sweep needs, as plain records. */
export async function loadUpcomingUnlodged(
  db: Firestore,
  nowMillis: number,
): Promise<GatheringRecord[]> {
  const horizon = Timestamp.fromMillis(nowMillis + NOTICE_WINDOW_HOURS * 3_600_000);
  const snap = await db
    .collectionGroup('gatherings')
    .where('noticeStatus', '==', 'NOT_LODGED')
    .where('startsAt', '>', Timestamp.fromMillis(nowMillis))
    .where('startsAt', '<=', horizon)
    .limit(2000)
    .get();

  const out: GatheringRecord[] = [];
  for (const doc of snap.docs) {
    // tenants/{tenantId}/gatherings/{id} — tenant from the path.
    const tenantId = doc.ref.parent.parent?.id;
    const startsAt = doc.get('startsAt');
    if (!tenantId || !(startsAt instanceof Timestamp)) continue;
    out.push({
      tenantId,
      id: doc.id,
      title: String(doc.get('title') ?? ''),
      wardCode: String(doc.get('wardCode') ?? ''),
      startsAtMillis: startsAt.toMillis(),
      noticeStatus: doc.get('noticeStatus'),
      deleted: doc.get('deletedAt') != null,
    });
  }
  return out;
}

export async function sweepOnce(db: Firestore, nowMillis: number): Promise<SweepResult> {
  const gatherings = await loadUpcomingUnlodged(db, nowMillis);
  return runRgaSweep(gatherings, createAdminAlertStore(db, nowMillis), nowMillis);
}

export const sweepRgaNotices = onSchedule(
  {
    region: REGION,
    schedule: 'every 60 minutes',
    timeZone: 'Africa/Johannesburg',
    // A failed hour is retried by the next hour's run, which is safe
    // precisely because the sweep is idempotent. Platform retries would
    // only add overlap.
    retryCount: 0,
  },
  async () => {
    const result = await sweepOnce(getFirestore(), Date.now());
    console.log('[rga] sweep', JSON.stringify(result));
  },
);
