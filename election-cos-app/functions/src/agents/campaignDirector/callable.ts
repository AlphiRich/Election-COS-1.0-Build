/**
 * Election Campaign OS — Campaign Director: Cloud Functions entry point.
 *
 * @deployable no
 *
 * The Path A entry. Path B (decided) runs the agent on the Cloudflare worker
 * instead — `worker/src/agentRoute.ts` — so this stays held: not exported from
 * `index.ts`, never deployed. It is kept, compiled and pointed at the same
 * `runAgent` as the worker, so the two runtimes cannot drift and Path A remains
 * a working fallback if Blaze is ever chosen.
 *
 * It can trigger an outward action (incident dispatch, via the graph's HITL
 * node), so by build rule 6 it does not ship unreviewed. Region-pinned to
 * `africa-south1` (rule 7); the tenant comes strictly from the verified token.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { REGION } from '../../region';
import { harnessContextFrom, type VerifiedAuthLike } from './state';
import { FirestoreCheckpointSaver } from './firestoreCheckpointer';
import { firestoreCounterReader } from './ecosLangchainTools';
import { resolveAgentModel } from './agentModel';
import { runAgent } from './runAgent';

export const runCampaignDirector = onCall({ region: REGION }, async (request) => {
  if (!request.auth?.uid || !(request.auth.token as Record<string, unknown>)?.tenantId) {
    throw new HttpsError('unauthenticated', 'Verified tenant token required.');
  }

  // Tenant and caps come strictly from the verified token (§4.4), never request data.
  const ctx = harnessContextFrom(request.auth as unknown as VerifiedAuthLike);

  const { threadId, prompt, municipalityCode, resumeDecision } = (request.data ?? {}) as {
    threadId?: string;
    prompt?: string;
    municipalityCode?: string;
    resumeDecision?: { approved: boolean; note?: string };
  };
  if (!threadId || typeof threadId !== 'string') {
    throw new HttpsError('invalid-argument', 'threadId is required.');
  }

  const db = getFirestore();
  const result = await runAgent(
    ctx,
    { threadId, prompt, municipalityCode, resumeDecision },
    {
      // `null` when no key is set → runAgent fails closed (rule 2).
      model: resolveAgentModel(),
      checkpointer: new FirestoreCheckpointSaver(db),
      counterReader: firestoreCounterReader(db),
    },
  );
  if (!result.ok) {
    throw new HttpsError(
      'failed-precondition',
      result.reason === 'model-not-configured'
        ? 'Campaign Director has no model configured; it refuses to run rather than fabricate.'
        : 'Resuming an approval needs a durable checkpointer.',
    );
  }
  return result;
});
