/**
 * Election Campaign OS — Campaign Director: the governed graph.
 *
 * The Graph layer: three nodes and the wiring that keeps an autonomous run on
 * the rails.
 *
 *  - `agent` calls the model (through the `AgentModel` seam) and FAILS CLOSED
 *    when none is configured — it records an error and produces no briefing,
 *    never a fabricated one.
 *  - `verify_policy` runs the deterministic provenance gate (`scenarioPolicy`)
 *    over every claim and refuses to pass a violation, rather than trusting the
 *    model's own say-so.
 *  - `execute_dispatch` is the one outward action, and it pauses for a human
 *    (`interrupt`) before anything is sent; a rejection stops it dead.
 *
 * The loop is capped at `MAX_ITERATIONS`. The graph is built with an injected
 * checkpointer, model and deps so it is tested with a fake model and an
 * in-memory saver, no network and no LLM.
 *
 * Nothing here is a Cloud Function; `callable.ts` is the deployable entry and
 * carries the `@deployable` marker.
 */
// Must come first: gives interrupt() its run context on the edge (see asyncContext.ts).
import './asyncContext';
import { Annotation, StateGraph, START, END, interrupt } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import type { BaseCheckpointSaver } from '@langchain/langgraph-checkpoint';
import { isAIMessage, type BaseMessage } from '@langchain/core/messages';
import type { RunnableConfig } from '@langchain/core/runnables';
import { findProvenanceViolations, type ProvenanceClaim } from './scenarioPolicy';
import { MAX_ITERATIONS, type HarnessContext, type PendingDispatch } from './state';
import type { AgentModel } from './agentModel';
import { buildEcosTools } from './ecosLangchainTools';
import type { CounterReader } from './ecosMcpTools';

export const CampaignDirectorState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({ reducer: (p, n) => p.concat(n), default: () => [] }),
  // claims and errors accumulate within a turn; an update of `null` clears them.
  // runAgent sends that at the start of each new turn, so on a durable thread an
  // old turn's error or violation cannot block every later briefing.
  claims: Annotation<ProvenanceClaim[], ProvenanceClaim[] | null>({
    reducer: (p, n) => (n === null ? [] : p.concat(n)),
    default: () => [],
  }),
  errors: Annotation<string[], string[] | null>({
    reducer: (p, n) => (n === null ? [] : p.concat(n)),
    default: () => [],
  }),
  municipalityCode: Annotation<string>({ reducer: (_p, n) => n, default: () => '' }),
  wardIds: Annotation<string[]>({ reducer: (_p, n) => n, default: () => [] }),
  scenarioSeed: Annotation<number | null>({ reducer: (_p, n) => n, default: () => null }),
  iterationCount: Annotation<number>({ reducer: (_p, n) => n, default: () => 0 }),
  pendingAction: Annotation<PendingDispatch>({ reducer: (_p, n) => n, default: () => ({ type: 'none' }) }),
  approvalStatus: Annotation<'pending' | 'approved' | 'rejected'>({ reducer: (_p, n) => n, default: () => 'pending' }),
  briefingOutput: Annotation<string | null>({ reducer: (_p, n) => n, default: () => null }),
});

export type CampaignDirectorGraphState = typeof CampaignDirectorState.State;

export interface GraphDeps {
  /** The real dispatch, injected. Off until a messaging credential exists. */
  dispatchIncident?: (ctx: HarnessContext, payload: NonNullable<PendingDispatch['payload']>) => Promise<void>;
}

/** Pull the verified harness context off the run config, or fail closed. */
export function getHarnessContext(config?: RunnableConfig): HarnessContext {
  const ctx = config?.configurable?.harnessContext as HarnessContext | undefined;
  if (!ctx?.tenantId || !ctx?.uid) throw new Error('HarnessContext missing verified tenantId/uid');
  return ctx;
}

/**
 * After the agent step: if the model asked to call tools and the iteration
 * budget is not spent, run them and loop back; otherwise re-check policy before
 * anything leaves. The cap stops a model that keeps asking for tools from
 * looping forever (the Loop layer's deterministic stop).
 */
export function routeAfterAgent(state: CampaignDirectorGraphState): 'tools' | 'verify_policy' {
  const last = state.messages[state.messages.length - 1];
  const toolCalls = last && isAIMessage(last) ? last.tool_calls ?? [] : [];
  if (toolCalls.length > 0 && state.iterationCount < MAX_ITERATIONS) return 'tools';
  return 'verify_policy';
}

/** After policy: a pending dispatch needs the human gate; otherwise end. */
export function routeAfterVerify(state: CampaignDirectorGraphState): 'execute_dispatch' | typeof END {
  if (state.pendingAction.type === 'incident_dispatch' && state.pendingAction.payload) {
    return 'execute_dispatch';
  }
  return END;
}

export function buildCampaignDirectorGraph(
  opts: {
    checkpointer?: BaseCheckpointSaver;
    model?: AgentModel | null;
    deps?: GraphDeps;
    counterReader?: CounterReader;
  } = {},
) {
  const model = opts.model ?? null;
  const deps = opts.deps ?? {};
  // Honest empty state when no reader is wired: the counter tool reports {}.
  const tools = buildEcosTools(opts.counterReader ?? (async () => ({})));
  const toolNode = new ToolNode(tools);

  async function agentNode(
    state: CampaignDirectorGraphState,
    config?: RunnableConfig,
  ): Promise<Partial<CampaignDirectorGraphState>> {
    getHarnessContext(config); // assert a verified context before any model call (cost guard would hook here)
    if (!model) {
      return { errors: ['Campaign Director model is not configured; refusing to fabricate a briefing.'] };
    }
    const reply = await model.bindTools(tools).invoke(state.messages);
    return { messages: [reply], iterationCount: state.iterationCount + 1 };
  }

  async function verifyPolicyNode(
    state: CampaignDirectorGraphState,
  ): Promise<Partial<CampaignDirectorGraphState>> {
    // Never synthesize a briefing over an existing error (e.g. the model
    // failed closed). An error state produces no output.
    if (state.errors.length > 0) return {};
    const violations = findProvenanceViolations(state.claims);
    if (violations.length > 0) {
      return {
        errors: [`Policy violation: ${violations.length} claim(s) — ${violations.map((v) => v.reason).join(', ')}`],
      };
    }
    const last = state.messages[state.messages.length - 1];
    return { briefingOutput: typeof last?.content === 'string' ? last.content : '' };
  }

  async function executeDispatchNode(
    state: CampaignDirectorGraphState,
    config?: RunnableConfig,
  ): Promise<Partial<CampaignDirectorGraphState>> {
    const ctx = getHarnessContext(config);
    if (state.pendingAction.type !== 'incident_dispatch' || !state.pendingAction.payload) return {};

    // Pauses the run and persists the checkpoint until resumed with a human
    // decision. Never wrapped in try/catch — the interrupt must propagate.
    const decision = interrupt({
      action: 'incident_dispatch',
      tenantId: ctx.tenantId,
      payload: state.pendingAction.payload,
    }) as { approved: boolean; note?: string };

    if (!decision?.approved) return { approvalStatus: 'rejected' };
    if (deps.dispatchIncident) await deps.dispatchIncident(ctx, state.pendingAction.payload);
    return { approvalStatus: 'approved' };
  }

  const builder = new StateGraph(CampaignDirectorState)
    .addNode('agent', agentNode)
    .addNode('tools', toolNode)
    .addNode('verify_policy', verifyPolicyNode)
    .addNode('execute_dispatch', executeDispatchNode)
    .addEdge(START, 'agent')
    .addConditionalEdges('agent', routeAfterAgent, { tools: 'tools', verify_policy: 'verify_policy' })
    .addEdge('tools', 'agent')
    .addConditionalEdges('verify_policy', routeAfterVerify, { execute_dispatch: 'execute_dispatch', [END]: END })
    .addEdge('execute_dispatch', END);

  return builder.compile({ checkpointer: opts.checkpointer });
}

export { MAX_ITERATIONS };
