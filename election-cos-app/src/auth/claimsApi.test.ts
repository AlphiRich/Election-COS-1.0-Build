import { describe, expect, it, vi } from 'vitest';
import type { User } from 'firebase/auth';
import { claimsWorkerConfig, ensureTenantClaims } from './claimsApi';

const user = { getIdToken: async () => 'tok' } as unknown as User;
const cfg = { tenantId: 'tenant-one', tenantName: 'Tenant One' };
const reply = (...r: Array<{ status?: number; body?: unknown }>) => {
  const f = vi.fn();
  r.forEach((x) =>
    f.mockResolvedValueOnce(
      new Response(JSON.stringify(x.body ?? {}), { status: x.status ?? 200 }),
    ),
  );
  return f as unknown as typeof fetch & ReturnType<typeof vi.fn>;
};

describe('the claims Worker client', () => {
  it('is off unless explicitly switched on with a well-formed tenant id, and has no built-in tenant', () => {
    expect(claimsWorkerConfig({})).toBeNull();
    expect(claimsWorkerConfig({ VITE_CLAIMS_WORKER: 'true' })).toBeNull();
    expect(
      claimsWorkerConfig({ VITE_CLAIMS_WORKER: 'true', VITE_DEFAULT_TENANT_ID: '../x' }),
    ).toBeNull();
    expect(claimsWorkerConfig({ VITE_DEFAULT_TENANT_ID: 'tenant-one' })).toBeNull();
    expect(
      claimsWorkerConfig({ VITE_CLAIMS_WORKER: 'true', VITE_DEFAULT_TENANT_ID: 'tenant-one' }),
    ).toEqual({
      tenantId: 'tenant-one',
      tenantName: 'tenant-one',
    });
  });

  it('asks for claims, naming only the tenant, and asks for a token refresh when it got some', async () => {
    const f = reply({ body: { active: true } });
    expect(await ensureTenantClaims(user, cfg, f)).toBe(true);
    const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(url).toBe('/api/claims/refresh');
    expect(JSON.parse(init.body)).toEqual({ tenantId: 'tenant-one' });
    expect(init.headers.authorization).toBe('Bearer tok');
  });

  it('tries the owner bootstrap only when there is no staff record, and gives up quietly if refused', async () => {
    const f = reply({ body: { active: false } }, { status: 403 });
    expect(await ensureTenantClaims(user, cfg, f)).toBe(false);
    expect((f as unknown as ReturnType<typeof vi.fn>).mock.calls[1]![0]).toBe('/api/bootstrap');
    expect(
      await ensureTenantClaims(user, cfg, reply({ body: { active: false } }, { status: 201 })),
    ).toBe(true);
  });

  it('never throws when the Worker is unreachable', async () => {
    const down = vi.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;
    expect(await ensureTenantClaims(user, cfg, down)).toBe(false);
  });
});
