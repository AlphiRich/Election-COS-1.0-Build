/**
 * Election Campaign OS — page-view counts port
 *
 * The cookieless usage figures (functions/src/pageViews.ts has the full account). The client sends
 * counts per route pattern; the server adds them to the tenant's day document. Write-only from the
 * browser: the daily documents are read by `analytics.view` holders, and nothing about the person
 * who opened a screen is ever sent or stored.
 */
import type { SessionContext } from './session';

/** Route pattern (`/wards/:wardCode`) to number of times opened. */
export type PageViewCounts = Record<string, number>;

export interface PageViewsRepository {
  record(ctx: SessionContext, counts: PageViewCounts): Promise<void>;
}
