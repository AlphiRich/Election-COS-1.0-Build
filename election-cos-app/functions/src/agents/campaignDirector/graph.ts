/**
 * Election Campaign OS — Campaign Director: the governed graph.
 *
 * The Graph layer: the nodes and the wiring that keep an autonomous run on the
 * rails.
 *
 *  - `agent` calls the model (through the `AgentModel` seam) and FAILS CLOSED
 *    when none is configured — it records an error and produces no briefing,
 *    never a fabricated one. Each call first reserves its cost against the
 *    monthly paid-usage ceiling (`reserveModelCall`); a refusal stops the run.
 *  - `tools` runs the read-only ECOS tools (ToolNode).
 *  - `submit` captures the briefing. A briefing exists ONLY as a
 *    `submit_briefing` tool call, which carries the text AND the claims behind
 *    it (each `sourced` with a citation, or a `user_assumption`). Free text from
 *    the model is never shipped: without a submission the turn fails closed.
 *  - `budget_exhausted` ends a turn that hit the iteration cap still asking for
 *    tools: every pending call is answered "not run", so a durable thread never
 *    carries an unanswered tool call into the next turn, and an error says why.
 *  - `verify_policy` runs the deterministic provenance gate (`scenarioPolicy`)
 *    over the submitted claims, and requires every percentage in the briefing to
 *    be declared as a claim, rather than trusting the model's own say-so.
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
import { isAIMessage, SystemMessage, ToolMessage, type AIMessage, type BaseMessage } from '@langchain/core/messages';
import type { RunnableConfig } from '@langchain/core/runnables';
import { tool, type StructuredToolInterface } from '@langchain/core/tools';
import { z } from 'zod';
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
  /** The submitted briefing, held until verify_policy passes it. Per turn. */
  draftBriefing: Annotation<string | null>({ reducer: (_p, n) => n, default: () => null }),
});

export const SUBMIT_BRIEFING = 'submit_briefing';

const ClaimSchema = z.object({
  claim: z.string().min(1).max(500),
  kind: z.enum(['sourced', 'user_assumption']),
  citation: z.string().max(300).nullable().default(null),
});
export const SubmitBriefingSchema = z.object({
  briefing: z.string().min(1).max(6000),
  claims: z.array(ClaimSchema).max(40),
});

/**
 * The only way a briefing leaves the agent. Bound to the model with the ECOS
 * tools, but never executed by the ToolNode: the graph routes it to `submit`.
 */
export const submitBriefingTool = tool(async () => 'Briefing received for verification.', {
  name: SUBMIT_BRIEFING,
  description:
    'Submit the final briefing for the operator. Required: a briefing is only delivered through this tool. ' +
    'List every figure in it as a claim: kind "sourced" with the citation it came from (a tool result or a ' +
    'certified source), or kind "user_assumption" for anything the user proposed, such as a swing or a ' +
    'turnout delta. A swing is never sourced. Every percentage in the briefing must appear in a claim.',
  schema: SubmitBriefingSchema,
});

/** Prepended to every model call, never stored in the thread. */
export const SYSTEM_PROMPT = [
  'You are the Campaign Director for Election Campaign OS, briefing a South African local-government campaign operator.',
  'Use only the tools for figures. Never invent a number, a result or a statute; if a tool refuses, say so.',
  'A swing or turnout change is a user assumption, never a fact, and is labelled as one.',
  `Deliver the briefing only by calling ${SUBMIT_BRIEFING}, with every figure listed as a claim.`,
].join(' ');

/** Every percentage in a text, normalised ("12.5 %" → "12.5%"). */
export function percentagesIn(text: string): string[] {
  return [...text.matchAll(/(\d+(?:[.,]\d+)?)\s?%/g)].map((m) => `${m[1].replace(',', '.')}%`);
}

/** Percentages the briefing states that no claim declares. */
export function undeclaredPercentages(briefing: string, claims: readonly ProvenanceClaim[]): string[] {
  const declared = new Set(claims.flatMap((c) => percentagesIn(c.claim)));
  return [...new Set(percentagesIn(briefing))].filter((p) => !declared.has(p));
}

export type CampaignDirectorGraphState = typeof CampaignDirectorState.State;

export interface GraphDeps {
  /** The real dispatch, injected. Off until a messaging credential exists. */
  dispatchIncident?: (ctx: HarnessContext, payload: NonNullable<PendingDispatch['payload']>) => Promise<void>;
  /**
   * Reserve one model call's cost against the monthly ceiling, BEFORE the call.
   * Throws (`CostGuardError`) to refuse; the error ends the run. runAgent
   * requires it; graph-level tests may omit it.
   */
  reserveModelCall?: () => Promise<void>;
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
export function routeAfterAgent(
  state: CampaignDirectorGraphState,
): 'tools' | 'submit' | 'budget_exhausted' | 'verify_policy' {
  const toolCalls = pendingToolCalls(state);
  if (toolCalls.length === 0) return 'verify_policy';
  if (toolCalls.some((c) => c.name === SUBMIT_BRIEFING)) return 'submit';
  if (state.iterationCount < MAX_ITERATIONS) return 'tools';
  return 'budget_exhausted';
}

function pendingToolCalls(state: CampaignDirectorGraphState): NonNullable<AIMessage['tool_calls']> {
  const last = state.messages[state.messages.length - 1];
  return last && isAIMessage(last) ? last.tool_calls ?? [] : [];
}

/** Answer every pending tool call, so the thread stays a valid conversation. */
function answerAll(state: CampaignDirectorGraphState, content: (name: string) => string): ToolMessage[] {
  return pendingToolCalls(state).map(
    (c, i) => new ToolMessage({ content: content(c.name), tool_call_id: c.id ?? `call-${i}`, name: c.name }),
  );
}

/** After policy: a pending dispatch needs the human gate; an error or nothing pending ends. */
export function routeAfterVerify(state: CampaignDirectorGraphState): 'execute_dispatch' | typeof END {
  if ((state.errors ?? []).length > 0) return END; // a refused turn never reaches the outward action
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
  const modelTools: StructuredToolInterface[] = [...tools, submitBriefingTool as unknown as StructuredToolInterface];

  async function agentNode(
    state: CampaignDirectorGraphState,
    config?: RunnableConfig,
  ): Promise<Partial<CampaignDirectorGraphState>> {
    getHarnessContext(config); // assert a verified context before any model call
    if (!model) {
      return { errors: ['Campaign Director model is not configured; refusing to fabricate a briefing.'] };
    }
    if (deps.reserveModelCall) await deps.reserveModelCall(); // throws to refuse; never caught here
    const reply = await model.bindTools(modelTools).invoke([new SystemMessage(SYSTEM_PROMPT), ...state.messages]);
    return { messages: [reply], iterationCount: state.iterationCount + 1 };
  }

  async function submitNode(state: CampaignDirectorGraphState): Promise<Partial<CampaignDirectorGraphState>> {
    const call = pendingToolCalls(state).find((c) => c.name === SUBMIT_BRIEFING);
    const parsed = SubmitBriefingSchema.safeParse(call?.args);
    const messages = answerAll(state, (name) =>
      name !== SUBMIT_BRIEFING
        ? 'Not run: the briefing was submitted in the same step.'
        : parsed.success
          ? 'Briefing received for verification.'
          : 'Rejected: the submission did not match the submit_briefing schema.',
    );
    if (!parsed.success) {
      return { messages, errors: ['The submitted briefing did not match the submit_briefing schema; nothing is returned.'] };
    }
    return { messages, draftBriefing: parsed.data.briefing, claims: parsed.data.claims };
  }

  async function budgetExhaustedNode(state: CampaignDirectorGraphState): Promise<Partial<CampaignDirectorGraphState>> {
    return {
      messages: answerAll(state, () => 'Not run: the iteration budget for this turn is exhausted.'),
      errors: [`The iteration budget (${MAX_ITERATIONS}) ran out before a briefing was submitted; nothing is returned.`],
    };
  }

  async function verifyPolicyNode(
    state: CampaignDirectorGraphState,
  ): Promise<Partial<CampaignDirectorGraphState>> {
    // Never synthesize a briefing over an existing error (e.g. the model
    // failed closed). An error state produces no output.
    if (state.errors.length > 0) return {};
    if (state.draftBriefing === null) {
      return { errors: [`No briefing was submitted through ${SUBMIT_BRIEFING}; unverified text is never returned.`] };
    }
    const violations = findProvenanceViolations(state.claims);
    if (violations.length > 0) {
      return {
        errors: [`Policy violation: ${violations.length} claim(s) — ${violations.map((v) => v.reason).join(', ')}`],
      };
    }
    const undeclared = undeclaredPercentages(state.draftBriefing, state.claims);
    if (undeclared.length > 0) {
      return { errors: [`Policy violation: figure(s) not declared as claims — ${undeclared.join(', ')}`] };
    }
    return { briefingOutput: state.draftBriefing };
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
    .addNode('submit', submitNode)
    .addNode('budget_exhausted', budgetExhaustedNode)
    .addNode('verify_policy', verifyPolicyNode)
    .addNode('execute_dispatch', executeDispatchNode)
    .addEdge(START, 'agent')
    .addConditionalEdges('agent', routeAfterAgent, {
      tools: 'tools',
      submit: 'submit',
      budget_exhausted: 'budget_exhausted',
      verify_policy: 'verify_policy',
    })
    .addEdge('tools', 'agent')
    .addEdge('submit', 'verify_policy')
    .addEdge('budget_exhausted', 'verify_policy')
    .addConditionalEdges('verify_policy', routeAfterVerify, { execute_dispatch: 'execute_dispatch', [END]: END })
    .addEdge('execute_dispatch', END);

  return builder.compile({ checkpointer: opts.checkpointer });
}

export { MAX_ITERATIONS };
