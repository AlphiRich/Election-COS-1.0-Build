/**
 * Election Campaign OS — cookieless page-view tally, client side
 *
 * Counts how many times each screen is opened and sends the counts, never an address and never
 * anything about the person (functions/src/pageViews.ts has the full account and the rules).
 *
 * The tally lives in memory only: no cookie, no localStorage, no identifier. Closing the tab with
 * unsent counts loses them, which is the price of keeping nothing on the device; the flush on
 * `pagehide` makes that rare.
 *
 * A screen is recorded as its route PATTERN. `routePattern` puts each URL parameter back as its
 * `:name`, so `/wards/NW405-W1` is recorded as `/wards/:wardCode`. The query string and hash are
 * never read.
 */
import { useEffect, useRef } from 'react';
import { useLocation, useMatches } from 'react-router-dom';
import { dal } from '@/dal';
import type { SessionContext } from '@/dal';
import type { PageViewCounts } from '@/dal/ports/pageViews';

/** Send when this many views are waiting. */
export const FLUSH_AT_VIEWS = 20;
/** Otherwise send this often while the app is open. */
export const FLUSH_EVERY_MS = 5 * 60 * 1000;
/** Most kept while sends fail (offline in the field); the server refuses more than 200 in one call. */
export const MAX_PENDING_VIEWS = 200;

/** The route pattern for a matched address, from the router's own params. */
export function routePattern(pathname: string, params: Record<string, string | undefined>): string {
  const byValue = new Map<string, string>();
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && name !== '*') byValue.set(value, name);
  }
  const segments = pathname.split('/').map((segment) => {
    let decoded = segment;
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      // keep the raw segment
    }
    const name = byValue.get(decoded);
    return name ? `:${name}` : segment;
  });
  const pattern = segments.join('/').replace(/\/+$/, '');
  return pattern || '/';
}

export interface PageViewTally {
  record(pattern: string): void;
  flush(): Promise<void>;
  pending(): number;
}

export function createPageViewTally(send: (counts: PageViewCounts) => Promise<void>): PageViewTally {
  let counts: PageViewCounts = {};
  let waiting = 0;
  let sending: Promise<void> | null = null;

  const add = (more: PageViewCounts) => {
    for (const [pattern, n] of Object.entries(more)) {
      if (waiting + n > MAX_PENDING_VIEWS) break;
      counts[pattern] = (counts[pattern] ?? 0) + n;
      waiting += n;
    }
  };

  const tally: PageViewTally = {
    record(pattern) {
      add({ [pattern]: 1 });
      if (waiting >= FLUSH_AT_VIEWS) void tally.flush();
    },
    async flush() {
      if (sending || waiting === 0) return sending ?? undefined;
      const batch = counts;
      counts = {};
      waiting = 0;
      sending = send(batch)
        .catch(() => add(batch)) // offline or refused: keep them for the next try
        .finally(() => {
          sending = null;
        });
      return sending;
    },
    pending: () => waiting,
  };
  return tally;
}

/**
 * Records the current screen while `session` is set, and sends on a timer, when the tab is hidden
 * and when the page is closed. Call it unconditionally from the Shell (rules of hooks); it does
 * nothing until there is a session.
 */
export function usePageViews(session: SessionContext | null): void {
  const location = useLocation();
  const matches = useMatches();
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const tallyRef = useRef<PageViewTally | null>(null);
  tallyRef.current ??= createPageViewTally(async (counts) => {
    const ctx = sessionRef.current;
    if (!ctx) throw new Error('signed out');
    await dal.pageViews.record(ctx, counts);
  });

  const leaf = matches[matches.length - 1];
  const pattern = leaf ? routePattern(leaf.pathname, leaf.params) : null;
  // A boolean, not the session object: a token refresh replaces the object and must not count a
  // view or restart the timer.
  const signedIn = session !== null;

  useEffect(() => {
    if (signedIn && pattern && pattern !== '/') tallyRef.current!.record(pattern);
    // location.key: opening the same screen again counts again.
  }, [location.key, pattern, signedIn]);

  useEffect(() => {
    if (!signedIn) return;
    const tally = tallyRef.current!;
    const flush = () => void tally.flush();
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    const timer = window.setInterval(flush, FLUSH_EVERY_MS);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [signedIn]);
}
