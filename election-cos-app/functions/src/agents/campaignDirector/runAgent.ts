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
 *
 * Returns a plain JSON-safe summary, never raw graph state (which carries
 * message objects).
 */
import { Command, MemorySaver } from '@langchain/langgraph';
import type { BaseCheckpointSaver } from '@langchain/langgraph-checkpoint';
import { HumanMessage } from '@langchain/core/messages';
import { buildCampaignDirectorGraph } from './graph';
import { anthropicAgentModel, type AgentModel } from './agentModel';
import type { HarnessContext } from './state';
import type { CounterReader } from './ecosMcpTools';

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
}

export type RunAgentFailure = 'model-not-configured' | 'resume-requires-durable-checkpointer';

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
  if (req.resumeDecision && !deps.checkpointer) {
    return { ok: false, reason: 'resume-requires-durable-checkpointer' };
  }

  const graph = buildCampaignDirectorGraph({
    checkpointer: deps.checkpointer ?? new MemorySaver(),
    model,
    counterReader: deps.counterReader,
  });
  // The thread is scoped to the verified tenant, so a checkpoint can never be
  // read or resumed across tenants (the Firestore saver also enforces this).
  const config = { configurable: { thread_id: `${ctx.tenantId}:${req.threadId}`, harnessContext: ctx } };

  const state = req.resumeDecision
    ? await graph.invoke(new Command({ resume: req.resumeDecision }), config)
    : await graph.invoke(
        {
          municipalityCode: req.municipalityCode ?? '',
          messages: [new HumanMessage(req.prompt ?? 'Summarize the current baseline.')],
        },
        config,
      );

  const interrupts = (state as Record<string, unknown>).__interrupt__ as Array<{ value: unknown }> | undefined;
  return {
    ok: true,
    briefing: state.briefingOutput,
    errors: state.errors,
    iterationCount: state.iterationCount,
    approvalStatus: state.approvalStatus,
    pendingApproval: interrupts?.[0]?.value ?? null,
  };
}
