/**
 * Election Campaign OS — incident dispatch (agent 20, INCIDENT_DISPATCH).
 *
 * Tells a named responder that an incident needs attention. Built behind a channel interface and
 * OFF by default: the real WhatsApp channel needs a credential this project does not have.
 *
 * Rules, each tested:
 *  - DATA MINIMISATION: the message carries the category, ward and a case reference, never the
 *    complainant's name, address, phone or the free-text description.
 *  - FAILS CLOSED: disabled, no channel, or no configured price means no dispatch (and no cost).
 *  - COST: a paid dispatch reserves its cost against the monthly ceiling first (costGuard).
 *  - ONCE: one dispatch per incident per responder; a retry returns the first result.
 *  - HONEST OUTCOME: a failed send is reported as failed, never as sent.
 */
export interface DispatchChannel {
  send(toE164: string, text: string): Promise<{ delivered: boolean; providerMessageId?: string }>;
}

export interface IncidentForDispatch {
  id: string;
  category: string;
  wardCode: string;
  /** Present on the record but deliberately never read below. */
  description?: string;
  reporterName?: string;
}

export type DispatchOutcome =
  | { status: 'SENT'; providerMessageId?: string }
  | { status: 'FAILED' }
  | { status: 'DUPLICATE'; previous: 'SENT' | 'FAILED' }
  | { status: 'DISABLED' };

export interface DispatchDeps {
  enabled: boolean;
  channel: DispatchChannel | null;
  /** Reserve cost; throws (e.g. CostGuardError) if not allowed. */
  reserve: () => Promise<void>;
  /** Idempotency ledger. */
  ledger: Map<string, 'SENT' | 'FAILED'>;
}

export function buildMessage(i: IncidentForDispatch): string {
  return `Election Campaign OS: new ${i.category} incident in ward ${i.wardCode}. Case ${i.id}. Open the app to act.`;
}

export async function dispatchIncident(
  deps: DispatchDeps,
  incident: IncidentForDispatch,
  responderE164: string,
): Promise<DispatchOutcome> {
  if (!deps.enabled || !deps.channel) return { status: 'DISABLED' };
  const key = `${incident.id}::${responderE164}`;
  const prior = deps.ledger.get(key);
  if (prior) return { status: 'DUPLICATE', previous: prior };
  await deps.reserve();
  let result: { delivered: boolean; providerMessageId?: string };
  try {
    result = await deps.channel.send(responderE164, buildMessage(incident));
  } catch {
    result = { delivered: false };
  }
  deps.ledger.set(key, result.delivered ? 'SENT' : 'FAILED');
  return result.delivered
    ? { status: 'SENT', providerMessageId: result.providerMessageId }
    : { status: 'FAILED' };
}
