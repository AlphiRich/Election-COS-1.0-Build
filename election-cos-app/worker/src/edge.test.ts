import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  RATE,
  SYNC_MAX_BYTES,
  allow,
  gateSync,
  resetLimiter,
  scrubbedHeaders,
  withBaselineHeaders,
  type EdgeDeps,
} from './edge';

const req = (headers: Record<string, string> = {}, method = 'POST') =>
  new Request('https://app.example.test/api/sync', {
    method,
    headers,
    body: method === 'POST' ? '{}' : undefined,
  });

const deps = (over: Partial<EdgeDeps> = {}) => {
  const seen: Request[] = [];
  const d: EdgeDeps = {
    verify: async () => ({ uid: 'u1' }),
    forward: async (r) => (seen.push(r), new Response('ok')),
    now: () => 1_000_000,
    ...over,
  };
  return { d, seen };
};
beforeEach(resetLimiter);

describe('the edge gate for /api/sync', () => {
  it('turns away an unauthenticated request without calling the origin', async () => {
    const forward = vi.fn();
    const { d } = deps({
      verify: async () => {
        throw new Error('no');
      },
      forward,
    });
    expect((await gateSync(req(), d)).status).toBe(401);
    expect(forward).not.toHaveBeenCalled();
  });

  it('never trusts a tenant header: it is removed before the request goes on', async () => {
    const { d, seen } = deps();
    const res = await gateSync(
      req({ 'x-tenant-id': 'someone-elses', 'x-verified-uid': 'admin', authorization: 'Bearer t' }),
      d,
    );
    expect(res.status).toBe(200);
    expect(seen[0]!.headers.get('x-tenant-id')).toBeNull();
    expect(seen[0]!.headers.get('x-verified-uid')).toBeNull();
    expect(seen[0]!.headers.get('authorization')).toBe('Bearer t'); // the origin verifies the token itself
  });

  it('refuses non-POST and oversized batches', async () => {
    expect((await gateSync(req({}, 'GET'), deps().d)).status).toBe(405);
    expect(
      (await gateSync(req({ 'content-length': String(SYNC_MAX_BYTES + 1) }), deps().d)).status,
    ).toBe(413);
  });

  it('throttles one user without touching another, and tells them their work is safe', async () => {
    const { d } = deps();
    let last = 200;
    for (let i = 0; i < RATE.capacity + 3; i++) last = (await gateSync(req(), d)).status;
    expect(last).toBe(429);
    const limited = await gateSync(req(), d);
    expect(limited.headers.get('retry-after')).toBe('2');
    expect(await limited.text()).toMatch(/saved on your phone/);
    const other = deps({ verify: async () => ({ uid: 'u2' }) });
    expect((await gateSync(req(), other.d)).status).toBe(200);
  });

  it('refills over time', () => {
    for (let i = 0; i < RATE.capacity; i++) expect(allow('k', 0)).toBe(true);
    expect(allow('k', 0)).toBe(false);
    expect(allow('k', 2000)).toBe(true); // 2 s later, one token back
  });

  it('adds baseline headers only where the origin set none, and never a CSP', () => {
    const r = withBaselineHeaders(
      new Response('x', { headers: { 'referrer-policy': 'no-referrer' } }),
    );
    expect(r.headers.get('x-content-type-options')).toBe('nosniff');
    expect(r.headers.get('referrer-policy')).toBe('no-referrer');
    expect(r.headers.get('content-security-policy')).toBeNull();
    expect(scrubbedHeaders(new Headers({ 'X-Tenant-ID': 'a', Accept: 'x' })).get('accept')).toBe(
      'x',
    );
  });
});
