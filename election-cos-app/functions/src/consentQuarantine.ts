/**
 * Election Campaign OS — consent quarantine (agent 13/19, designed as quarantine, not purge).
 *
 * The audit rates an automatic 48-hour hard purge as a critical defect: a volunteer's record
 * deleted by a timer is the failure it most fears, and it is irreversible. So a voter with no
 * valid consent is QUARANTINED: held out of every list and send, kept intact, and put in front
 * of a named person who either releases it (consent evidence found) or deletes it through the
 * normal data-subject route. Nothing here deletes anything.
 *
 * NOT EXPORTED from index.ts, deliberately: it needs the Blaze plan to be scheduled, a screen
 * for the release step, and the owner to name the releaser (docs/outstanding-agents-plan.md D3).
 * The pure functions below are what is built and tested now.
 */
export interface VoterConsentFields {
  id: string;
  popiaConsentGiven?: boolean;
  popiaConsentAt?: string;
  popiaConsentMethod?: string;
  deletedAt?: string | null;
  quarantinedAt?: string | null;
}

export interface QuarantineMark {
  quarantinedAt: string;
  quarantineReason: string;
}

/** Why a record lacks valid consent, or null if it has it. */
export function consentProblem(v: VoterConsentFields): string | null {
  if (v.popiaConsentGiven !== true) return 'Consent is not recorded as given.';
  if (!v.popiaConsentAt) return 'Consent has no recorded time.';
  if (!v.popiaConsentMethod) return 'Consent has no recorded method.';
  return null;
}

/** Records to quarantine now: unconsented, not already held, not already soft-deleted. */
export function selectForQuarantine(
  voters: VoterConsentFields[],
  now: Date,
): { id: string; mark: QuarantineMark }[] {
  const out: { id: string; mark: QuarantineMark }[] = [];
  for (const v of voters) {
    if (v.deletedAt || v.quarantinedAt) continue;
    const reason = consentProblem(v);
    if (reason)
      out.push({ id: v.id, mark: { quarantinedAt: now.toISOString(), quarantineReason: reason } });
  }
  return out;
}

export interface Release {
  releasedBy: string;
  releasedAt: string;
  releaseReason: string;
}

/**
 * A release needs a named person, a reason, and the consent evidence now on the record.
 * It cannot release a record that still has no valid consent: it would just be quarantined
 * again on the next pass.
 */
export function release(v: VoterConsentFields, by: string, reason: string, now: Date): Release {
  if (!by.trim()) throw new Error('A release needs the person who decided it.');
  if (!reason.trim()) throw new Error('A release needs a reason.');
  const problem = consentProblem(v);
  if (problem) throw new Error(`Cannot release: ${problem}`);
  return { releasedBy: by, releasedAt: now.toISOString(), releaseReason: reason };
}
