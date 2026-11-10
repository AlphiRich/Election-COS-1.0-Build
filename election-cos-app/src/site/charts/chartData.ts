/**
 * Election Campaign OS — public site, chart series slots and folding (see Charts.tsx).
 */
/** Fill classes for the categorical slots, in order. Index 6 is "Other". */
export const SERIES_FILL = ['fill-viz-1', 'fill-viz-2', 'fill-viz-3', 'fill-viz-4', 'fill-viz-5', 'fill-viz-6', 'fill-slate'];
export const SERIES_BG = ['bg-viz-1', 'bg-viz-2', 'bg-viz-3', 'bg-viz-4', 'bg-viz-5', 'bg-viz-6', 'bg-slate'];
export const MAX_SERIES = 6;

export interface Slice {
  id: string;
  name: string;
  value: number;
}

/** The largest six keep their own slot; the rest become one "Other" slice, so a seventh hue is never invented. */
export function foldOther(slices: Slice[], max = MAX_SERIES, otherName = 'Other Parties'): Slice[] {
  const sorted = [...slices].sort((a, b) => b.value - a.value);
  if (sorted.length <= max + 1) return sorted;
  const rest = sorted.slice(max);
  return [...sorted.slice(0, max), { id: 'OTHER', name: `${otherName} (${rest.length})`, value: rest.reduce((s, x) => s + x.value, 0) }];
}

