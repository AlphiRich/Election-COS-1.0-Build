/**
 * Election Campaign OS — client for the claims Worker (worker/src/index.ts)
 *
 * Used only when the deployment has no Cloud Functions (Firebase Spark
 * plan): `resolveCapabilities` is a Firestore trigger and needs Blaze, so
 * on Spark nobody would ever be stamped with `tenantId` / `caps`. Switched
 * on by `VITE_CLAIMS_WORKER=true`; off by default, so a Blaze deployment
 * keeps using the Function and this does nothing.
 *
 * The client names a tenant; it never supplies capabilities. If the person
 * has no active staff record the Worker strips their claims, and the app
 * shows "Awaiting access" as it does today.
 *
 * The tenant comes from `VITE_DEFAULT_TENANT_ID`. There is no built-in
 * default, because a tenant id baked into source is a customer's name in
 * the repository. With it unset, nothing is requested.
 */
import type { User } from 'firebase/auth';

export interface ClaimsEnv {
  VITE_CLAIMS_WORKER?: string;
  VITE_DEFAULT_TENANT_ID?: string;
  VITE_DEFAULT_TENANT_NAME?: string;
}

export function claimsWorkerConfig(
  env: ClaimsEnv,
): { tenantId: string; tenantName: string } | null {
  if (env.VITE_CLAIMS_WORKER !== 'true') return null;
  const tenantId = env.VITE_DEFAULT_TENANT_ID?.trim();
  if (!tenantId || !/^[a-z0-9][a-z0-9-]{2,62}$/.test(tenantId)) return null;
  return { tenantId, tenantName: env.VITE_DEFAULT_TENANT_NAME?.trim() || tenantId };
}

async function post(path: string, user: User, body: unknown, f: typeof fetch): Promise<Response> {
  const token = await user.getIdToken();
  return f(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

/**
 * Ask for claims; if there is no staff record, try the owner bootstrap (the
 * Worker refuses unless the verified email is a configured owner). Returns
 * true when the token should be refreshed to pick up new claims.
 */
export async function ensureTenantClaims(
  user: User,
  cfg: { tenantId: string; tenantName: string },
  f: typeof fetch = fetch,
): Promise<boolean> {
  try {
    const res = await post('/api/claims/refresh', user, { tenantId: cfg.tenantId }, f);
    if (!res.ok) return false;
    const data = (await res.json()) as { active?: boolean };
    if (!data.active) {
      const boot = await post(
        '/api/bootstrap',
        user,
        { tenantId: cfg.tenantId, tenantName: cfg.tenantName },
        f,
      );
      if (!boot.ok) return false; // 403 for non-owners, 409 if the tenant exists
    }
    return true;
  } catch {
    return false; // offline or Worker unreachable: the app shows "Awaiting access"
  }
}
