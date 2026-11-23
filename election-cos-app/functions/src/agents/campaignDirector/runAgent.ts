/**
 * Election Campaign OS — Campaign Director: the one way to run the agent.
 *
 * Runtime-agnostic. Both entry points call this and nothing else:
 *   - `callable.ts` (Cloud Functions; Path A, held)
 *   - `worker/src/agentRoute.ts` (the Cloudflare worker; Path B)
 * so the assembly — model, graph, checkpointer, thread scoping, the summary a
 * caller gets back — exists once.
 *
 * WHY IT LIVES HERE AND THE WORKER IMPORTS IT
 *
 * Every LangGraph / Anthropic import in the agent lives under `functions/src`,
 * and bundlers resolve imports per file, so the worker bundle resolves them all
 * to ONE copy (`functions/node_modules`). If the worker imported LangGraph itself
 * it would resolve a second copy from the app root, and two copies of LangGraph
 * break `interrupt`/`Command` across instances. The worker imports this module
 * and `state.ts`, and nothing from LangGraph directly.
 *
 * FAILS CLOSED
 *  - No model (no key, nothing injected) → `model-not-configured`; nothing runs.
 *  - A resume (human approval) needs a DURABLE checkpointer, because the paused
 *    run must be found again on a later request. Without one, `MemorySaver` would
 *    silently start a fresh thread and "resume" nothing — so a resume with no
 *    durable checkpointer is refused, not attempted.
 *  - With a durable checkpointer, a resume when nothing is paused is refused
 *    (`nothing-to-resume`), and a NEW prompt while an approval is pending is
 *    refused (`awaiting-approval`) — otherwise the new run would silently
 *    abandon the decision a human was asked to make.
 *  - A thread too large to store is refused (`thread-too-long`), never truncated.
 *  - Every model call is metered: `reserveModelCall` (the monthly paid-usage
 *    guard) is required, and a refusal ends the run (`spend-ceiling-reached`,
 *    or `cost-guard-not-configured` when no price is set).
 *  - A durable thread runs one request at a time: a run takes a lease first,
 *    and a second request meanwhile is refused (`thread-busy`) — two at once
 *    would fork the history or dispatch an approved incident twice.
 *
 * WHO OWNS A THREAD
 *
 * A thread belongs to the verified user within the verified tenant
 * (`tenant:uid:threadId`), so a colleague who guesses a threadId reaches a
 * different, empty thread — never someone else's conversation. Deciding a
 * paused dispatch takes `APPROVAL_REQUIRED_CAP` as well (`approval-not-permitted`).
 *
 * TURNS ON A DURABLE THREAD
 *
 * The conversation (messages) carries across requests on the same thread. The
 * per-turn fields do not: each new prompt resets errors, claims, the iteration
 * budget, the briefing and the pending action, so one turn's failure cannot
 * poison the next and the 8-iteration cap applies per turn.
 *
 * Returns a plain JSON-safe summary, never raw graph state (which carries
 * message objects).
 */
import { Command, INTERRUPT, MemorySaver } from '@langchain/langgraph';
import type { BaseCheckpointSaver } from '@langchain/langgraph-checkpoint';
import { HumanMessage } from '@langchain/core/messages';
import { buildCampaignDirectorGraph } from './graph';
import { anthropicAgentModel, type AgentModel } from './agentModel';
import type { HarnessContext } from './state';
import type { CounterReader } from './ecosMcpTools';
import type { ThreadLease } from './threadLease';

/** Deciding a held dispatch is an escalation decision, not a read. */
export const APPROVAL_REQUIRED_CAP = 'incidents.escalate';

export interface RunAgentRequest {
  threadId: string;
  prompt?: string;
  municipalityCode?: string;
  /** A human's decision on a paused dispatch. Needs a durable checkpointer. */
  resumeDecision?: { approved: boolean; note?: string };
}

export interface RunAgentDeps {
  /** Anthropic key, read by the caller from its runtime's secret store. */
  apiKey?: string;
  modelId?: string;
  /** Inject a model directly (tests). `null` forces the fail-closed path. */
  model?: AgentModel | null;
  counterReader?: CounterReader;
  /** Durable checkpointer. Absent → in-memory, single-request runs only. */
  checkpointer?: BaseCheckpointSaver;
  /** One run per durable thread at a time. Required with a durable checkpointer. */
  lease?: ThreadLease;
  /** Reserve one model call's cost (the monthly ceiling). Required: no meter, no run. */
  reserveModelCall?: () => Promise<void>;
  /** Clock for the lease (tests). */
  nowMs?: () => number;
}

export type RunAgentFailure =
  | 'model-not-configured'
  | 'resume-requires-durable-checkpointer'
  | 'nothing-to-resume'
  | 'awaiting-approval'
  | 'thread-too-long'
  | 'approval-not-permitted'
  | 'cost-guard-not-configured'
  | 'spend-ceiling-reached'
  | 'lease-not-configured'
  | 'thread-busy';

export type RunAgentResult =
  | {
      ok: true;
      briefing: string | null;
      errors: string[];
      iterationCount: number;
      approvalStatus: 'pending' | 'approved' | 'rejected';
      /** What the paused run is asking a human to approve, if it paused. */
      pendingApproval: unknown;
    }
  | { ok: false; reason: RunAgentFailure };

export async function runAgent(
  ctx: HarnessContext,
  req: RunAgentRequest,
  deps: RunAgentDeps = {},
): Promise<RunAgentResult> {
  const apiKey = deps.apiKey?.trim();
  const model =
    deps.model !== undefined ? deps.model : apiKey ? anthropicAgentModel(apiKey, deps.modelId) : null;
  if (!model) return { ok: false, reason: 'model-not-configured' };
  if (!deps.reserveModelCall) return { ok: false, reason: 'cost-guard-not-configured' };
  if (req.resumeDecision && !ctx.capabilities.includes(APPROVAL_REQUIRED_CAP)) {
    return { ok: false, reason: 'approval-not-permitted' };
  }
  if (req.resumeDecision && !deps.checkpointer) {
    return { ok: false, reason: 'resume-requires-durable-checkpointer' };
  }
  if (deps.checkpointer && !deps.lease) return { ok: false, reason: 'lease-not-configured' };

  // The thread is scoped to the verified tenant AND user (see header); the
  // durable saver also refuses any thread outside its tenant.
  const threadId = `${ctx.tenantId}:${ctx.uid}:${req.threadId}`;
  if (!deps.checkpointer) return execute(ctx, req, deps, model, new MemorySaver(), threadId);

  const now = deps.nowMs ?? Date.now;
  const token = await deps.lease!.acquire(threadId, now());
  if (!token) return { ok: false, reason: 'thread-busy' };
  try {
    return await execute(ctx, req, deps, model, deps.checkpointer, threadId, true);
  } finally {
    await deps.lease!.release(threadId, token).catch(() => undefined); // expiry is the backstop
  }
}

async function execute(
  ctx: HarnessContext,
  req: RunAgentRequest,
  deps: RunAgentDeps,
  model: AgentModel,
  checkpointer: BaseCheckpointSaver,
  threadId: string,
  durable = false,
): Promise<RunAgentResult> {
  const graph = buildCampaignDirectorGraph({
    checkpointer,
    model,
    counterReader: deps.counterReader,
    deps: { reserveModelCall: deps.reserveModelCall },
  });
  const config = { configurable: { thread_id: threadId, harnessContext: ctx } };

  if (durable) {
    const latest = await checkpointer.getTuple(config);
    const paused = Boolean(latest?.pendingWrites?.some(([, channel]) => channel === INTERRUPT));
    if (req.resumeDecision && !paused) return { ok: false, reason: 'nothing-to-resume' };
    if (!req.resumeDecision && paused) return { ok: false, reason: 'awaiting-approval' };
  }

  let state;
  try {
    state = req.resumeDecision
      ? await graph.invoke(new Command({ resume: req.resumeDecision }), config)
      : await graph.invoke(
          {
            messages: [new HumanMessage(req.prompt ?? 'Summarize the current baseline.')],
            ...(req.municipalityCode ? { municipalityCode: req.municipalityCode } : {}),
            // Per-turn reset (see header): null clears claims/errors.
            errors: null,
            claims: null,
            iterationCount: 0,
            briefingOutput: null,
            draftBriefing: null,
            approvalStatus: 'pending' as const,
            pendingAction: { type: 'none' as const },
          },
          config,
        );
  } catch (err) {
    if (causeChainHas(err, 'CheckpointTooLargeError')) return { ok: false, reason: 'thread-too-long' };
    const cost = costGuardCode(err);
    if (cost === 'CEILING_REACHED') return { ok: false, reason: 'spend-ceiling-reached' };
    if (cost === 'PRICE_NOT_CONFIGURED') return { ok: false, reason: 'cost-guard-not-configured' };
    throw err;
  }

  const interrupts = (state as Record<string, unknown>)[INTERRUPT] as Array<{ value: unknown }> | undefined;
  return {
    ok: true,
    briefing: state.briefingOutput,
    errors: state.errors,
    iterationCount: state.iterationCount,
    approvalStatus: state.approvalStatus,
    pendingApproval: interrupts?.[0]?.value ?? null,
  };
}

/** A named refusal (the saver's size limit), recognised even if the graph runtime wraps it. */
function causeChainHas(err: unknown, name: string): boolean {
  for (let e: unknown = err, depth = 0; e && depth < 5; e = (e as { cause?: unknown }).cause, depth += 1) {
    if (e instanceof Error && (e.name === name || e.message.includes(name))) return true;
  }
  return false;
}

/** The cost guard's refusal code, if the run was stopped by it. */
function costGuardCode(err: unknown): string | null {
  for (let e: unknown = err, depth = 0; e && depth < 5; e = (e as { cause?: unknown }).cause, depth += 1) {
    if (e instanceof Error && e.name === 'CostGuardError') return (e as Error & { code?: string }).code ?? null;
  }
  return null;
}
