/**
 * Election Campaign OS — Campaign Director on the edge (Path B).
 *
 *   POST /api/agent/campaign-director   { threadId, prompt?, municipalityCode?, resumeDecision? }
 *
 * The worker's half of the agent: authorise the caller, validate the body, and
 * hand off to the one shared `runAgent` (functions/src/agents/campaignDirector).
 * This file imports nothing from LangGraph directly — see runAgent.ts for why —
 * and index.ts loads it lazily, so the agent's weight never touches the startup
 * of the sign-in routes this worker also serves.
 *
 * WHY THE GATES ARE HERE
 *
 * The worker reads Firestore with a service account, which BYPASSES
 * firestore.rules. So every check the rules would make on a client read is made
 * here instead, in the same terms:
 *   - tenant: from the verified token only (a body `tenantId` is ignored);
 *   - second factor: the rules' mfaOK() — `mfaRequired == false || mfaUntil > now`,
 *     absent `mfaRequired` meaning required (fail closed);
 *   - capability: `warroom.view`, the cap the rules require to read
 *     `counters/warRoom`, which is what the agent's tool reads.
 *
 * Pure: token claims + body + deps in, status + body out. index.ts does the
 * HTTP and the JWT verification.
 */
import { runAgent, type RunAgentDeps } from '../../functions/src/agents/campaignDirector/runAgent';
import { harnessContextFrom } from '../../functions/src/agents/campaignDirector/state';
import {
  DocStoreCheckpointSaver,
  type CheckpointDocStore,
} from '../../functions/src/agents/campaignDirector/firestoreCheckpointer';

export const AGENT_REQUIRED_CAP = 'warroom.view';
export const MAX_PROMPT_CHARS = 4000;
const THREAD_ID = /^[A-Za-z0-9_-]{1,64}$/;
const MUNICIPALITY_CODE = /^[A-Z]{2,3}\d{3}$/;

/** The verified Firebase ID token's claims, as much as this route reads. */
export interface AgentToken {
  uid: string;
  tenantId?: unknown;
  caps?: unknown;
  mfaRequired?: unknown;
  mfaUntil?: unknown;
}

/** firestore.rules mfaOK(), in the same terms. Absent `mfaRequired` = required. */
export function mfaSatisfied(token: AgentToken, nowSec: number): boolean {
  return token.mfaRequired === false || (typeof token.mfaUntil === 'number' && token.mfaUntil > nowSec);
}

export interface AgentRouteDeps extends RunAgentDeps {
  nowSec: number;
  /** Injected in tests; the real runAgent otherwise. */
  run?: typeof runAgent;
  /** Durable store (Firestore REST on the edge). Present → conversations and approvals persist. */
  checkpointStore?: CheckpointDocStore;
}

export interface AgentRouteResult {
  status: number;
  body: unknown;
}

const fail = (status: number, error: string): AgentRouteResult => ({ status, body: { error } });

export async function handleCampaignDirector(
  token: AgentToken,
  body: Record<string, unknown>,
  deps: AgentRouteDeps,
): Promise<AgentRouteResult> {
  // 1. Tenant, from the token alone. No tenant claim → no access.
  let ctx;
  try {
    ctx = harnessContextFrom({ uid: token.uid, token: { tenantId: token.tenantId, caps: token.caps } });
  } catch {
    return fail(403, 'This account has no tenant.');
  }
  // 2. Second factor, as the rules would demand it.
  if (!mfaSatisfied(token, deps.nowSec)) return fail(403, 'A second sign-in factor is required.');
  // 3. Capability.
  if (!ctx.capabilities.includes(AGENT_REQUIRED_CAP)) {
    return fail(403, `The Campaign Director requires the ${AGENT_REQUIRED_CAP} capability.`);
  }

  // 4. Body.
  const { threadId, prompt, municipalityCode, resumeDecision } = body;
  if (typeof threadId !== 'string' || !THREAD_ID.test(threadId)) {
    return fail(400, 'threadId must be 1–64 characters: letters, digits, hyphen, underscore.');
  }
  if (prompt !== undefined && (typeof prompt !== 'string' || prompt.length > MAX_PROMPT_CHARS)) {
    return fail(400, `prompt must be text of at most ${MAX_PROMPT_CHARS} characters.`);
  }
  if (municipalityCode !== undefined && (typeof municipalityCode !== 'string' || !MUNICIPALITY_CODE.test(municipalityCode))) {
    return fail(400, 'municipalityCode must look like NW405.');
  }
  let decision: { approved: boolean; note?: string } | undefined;
  if (resumeDecision !== undefined) {
    const d = resumeDecision as { approved?: unknown; note?: unknown } | null;
    if (!d || typeof d !== 'object' || typeof d.approved !== 'boolean' || (d.note !== undefined && typeof d.note !== 'string')) {
      return fail(400, 'resumeDecision must be { approved: boolean, note?: string }.');
    }
    decision = { approved: d.approved, note: d.note as string | undefined };
  }

  // 5. Run.
  const run = deps.run ?? runAgent;
  const checkpointer =
    deps.checkpointer ?? (deps.checkpointStore ? new DocStoreCheckpointSaver(deps.checkpointStore) : undefined);
  const result = await run(
    ctx,
    {
      threadId,
      prompt: prompt as string | undefined,
      municipalityCode: municipalityCode as string | undefined,
      resumeDecision: decision,
    },
    { ...deps, checkpointer },
  );
  if (!result.ok) {
    switch (result.reason) {
      case 'model-not-configured':
        return fail(503, 'The Campaign Director has no model configured; it refuses to run rather than fabricate.');
      case 'resume-requires-durable-checkpointer':
        return fail(501, 'Resuming an approval needs the durable checkpointer, which this deployment lacks.');
      case 'nothing-to-resume':
        return fail(409, 'There is no approval waiting on this thread.');
      case 'awaiting-approval':
        return fail(409, 'This thread is waiting for an approval decision. Send resumeDecision before a new prompt.');
      case 'thread-too-long':
        return fail(413, 'This conversation is too long to save. Start a new threadId.');
      default: {
        const unhandled: never = result.reason;
        return fail(500, `Unhandled agent outcome: ${String(unhandled)}`);
      }
    }
  }
  return { status: 200, body: result };
}
