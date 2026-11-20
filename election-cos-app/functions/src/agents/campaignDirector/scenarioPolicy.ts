/**
 * Election Campaign OS — Campaign Director: scenario provenance policy.
 *
 * The deterministic gate that keeps the agent honest, and the reason a
 * language model is allowed nowhere near a published figure without passing
 * through it. Build discipline rule 2: never fabricate data, and never present
 * an assumption as a fact.
 *
 * Two rules, both absolute:
 *
 *  1. A scenario SWING or TURNOUT DELTA is always a "what if" the user stated,
 *     never something read from a source. It can never be labelled `sourced`.
 *     (The attached design calls this out explicitly: "swings can never be
 *     sourced.")
 *  2. Anything labelled `sourced` must carry a citation to the primary source
 *     it came from. A `sourced` claim with no citation is a fabrication waiting
 *     to be quoted.
 *
 * Pure functions, no I/O and no model: the agent graph's verify step
 * (campaignDirector/graph.ts `verifyPolicyNode`, when it is wired) runs this
 * over every claim the model emits and refuses to proceed on a violation,
 * rather than trusting the model's own judgement — the Evidence Hierarchy's
 * rule that a self-report is the weakest evidence and never sufficient.
 *
 * This module is a library, not a Cloud Function, so it carries no
 * `@deployable` marker; the function that uses it does.
 */

/** How a claim came to be: read from a source, or stated by the user. */
export type ProvenanceKind = 'sourced' | 'user_assumption';

export interface ProvenanceClaim {
  /** The statement itself, as it would be shown to a campaign operator. */
  claim: string;
  kind: ProvenanceKind;
  /** The primary source, required when `kind` is `sourced`; otherwise null. */
  citation: string | null;
}

/**
 * Wording that can only ever be a user assumption. A swing and a turnout delta
 * are quantities a user proposes for a scenario — never facts — so a claim that
 * is *about* one can never be `sourced`. Word-bounded so "turnout" alone (a real
 * reported figure) is not caught; only a swing or a turnout delta is.
 */
const ASSUMPTION_ONLY = /\b(swing|turnout[\s-]?delta)\b/i;

export type ProvenanceViolation =
  | { reason: 'swing-marked-sourced'; claim: ProvenanceClaim }
  | { reason: 'sourced-without-citation'; claim: ProvenanceClaim };

/**
 * The single-claim check. Returns the violation, or null when the claim is
 * sound. The swing check runs before the citation check: a swing labelled
 * `sourced` is invalid even if a citation was attached, because the label
 * itself is the lie.
 */
export function provenanceViolation(claim: ProvenanceClaim): ProvenanceViolation | null {
  if (claim.kind !== 'sourced') return null;
  if (ASSUMPTION_ONLY.test(claim.claim)) return { reason: 'swing-marked-sourced', claim };
  if (!claim.citation || claim.citation.trim() === '') {
    return { reason: 'sourced-without-citation', claim };
  }
  return null;
}

/** Every violation across a set of claims, in order. Empty means all sound. */
export function findProvenanceViolations(
  claims: readonly ProvenanceClaim[],
): ProvenanceViolation[] {
  const out: ProvenanceViolation[] = [];
  for (const claim of claims) {
    const v = provenanceViolation(claim);
    if (v) out.push(v);
  }
  return out;
}

export class ScenarioPolicyError extends Error {
  readonly violations: ProvenanceViolation[];
  constructor(violations: ProvenanceViolation[]) {
    super(
      `Scenario provenance policy: ${violations.length} violation(s) — ` +
        violations.map((v) => `${v.reason} ("${v.claim.claim}")`).join('; '),
    );
    this.name = 'ScenarioPolicyError';
    this.violations = violations;
  }
}

/** Throw unless every claim is sound. The agent calls this before any output ships. */
export function assertProvenance(claims: readonly ProvenanceClaim[]): void {
  const violations = findProvenanceViolations(claims);
  if (violations.length > 0) throw new ScenarioPolicyError(violations);
}
