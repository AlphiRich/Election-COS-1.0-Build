import { describe, expect, it } from 'vitest';
import {
  ScenarioPolicyError,
  assertProvenance,
  findProvenanceViolations,
  provenanceViolation,
  type ProvenanceClaim,
} from './scenarioPolicy';

const sourced = (claim: string, citation: string | null): ProvenanceClaim => ({
  claim,
  kind: 'sourced',
  citation,
});
const assumption = (claim: string): ProvenanceClaim => ({ claim, kind: 'user_assumption', citation: null });

describe('provenanceViolation', () => {
  it('passes a sourced claim with a citation', () => {
    expect(provenanceViolation(sourced('NW405 had 122,059 registered voters', 'IEC Circular 1 of 2025, Annexure A'))).toBeNull();
  });

  it('passes any user assumption, cited or not', () => {
    expect(provenanceViolation(assumption('assume a 5% swing to the DA'))).toBeNull();
    expect(provenanceViolation(assumption('turnout delta of -3%'))).toBeNull();
  });

  it('rejects a sourced claim with no citation (the fabrication class)', () => {
    expect(provenanceViolation(sourced('Party X will win ward 12', null))?.reason).toBe('sourced-without-citation');
    expect(provenanceViolation(sourced('Party X will win ward 12', '   '))?.reason).toBe('sourced-without-citation');
  });

  it('rejects a swing or turnout delta labelled sourced — even WITH a citation', () => {
    // The label is the lie: a swing is never a fact, so a citation cannot rescue it.
    expect(provenanceViolation(sourced('a 5% swing to the DA', 'some report'))?.reason).toBe('swing-marked-sourced');
    expect(provenanceViolation(sourced('turnout-delta of +4%', 'poll'))?.reason).toBe('swing-marked-sourced');
    expect(provenanceViolation(sourced('turnout delta of +4%', 'poll'))?.reason).toBe('swing-marked-sourced');
  });

  it('does not catch the bare word "turnout" — a real reported figure is sourceable', () => {
    expect(provenanceViolation(sourced('turnout was 45.2% on the ward ballot', 'IEC NW405 2021 report'))).toBeNull();
  });
});

describe('findProvenanceViolations / assertProvenance', () => {
  const claims: ProvenanceClaim[] = [
    sourced('NW405 has 34 wards', 'IEC Circular 1 of 2025'),
    assumption('assume a 6% swing'),
    sourced('a 6% swing to the EFF', 'made up'), // swing-marked-sourced
    sourced('Party Y leads', null), // sourced-without-citation
  ];

  it('returns exactly the violating claims, in order', () => {
    const v = findProvenanceViolations(claims);
    expect(v.map((x) => x.reason)).toEqual(['swing-marked-sourced', 'sourced-without-citation']);
  });

  it('assertProvenance throws ScenarioPolicyError carrying the violations', () => {
    expect(() => assertProvenance(claims)).toThrow(ScenarioPolicyError);
    try {
      assertProvenance(claims);
    } catch (e) {
      expect(e).toBeInstanceOf(ScenarioPolicyError);
      expect((e as ScenarioPolicyError).violations).toHaveLength(2);
    }
  });

  it('assertProvenance is a no-op when every claim is sound', () => {
    expect(() =>
      assertProvenance([sourced('34 wards', 'IEC Circular 1 of 2025'), assumption('assume 5% swing')]),
    ).not.toThrow();
  });
});
