/**
 * Election Campaign OS — `recordPageViews` callable
 *
 * @deployable yes
 *
 * Firestore wiring only; the checks are in `pageViews.ts`. The tenant comes from the verified token,
 * never the payload, and nothing about the caller is written: the document holds counts.
 * `FieldValue.increment` inside a merge, so two staff members flushing at once both land.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { REGION } from './region';
import { InvalidPageViews, recordPageViews, type PageViewStore } from './pageViews';
import { whoFrom } from './secondFactorCallables';

if (!getApps().length) initializeApp();

const firestorePageViewStore: PageViewStore = {
  async add(path, day, counts, total) {
    const routes: Record<string, FieldValue> = {};
    for (const [route, n] of Object.entries(counts)) routes[route] = FieldValue.increment(n);
    await getFirestore()
      .doc(path)
      .set({ day, routes, total: FieldValue.increment(total), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  },
};

export const recordPageViewsCallable = onCall<{ counts?: unknown }>({ region: REGION }, async (request) => {
  const { tenantId } = whoFrom(request);
  try {
    return await recordPageViews(firestorePageViewStore, tenantId, request.data?.counts, Date.now());
  } catch (error) {
    if (error instanceof InvalidPageViews) throw new HttpsError('invalid-argument', error.message);
    throw error;
  }
});
