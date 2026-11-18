import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { RouteObject } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { FLUSH_AT_VIEWS, MAX_PENDING_VIEWS, createPageViewTally, routePattern } from './pageViews';
import { router } from './routes';

/** Every route pattern in the app's table, as the Shell would record it. */
function patterns(routes: RouteObject[], parent = ''): string[] {
  return routes.flatMap((r) => {
    const here = r.index ? parent : r.path ? `${parent}/${r.path}`.replace(/\/+/g, '/') : parent;
    const own = r.element && here && here !== '/' && (r.index || !r.children) ? [here] : [];
    return [...own, ...(r.children ? patterns(r.children, here === '/' ? '' : here) : [])];
  });
}

/** `PAGE_VIEW_ROUTES` as written in the functions package (no shared workspace; read the file). */
function serverRoutes(): string[] {
  const src = readFileSync(path.resolve(__dirname, '../../functions/src/pageViews.ts'), 'utf-8');
  const start = src.indexOf('export const PAGE_VIEW_ROUTES');
  const list = src.slice(src.indexOf('[', start), src.indexOf('];', start));
  return [...list.matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

describe('the server’s list of screens', () => {
  it('is exactly the app’s route table — add a new screen to functions/src/pageViews.ts too', () => {
    expect([...serverRoutes()].sort()).toEqual([...new Set(patterns(router.routes))].sort());
  });
});

describe('routePattern', () => {
  it('records a ward page as its pattern, never the ward code', () => {
    expect(routePattern('/wards/NW405-W1', { wardCode: 'NW405-W1' })).toBe('/wards/:wardCode');
  });

  it('matches an encoded parameter', () => {
    expect(routePattern('/wards/NW405%20W1', { wardCode: 'NW405 W1' })).toBe('/wards/:wardCode');
  });

  it('leaves fixed screens as they are and drops a trailing slash', () => {
    expect(routePattern('/analytics/seat-calculator', {})).toBe('/analytics/seat-calculator');
    expect(routePattern('/analytics/', {})).toBe('/analytics');
  });
});

describe('createPageViewTally', () => {
  it('sends counts per pattern and nothing else', async () => {
    const send = vi.fn(async () => {});
    const tally = createPageViewTally(send);
    tally.record('/voters');
    tally.record('/voters');
    tally.record('/wards/:wardCode');
    await tally.flush();
    expect(send).toHaveBeenCalledWith({ '/voters': 2, '/wards/:wardCode': 1 });
    expect(tally.pending()).toBe(0);
  });

  it(`sends by itself at ${FLUSH_AT_VIEWS} views`, () => {
    const send = vi.fn(async () => {});
    const tally = createPageViewTally(send);
    for (let i = 0; i < FLUSH_AT_VIEWS; i++) tally.record('/war-room');
    expect(send).toHaveBeenCalledWith({ '/war-room': FLUSH_AT_VIEWS });
  });

  it('keeps the counts when a send fails, for the next try', async () => {
    const send = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    const tally = createPageViewTally(send);
    tally.record('/diary');
    await tally.flush();
    expect(tally.pending()).toBe(1);
    await tally.flush();
    expect(send).toHaveBeenLastCalledWith({ '/diary': 1 });
    expect(tally.pending()).toBe(0);
  });

  it(`holds at most ${MAX_PENDING_VIEWS} views while offline`, async () => {
    const send = vi.fn().mockRejectedValue(new Error('offline'));
    const tally = createPageViewTally(send);
    for (let i = 0; i < MAX_PENDING_VIEWS + 50; i++) tally.record('/round');
    await tally.flush();
    expect(tally.pending()).toBe(MAX_PENDING_VIEWS);
  });

  it('does not call the server when nothing was viewed', async () => {
    const send = vi.fn(async () => {});
    await createPageViewTally(send).flush();
    expect(send).not.toHaveBeenCalled();
  });
});
