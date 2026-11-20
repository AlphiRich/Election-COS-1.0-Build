/**
 * Election Campaign OS — "Today", the phone home screen (pure parts)
 *
 * Rebuilt from the supplied ElectionCOS Mobile prototype, keeping its layout and dropping what it could not support:
 *
 *  - Seats are the CERTIFIED 2026 result for the tenant's own council (`modules/lge2026`), not the prototype's Wikipedia
 *    summary, and work for any of the 213 councils, not only JB Marks.
 *  - Parties are drawn in the fixed chart series (`viz-1`..`viz-6`, then slate), never a party's brand colour
 *    (design protocol §5), and every mark is labelled.
 *  - "Wards to watch" is the person's own ward when their role is ward- or district-scoped, otherwise the closest 2026
 *    races by margin. The prototype's ward profiles, turnout "'24" and strategy labels were unverified estimates and are
 *    not used; neither is its invented "service risk" card.
 *  - What the person can do comes from their capabilities. There is no role switcher: the prototype's "preview as" was a
 *    preview only, and here the role is the one the server put on the token.
 */
import type { Capability } from '@/auth/types';
import type { SessionContext } from '@/dal/ports/session';
import type { CouncilHolder } from '@/modules/lge2026/councilResults';
import type { WardLine } from '@/modules/lge2026/voterIntelligence';

/** Series slots for the six largest holders; the rest share 'other'. */
export const SERIES = ['viz-1', 'viz-2', 'viz-3', 'viz-4', 'viz-5', 'viz-6'] as const;
export type SeriesSlot = (typeof SERIES)[number] | 'other';

export interface SeatDot {
  cx: number;
  cy: number;
  holderId: string;
  slot: SeriesSlot;
}

export interface HolderKey {
  id: string;
  name: string;
  seats: number;
  slot: SeriesSlot;
}

/** Holders largest first, each with its series slot. Ties keep the order the results give. */
export function holderKey(holders: CouncilHolder[]): HolderKey[] {
  return [...holders]
    .filter((h) => h.seats > 0)
    .sort((a, b) => b.seats - a.seats)
    .map((h, i) => ({ id: h.id, name: h.name, seats: h.seats, slot: i < SERIES.length ? SERIES[i] : 'other' }));
}

/**
 * A parliament chart: one dot per seat on concentric half-rings, filled left to right in holder order, so a party's seats
 * sit together. Coordinates are in a 300 x 160 box with the centre at (150, 148).
 */
export function seatDots(holders: CouncilHolder[]): SeatDot[] {
  const key = holderKey(holders);
  const total = key.reduce((n, h) => n + h.seats, 0);
  if (total === 0) return [];
  const rings = total <= 30 ? 3 : total <= 80 ? 5 : total <= 150 ? 7 : 9;
  const inner = 62;
  const outer = 136;
  const radii = Array.from({ length: rings }, (_, i) => inner + ((outer - inner) * i) / Math.max(1, rings - 1));
  const sum = radii.reduce((a, b) => a + b, 0);
  const counts = radii.map((r) => Math.round((total * r) / sum));
  counts[counts.length - 1] += total - counts.reduce((a, b) => a + b, 0);
  const points: Array<{ angle: number; cx: number; cy: number }> = [];
  radii.forEach((r, i) => {
    const n = counts[i];
    for (let k = 0; k < n; k++) {
      const angle = Math.PI * (1 - (n === 1 ? 0.5 : k / (n - 1)));
      points.push({ angle, cx: 150 + r * Math.cos(angle), cy: 148 - r * Math.sin(angle) });
    }
  });
  points.sort((a, b) => b.angle - a.angle);
  const owners = key.flatMap((h) => Array.from({ length: h.seats }, () => h));
  return points.map((p, i) => ({
    cx: Math.round(p.cx * 10) / 10,
    cy: Math.round(p.cy * 10) / 10,
    holderId: owners[i].id,
    slot: owners[i].slot,
  }));
}

/** The ward number in a ward scope, which the build stores as `NW405-W12` or `NW405012`. Null when there is none. */
export function scopedWardNumber(session: Pick<SessionContext, 'wardScope'>, councilCode: string): number | null {
  const scope = session.wardScope?.trim();
  if (!scope) return null;
  const rest = scope.toUpperCase().startsWith(councilCode.toUpperCase()) ? scope.slice(councilCode.length) : scope;
  const m = rest.match(/(\d{1,3})\s*$/);
  return m ? Number(m[1]) : null;
}

export interface WardsToWatch {
  heading: string;
  wards: WardLine[];
  /** True when these are the person's own ward(s), not the council's closest races. */
  own: boolean;
}

/** The person's own ward when scoped to one; otherwise the `limit` closest 2026 races in the council. */
export function wardsToWatch(
  wards: WardLine[],
  session: Pick<SessionContext, 'geoScope' | 'wardScope'>,
  councilCode: string,
  limit = 3,
): WardsToWatch {
  const mine = session.geoScope === 'WARD' || session.geoScope === 'VD' ? scopedWardNumber(session, councilCode) : null;
  if (mine !== null) {
    const own = wards.filter((w) => w.ward === mine);
    if (own.length) return { heading: 'Your Ward', wards: own, own: true };
  }
  return {
    heading: 'Closest 2026 Races',
    wards: [...wards].sort((a, b) => a.margin - b.margin || a.ward - b.ward).slice(0, limit),
    own: false,
  };
}

export interface FieldAction {
  label: string;
  route: string;
  primary: boolean;
}

/** The shortcuts on Today, in order, from what the role may actually do. */
export function fieldActions(caps: Capability[]): FieldAction[] {
  const out: FieldAction[] = [];
  if (caps.includes('voters.edit')) out.push({ label: 'Start a round', route: '/round', primary: true });
  else if (caps.includes('voters.view')) out.push({ label: 'See the round', route: '/round', primary: true });
  if (caps.includes('roll.capture')) out.push({ label: 'Verify on the roll', route: '/roll', primary: false });
  if (caps.includes('incidents.create')) out.push({ label: 'Report an incident', route: '/incidents/new', primary: false });
  if (caps.includes('diary.edit')) out.push({ label: 'Write in the field diary', route: '/diary', primary: false });
  if (caps.includes('analytics.view'))
    out.push({ label: 'Full council intelligence', route: '/analytics/voter-intelligence', primary: false });
  return out;
}
