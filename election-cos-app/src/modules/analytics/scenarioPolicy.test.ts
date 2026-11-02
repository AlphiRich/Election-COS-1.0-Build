import { describe, expect, it } from 'vitest';
import { UnsourcedInput, assertRecordable, isCitation, scenarioInputs } from './scenarioPolicy';

describe('the source gate', () => {
  it('refuses a sourced figure with no citation, or with one that is not a citation', () => {
    const base = { name: 'Turnout', value: 68.5, unit: '%', kind: 'sourced' as const };
    expect(() => assertRecordable(base)).toThrow(UnsourcedInput);
    expect(() => assertRecordable({ ...base, source: 'trust me' })).toThrow(UnsourcedInput);
    expect(() => assertRecordable({ ...base, source: '   ' })).toThrow(UnsourcedInput);
  });
  it('accepts a gazette, a URL, or a pinned data file', () => {
    for (const source of [
      'Government Gazette 53182',
      'https://www.elections.org.za/results',
      'src/modules/analytics/nw405Example.ts',
    ]) {
      expect(isCitation(source), source).toBe(true);
    }
  });
  it('never lets a swing be sourced', () => {
    expect(() =>
      assertRecordable({
        name: 'ANC swing',
        value: -4,
        unit: 'points',
        kind: 'sourced',
        source: 'https://example.org/poll',
      }),
    ).toThrow(/assumption/);
  });
  it('lets any number be an assumption, labelled as one', () => {
    expect(
      assertRecordable({ name: 'X swing', value: 3, unit: 'points', kind: 'assumption' }).kind,
    ).toBe('assumption');
  });
});

describe('scenarioInputs', () => {
  it('with no swing lists only the sourced baseline', () => {
    const r = scenarioInputs({}, 100_000, 100_000);
    expect(r.map((x) => x.kind)).toEqual(['sourced']);
  });
  it('labels each typed swing and a changed turnout as assumptions, and ignores zeros', () => {
    const r = scenarioInputs({ A: 4, B: 0, C: -2 }, 90_000, 100_000);
    expect(r.filter((x) => x.kind === 'assumption').map((x) => x.name)).toEqual([
      'A swing',
      'C swing',
      'Valid votes assumed',
    ]);
    expect(r.filter((x) => x.kind === 'sourced')).toHaveLength(1);
  });
});
