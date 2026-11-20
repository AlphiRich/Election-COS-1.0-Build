/**
 * Election Campaign OS — cookieless page-view counts, server side
 *
 * @deployable yes
 *
 * The application's own usage figures: how many times each screen was opened, per tenant, per
 * day. Nothing else. This is the "cookieless analytics" item from the white paper, built
 * first-party instead of with a vendor, because every alternative breaks a rule already recorded:
 * Firebase/Google Analytics sets an identifier before consent and reports to Google (see the
 * Session 53 decision-log entry), a hosted script loads from a third party, and both process
 * outside africa-south1.
 *
 * WHAT IS STORED, AND WHAT IS NOT
 *
 *   tenants/{tenantId}/pageViewsDaily/{yyyy-mm-dd}
 *     { day, total, routes: { '/wards/:wardCode': 12, ... }, updatedAt }
 *
 * No uid, no IP, no user agent, no session or device identifier, and no cookie or storage on the
 * device. The browser keeps a tally in memory and sends counts; the counts are added to the day's
 * document and the request is forgotten. A route is its PATTERN from the router table, never the
 * address the person was on: `/wards/:wardCode`, not `/wards/NW405-W1`. Anything not in
 * `PAGE_VIEW_ROUTES` is dropped before the write, which is what stops a ward code, a voter id or
 * free text from ever being written as a key. Dropped rather than refused, so that a screen added
 * to the app before this function is redeployed costs only its own count, not everyone else's.
 *
 * `PAGE_VIEW_ROUTES` must equal the app's route table. `src/app/pageViews.test.ts` reads this file
 * and fails when they differ — the two packages share no workspace (same arrangement as
 * resolveCapabilities.ts and the role mirror).
 *
 * The day is South African (UTC+2, no daylight saving), so a day's figure matches the day the
 * campaign worked.
 */

/** Every screen of the application, as its route pattern. Mirrors src/app/routes.tsx. */
export const PAGE_VIEW_ROUTES: readonly string[] = [
  '/war-room',
  '/today',
  '/voters',
  '/voters/import',
  '/round',
  '/roll',
  '/incidents/new',
  '/incidents/report',
  '/wards',
  '/wards/:wardCode',
  '/diary',
  '/gatherings',
  '/incidents',
  '/logistics',
  '/finance',
  '/analytics',
  '/analytics/seat-calculator',
  '/analytics/thresholds',
  '/analytics/scheduled-reports',
  '/analytics/ward-comparison',
  '/analytics/scenario-runner',
  '/analytics/analyst',
  '/analytics/drill-down',
  '/analytics/hub',
  '/analytics/lge-2026-results',
  '/analytics/lge-2026-party',
  '/analytics/voter-intelligence',
  '/analytics/polls',
  '/analytics/candidate-list',
  '/analytics/vd-locator',
  '/analytics/voter-statistics',
  '/analytics/build-review',
  '/analytics/roll-segmentation',
  '/settings',
  '/settings/municipality',
  '/settings/permissions',
  '/settings/ppfa-thresholds',
  '/settings/data-requests',
  '/settings/candidates',
  '/settings/subscription',
  '/settings/roll-editions',
  '/settings/audit',
  '/knowledge/gatherings-advisory',
  '/knowledge/election-timetable',
  '/knowledge/councillors-and-electoral-law',
];

const KNOWN = new Set(PAGE_VIEW_ROUTES);

/**
 * Most one call may add. A person cannot open 200 screens between two flushes (the client sends at
 * most every five minutes, or sooner at 20 views); a request above this is a script, and refusing it
 * keeps one account from inflating a tenant's figures.
 */
export const MAX_VIEWS_PER_CALL = 200;

export type PageViewCounts = Record<string, number>;

export class InvalidPageViews extends Error {}

/**
 * The counts as sent, checked. A malformed payload throws InvalidPageViews; a route that is not in
 * the table is dropped (see the header). The total limit counts dropped routes too.
 */
export function parsePageViewCounts(input: unknown): PageViewCounts {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new InvalidPageViews('counts must be an object of route to number');
  }
  const out: PageViewCounts = {};
  let total = 0;
  for (const [route, n] of Object.entries(input as Record<string, unknown>)) {
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 1) {
      throw new InvalidPageViews('each count must be a whole number above zero');
    }
    total += n;
    if (KNOWN.has(route)) out[route] = n;
  }
  if (total === 0) throw new InvalidPageViews('no views to record');
  if (total > MAX_VIEWS_PER_CALL) throw new InvalidPageViews(`more than ${MAX_VIEWS_PER_CALL} views in one call`);
  return out;
}

const SAST_OFFSET_MS = 2 * 60 * 60 * 1000;

/** The South African calendar day, `yyyy-mm-dd`. */
export function sastDay(nowMs: number): string {
  return new Date(nowMs + SAST_OFFSET_MS).toISOString().slice(0, 10);
}

export function pageViewsDocPath(tenantId: string, day: string): string {
  return `tenants/${tenantId}/pageViewsDaily/${day}`;
}

/** The seam the callable fills with Firestore and the tests fill with a map. */
export interface PageViewStore {
  add(path: string, day: string, counts: PageViewCounts, total: number): Promise<void>;
}

export async function recordPageViews(
  store: PageViewStore,
  tenantId: string,
  input: unknown,
  nowMs: number,
): Promise<{ recorded: number }> {
  const counts = parsePageViewCounts(input);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) return { recorded: 0 };
  const day = sastDay(nowMs);
  await store.add(pageViewsDocPath(tenantId, day), day, counts, total);
  return { recorded: total };
}
