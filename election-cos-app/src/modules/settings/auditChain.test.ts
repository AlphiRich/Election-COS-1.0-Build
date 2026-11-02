import { describe, expect, it } from 'vitest';
import { GENESIS, chainHash, verifyChain, type ChainedEntry } from './auditChain';

async function build(n: number): Promise<ChainedEntry[]> {
  const out: ChainedEntry[] = [];
  let prev = GENESIS;
  for (let i = 1; i <= n; i++) {
    const e = {
      seq: i,
      occurredAtIso: `2026-11-01T10:0${i}:00.000Z`,
      actorUid: 'u',
      action: `a${i}`,
      targetType: 't',
      targetId: `${i}`,
    };
    const hash = await chainHash(prev, e);
    out.push({ ...e, prevHash: prev, hash });
    prev = hash;
  }
  return out;
}

describe('verifyChain', () => {
  it('verifies an untouched chain', async () => {
    expect(await verifyChain(await build(4))).toEqual([
      'verified',
      'verified',
      'verified',
      'verified',
    ]);
  });
  it('flags an edited entry and everything after it breaks only where linkage fails', async () => {
    const c = await build(4);
    c[1] = { ...c[1], action: 'edited' };
    const r = await verifyChain(c);
    expect(r[0]).toBe('verified');
    expect(r[1]).toBe('BROKEN');
  });
  it('flags a removed entry', async () => {
    const c = await build(4);
    c.splice(1, 1);
    const r = await verifyChain(c);
    expect(r).toContain('BROKEN');
    expect(r[0]).toBe('verified');
  });
  it('reports entries from before the chain as not chained, not broken', async () => {
    const legacy: ChainedEntry = { actorUid: 'u', action: 'old', targetType: 't', targetId: '0' };
    expect(await verifyChain([legacy, ...(await build(2))])).toEqual([
      'not chained',
      'verified',
      'verified',
    ]);
  });
  it('pins the canonical form shared with the functions project', async () => {
    expect(
      await chainHash(GENESIS, {
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
