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
 * The provider is Anthropic (ChatAnthropic), wired behind a key-presence check:
 * `resolveAgentModel` returns `null` unless `ANTHROPIC_API_KEY` is set in the
 * function's environment, so the agent refuses until a real credential exists —
 * the same posture as `incidentDispatch`, off until its credential exists.
 *
 * The key is NOT held in this build or this repo (rule 10). At deploy it is a
 * Firebase Functions secret the owner sets:
 *   firebase functions:secrets:set ANTHROPIC_API_KEY
 * and the callable binds it (`defineSecret('ANTHROPIC_API_KEY')`) when it is
 * turned on. The model id defaults below and is overridable with
 * `CAMPAIGN_DIRECTOR_MODEL` so it can be set per deploy without a code change.
 *
 * Tool use: the model is not yet bound to the ECOS MCP tools — that needs a
 * ToolNode loop in the graph (agent → tools → agent) and is the next step; today
 * the node produces a briefing from its messages.
 */
import type { BaseMessage } from '@langchain/core/messages';
import { ChatAnthropic } from '@langchain/anthropic';

export interface AgentModel {
  invoke(messages: BaseMessage[]): Promise<BaseMessage>;
}

const DEFAULT_MODEL = 'claude-sonnet-5-5';

/**
 * The configured model, or `null` when no credential is present. `null` is the
 * honest state whenever the key is absent — the agent refuses rather than
 * inventing. Reads the key and model id from the function environment only.
 */
export function resolveAgentModel(): AgentModel | null {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;

  const model = process.env.CAMPAIGN_DIRECTOR_MODEL?.trim() || DEFAULT_MODEL;
  const chat = new ChatAnthropic({ apiKey, model, temperature: 0, maxTokens: 1024 });
  return { invoke: (messages: BaseMessage[]) => chat.invoke(messages) };
}
