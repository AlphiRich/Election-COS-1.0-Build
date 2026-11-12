/**
 * Election Campaign OS — scenario policy (agent 25, SCENARIO_POLICY).
 *
 * Every input to a scenario is one of two things, and the screen must say which:
 *
 *   - SOURCED: a figure that comes from a record, with a citation a reader can follow
 *     (the certified 2021 result; a Gazette; an IEC report).
 *   - ASSUMPTION: a number a person typed. The product has no model of voter intention, so a
 *     swing is always this.
 *
 * The gate: an input cannot be recorded as SOURCED without a citation, and a citation must look
 * like one (a gazette/notice reference, a URL, or a repo path to a pinned data file). A swing
 * can never be SOURCED here at all: nothing in this product produces one.
 */
export type InputKind = 'sourced' | 'assumption';

export interface ScenarioInputRecord {
  name: string;
  value: number;
  unit: string;
  kind: InputKind;
  /** Required when kind is 'sourced'. */
  source?: string;
}

export class UnsourcedInput extends Error {}

const CITATION_RE =
  /(https?:\/\/\S+|Gazette\s+\S+|Provincial Notice\s+\S+|Government Notice\s+\S+|\b[\w.-]+\/[\w./-]+\.(?:ts|json|md|mjs))/i;

export function isCitation(s: string | undefined): boolean {
  return Boolean(s && s.trim().length >= 8 && CITATION_RE.test(s));
}

/** Throws if a sourced input has no usable citation, or if a swing claims to be sourced. */
export function assertRecordable(i: ScenarioInputRecord): ScenarioInputRecord {
  if (i.kind === 'sourced') {
    if (/swing/i.test(i.name)) {
      throw new UnsourcedInput(
        `${i.name}: a swing is always an assumption you set, never a sourced figure.`,
      );
    }
    if (!isCitation(i.source)) {
      throw new UnsourcedInput(`${i.name}: a sourced figure needs a citation a reader can follow.`);
    }
  }
  return i;
}

/** The inputs of the current scenario, each labelled for the screen and for any export. */
export function scenarioInputs(
  swing: Record<string, number>,
  validVotes: number,
  baselineValidVotes: number,
): ScenarioInputRecord[] {
  const rows: ScenarioInputRecord[] = [
    {
      name: 'Baseline result',
      value: baselineValidVotes,
      unit: 'valid votes',
      kind: 'sourced',
      source: 'src/modules/analytics/nw405Example.ts (certified 2021 result)',
    },
  ];
  for (const [party, v] of Object.entries(swing)) {
    if (v !== 0) {
      rows.push({ name: `${party} swing`, value: v, unit: 'points', kind: 'assumption' });
    }
  }
  if (validVotes !== baselineValidVotes) {
    rows.push({
      name: 'Valid votes assumed',
      value: validVotes,
      unit: 'votes',
      kind: 'assumption',
    });
  }
  return rows.map(assertRecordable);
}
