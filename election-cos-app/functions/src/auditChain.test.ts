import { describe, expect, it } from 'vitest';
import { GENESIS, appendChained, chainHash, type ChainStore } from './auditChain';

function fakeStore() {
  const entries: Record<string, unknown>[] = [];
  let head: { seq: number; hash: string } | null = null;
  const store: ChainStore = {
    async runTransaction(fn) {
      return fn({
        getHead: async () => head,
        setHead: (_t, h) => (head = h),
        addEntry: (_t, e) => void entries.push(e),
      });
    },
  };
  return { store, entries };
}
const ev = (n: number) => ({ actorUid: 'u', action: `a${n}`, targetType: 't', targetId: `${n}` });

describe('appendChained', () => {
  it('links each entry to the one before and starts from genesis', async () => {
    const { store, entries } = fakeStore();
    const t = new Date('2026-11-01T10:00:00Z');
    await appendChained(store, 'ten', ev(1), t);
    await appendChained(store, 'ten', ev(2), t);
    expect(entries[0].prevHash).toBe(GENESIS);
    expect(entries[0].seq).toBe(1);
    expect(entries[1].prevHash).toBe(entries[0].hash);
    expect(entries[1].seq).toBe(2);
  });
  it('pins the canonical form (same fixture is pinned in the app project)', () => {
    expect(
      chainHash(GENESIS, {
        seq: 1,
        occurredAtIso: '2026-11-01T10:00:00.000Z',
        actorUid: 'u',
        action: 'a',
        targetType: 't',
        targetId: '1',
      }),
    ).toBe('d6b55c92b82212ed1f712f91e896e1969057b37dfd666bccac09b814ce594b43');
  });
});
