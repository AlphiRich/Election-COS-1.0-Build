import { describe, expect, it } from 'vitest';
import {
  InvalidPageViews,
  MAX_VIEWS_PER_CALL,
  pageViewsDocPath,
  parsePageViewCounts,
  recordPageViews,
  sastDay,
  type PageViewCounts,
  type PageViewStore,
} from './pageViews';

function memoryStore() {
  const writes: { path: string; day: string; counts: PageViewCounts; total: number }[] = [];
  const store: PageViewStore = {
    async add(path, day, counts, total) {
      writes.push({ path, day, counts, total });
    },
  };
  return { store, writes };
}

describe('parsePageViewCounts', () => {
  it('accepts route patterns from the table', () => {
    expect(parsePageViewCounts({ '/war-room': 3, '/wards/:wardCode': 2 })).toEqual({
      '/war-room': 3,
      '/wards/:wardCode': 2,
    });
  });

  it('drops a real address, so a ward code can never become a key', () => {
    expect(parsePageViewCounts({ '/wards/NW405-W1': 1, '/wards/:wardCode': 1 })).toEqual({ '/wards/:wardCode': 1 });
  });

  it('drops query strings, free text and unknown screens', () => {
    for (const route of ['/voters?vd=86910587', 'hello', '/voters/', '/admin', '__proto__']) {
      expect(parsePageViewCounts({ [route]: 1 }), route).toEqual({});
    }
  });

  it('refuses counts that are not whole numbers above zero', () => {
    for (const n of [0, -1, 1.5, '2', null]) {
      expect(() => parsePageViewCounts({ '/voters': n }), String(n)).toThrow(InvalidPageViews);
    }
  });

  it('refuses an empty payload and anything that is not an object', () => {
    for (const input of [undefined, null, [], 'x', {}]) {
      expect(() => parsePageViewCounts(input), JSON.stringify(input)).toThrow(InvalidPageViews);
    }
  });

  it(`refuses more than ${MAX_VIEWS_PER_CALL} views in one call`, () => {
    expect(() => parsePageViewCounts({ '/voters': MAX_VIEWS_PER_CALL + 1 })).toThrow(InvalidPageViews);
    expect(parsePageViewCounts({ '/voters': MAX_VIEWS_PER_CALL })).toEqual({ '/voters': MAX_VIEWS_PER_CALL });
  });
});

describe('sastDay', () => {
  it('rolls over at midnight in South Africa, not UTC', () => {
    expect(sastDay(Date.parse('2026-11-04T21:59:59Z'))).toBe('2026-11-04');
    expect(sastDay(Date.parse('2026-11-04T22:00:00Z'))).toBe('2026-11-05');
  });
});

describe('recordPageViews', () => {
  it('writes counts to the tenant’s day document and nothing about the caller', async () => {
    const { store, writes } = memoryStore();
    const result = await recordPageViews(store, 'jbm-pilot', { '/voters': 2, '/war-room': 1 }, Date.parse('2026-11-18T08:00:00Z'));
    expect(result).toEqual({ recorded: 3 });
    expect(writes).toEqual([
      {
        path: pageViewsDocPath('jbm-pilot', '2026-11-18'),
        day: '2026-11-18',
        counts: { '/voters': 2, '/war-room': 1 },
        total: 3,
      },
    ]);
    expect(writes[0].path).toBe('tenants/jbm-pilot/pageViewsDaily/2026-11-18');
  });

  it('writes nothing when the payload is refused', async () => {
    const { store, writes } = memoryStore();
    await expect(recordPageViews(store, 't', { '/voters': -1 }, 0)).rejects.toThrow(InvalidPageViews);
    expect(writes).toEqual([]);
  });

  it('writes nothing when every route was dropped', async () => {
    const { store, writes } = memoryStore();
    expect(await recordPageViews(store, 't', { '/wards/NW405-W1': 3 }, 0)).toEqual({ recorded: 0 });
    expect(writes).toEqual([]);
  });
});
