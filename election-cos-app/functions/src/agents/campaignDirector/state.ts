/**
 * Election Campaign OS — Campaign Director: state & harness context.
 *
 * Domain types for the agent, kept free of the LangGraph runtime so they
 * compile and are tested without the agent framework or an LLM. The
 * `StateGraph` wrapper (Annotation.Root over this shape) is added when the
 * graph is wired; the shape and its governance predicates live here so they can
 * be proven on their own.
 *
 * `HarnessContext` is the verified auth context — derived strictly from the
 * verified Firebase token claims, NEVER from request headers or client input
 * (build spec §4.4; the harness "Walls" that the model cannot talk its way
 * past). `harnessContextFrom` fails closed: no tenant, no run.
 *
 * Library module — no `@deployable` marker (the callable that uses it carries
 * one).
 */
import type { ProvenanceClaim } from './scenarioPolicy';

export interface HarnessContext {
  tenantId: string;
  uid: string;
  capabilities: string[];
}

/** A dispatch the agent wants to make, held until a human approves it (HITL). */
export interface PendingDispatch {
  type: 'incident_dispatch' | 'none';
  payload?: { incidentId: string; responderId: string; summary: string };
}

/**
 * The checkpointed graph state. Scoped pointers only — never raw voter PII or a
 * full roll dump in agent state (build discipline rule 2 / §4.2).
 */
export interface CampaignDirectorStateShape {
  claims: ProvenanceClaim[];
  errors: string[];
  municipalityCode: string;
  wardIds: string[];
  scenarioSeed: number | null;
  iterationCount: number;
  pendingAction: PendingDispatch;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  briefingOutput: string | null;
}

/**
 * Hard cap on autonomous iterations. The Loop layer's deterministic stop
 * condition: a weak verifier plus cheap generation is an infinite spend
 * spiral, so the loop can never run free.
 */
export const MAX_ITERATIONS = 8;

/** Shape of a verified Firebase callable `request.auth`, as much as we read. */
export interface VerifiedAuthLike {
  uid?: string;
  token?: { tenantId?: unknown; caps?: unknown };
}

/**
 * Build the harness context from a verified callable auth object. Fails closed:
 * a missing or non-string tenantId, or a missing uid, throws rather than
 * defaulting — the agent can never run tenant-unscoped (rule 5; §4.4). Caps are
 * read from the token too, keeping only the strings.
 */
export function harnessContextFrom(auth: VerifiedAuthLike | undefined | null): HarnessContext {
  const uid = auth?.uid;
  const tenantId = auth?.token?.tenantId;
  if (!uid || typeof tenantId !== 'string' || tenantId.trim() === '') {
    throw new Error('HarnessContext: a verified tenantId and uid are required.');
  }
  const rawCaps = auth?.token?.caps;
  const capabilities = Array.isArray(rawCaps)
    ? rawCaps.filter((c): c is string => typeof c === 'string')
    : [];
  return { tenantId, uid, capabilities };
}

/** Loop stop condition: the iteration budget is spent. */
export function iterationBudgetExhausted(
  state: Pick<CampaignDirectorStateShape, 'iterationCount'>,
): boolean {
  return state.iterationCount >= MAX_ITERATIONS;
}

/**
 * Whether the graph must pause for a human before acting. An incident dispatch
 * with a payload is the one outward action this agent can take, and it never
 * happens without explicit human approval (HITL interrupt before dispatch).
 */
export function requiresHumanApproval(
  state: Pick<CampaignDirectorStateShape, 'pendingAction'>,
): boolean {
  return state.pendingAction.type === 'incident_dispatch' && Boolean(state.pendingAction.payload);
}
