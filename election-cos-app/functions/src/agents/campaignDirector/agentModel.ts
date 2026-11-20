/**
 * Election Campaign OS — Campaign Director: the model seam.
 *
 * The agent node calls a model through this narrow interface, never a provider
 * SDK directly, so (a) the graph is tested with a fake model and no network,
 * and (b) the node FAILS CLOSED when no model is configured — it records an
 * error and ships nothing, rather than fabricating a briefing (build discipline
 * rule 2; the Evidence Hierarchy forbids trusting a model's self-report, and a
 * model that does not exist cannot be trusted at all).
 *
 * No provider is wired yet: `resolveAgentModel` returns `null` until a model
 * credential and binding exist — the same posture as `incidentDispatch`, which
 * stays off until the WhatsApp credential exists. When a provider is added
 * (e.g. `@langchain/anthropic` bound to the MCP tools), construct it here behind
 * a presence check on its key; nothing else changes.
 */
import type { AIMessage, BaseMessage } from '@langchain/core/messages';

export interface AgentModel {
  invoke(messages: BaseMessage[]): Promise<AIMessage>;
}

/**
 * The configured model, or `null` when none is available. Returning `null` is
 * the honest state today: there is no model credential in this environment and
 * the function does not deploy, so the agent refuses rather than inventing.
 */
export function resolveAgentModel(): AgentModel | null {
  return null;
}
