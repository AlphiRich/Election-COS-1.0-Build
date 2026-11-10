import { describe, expect, it } from 'vitest';
import { MAX_SERIES, SERIES_BG, SERIES_FILL, foldOther } from './chartData';

describe('chart series', () => {
  it('six categorical slots plus Other, the same order for fills and keys', () => {
    expect(MAX_SERIES).toBe(6);
    expect(SERIES_FILL).toHaveLength(7);
    expect(SERIES_BG.map((c) => c.replace('bg-', ''))).toEqual(SERIES_FILL.map((c) => c.replace('fill-', '')));
  });
  it('folds everything past the sixth into one Other slice, never a seventh hue, and keeps the total', () => {
    const slices = Array.from({ length: 10 }, (_, i) => ({ id: `P${i}`, name: `P${i}`, value: 10 - i }));
    const f = foldOther(slices);
    expect(f).toHaveLength(7);
    expect(f[6].id).toBe('OTHER');
    expect(f.reduce((s, x) => s + x.value, 0)).toBe(55);
  });
  it('does not fold a seventh slice into Other on its own', () => {
    const seven = Array.from({ length: 7 }, (_, i) => ({ id: `P${i}`, name: `P${i}`, value: 7 - i }));
    expect(foldOther(seven).map((s) => s.id)).toEqual(seven.map((s) => s.id));
  });
});
