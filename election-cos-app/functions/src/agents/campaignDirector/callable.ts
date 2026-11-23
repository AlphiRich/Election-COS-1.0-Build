/**
 * Election Campaign OS — Campaign Director: callable entry point.
 *
 * @deployable no
 *
 * A half-wired path that can trigger an outward action (incident dispatch, via
 * the graph's HITL node), so by build rule 6 it does not ship and is NOT
 * exported from `index.ts`. Three things must land before it can become
 * `@deployable yes`:
 *   1. A model credential + provider binding (`agentModel.resolveAgentModel`
 *      returns null today, so this refuses rather than fabricating).
 *   2. The certified-baseline / Schedule 1 MCP tools need a shared engine in
 *      functions (they fail closed today — see `ecosMcpTools.ts`).
 *   3. A deploy target for Cloud Functions (decision B: not deployed; Cloudflare
 *      Claims Worker is the live backend, no Blaze).
 *
 * It is region-pinned to `africa-south1` (rule 7), derives the tenant strictly
 * from the verified token (never request data), and scopes the checkpoint
 * thread as `<tenantId>:<threadId>` so the Firestore saver can never cross
 * tenants.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { Command } from '@langchain/langgraph';
import { HumanMessage } from '@langchain/core/messages';
import { getFirestore } from 'firebase-admin/firestore';
import { REGION } from '../../region';
import { harnessContextFrom, type VerifiedAuthLike } from './state';
import { buildCampaignDirectorGraph } from './graph';
import { FirestoreCheckpointSaver } from './firestoreCheckpointer';
import { firestoreCounterReader } from './ecosLangchainTools';
import { resolveAgentModel } from './agentModel';

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

  // Fail closed: no model → refuse, never fabricate a briefing (rule 2).
  const model = resolveAgentModel();
  if (!model) {
    throw new HttpsError(
      'failed-precondition',
      'Campaign Director has no model configured; it refuses to run rather than fabricate. Configure a model credential to enable it.',
    );
  }

  const db = getFirestore();
  const graph = buildCampaignDirectorGraph({
    checkpointer: new FirestoreCheckpointSaver(db),
    model,
    counterReader: firestoreCounterReader(db),
  });

  const config = {
    configurable: { thread_id: `${ctx.tenantId}:${threadId}`, harnessContext: ctx },
  };

  if (resumeDecision) {
    return graph.invoke(new Command({ resume: resumeDecision }), config);
  }
  return graph.invoke(
    {
      municipalityCode: municipalityCode ?? '',
      messages: [new HumanMessage(prompt ?? 'Summarize the current baseline.')],
    },
    config,
  );
});
