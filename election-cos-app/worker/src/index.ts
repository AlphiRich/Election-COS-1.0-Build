/**
 * Election Campaign OS — claims API (Cloudflare Worker)
 *
 * Adapted from a supplied Spark-plan build. Cloud Functions need the paid
 * Blaze plan; `resolveCapabilities` is a Firestore-trigger Function, so
 * without it nobody ever receives the `tenantId` / `caps` claims every
 * rule and every screen depends on. This Worker does the same job on
 * request, on Cloudflare's free tier, so the app can run with no Google
 * billing account. When Blaze is switched on, the Function can replace it
 * and this can be removed: the claims it writes are identical.
 *
 * Routes (same origin as the app, under /api, so no CORS):
 *   GET  /api/health          liveness
 *   POST /api/claims/refresh  resolve caps from tenants/{tid}/staff/{uid} → custom claims
 *   POST /api/bootstrap       first-owner tenant setup (OWNER_EMAILS only)
 *
 * WHAT THE CLIENT MAY SAY
 * Only which tenant it wants a session for. It never supplies capabilities:
 * the Worker reads the authoritative staff record itself. A user with no
 * active staff record gets their claims stripped, not a default.
 *
 * WHAT WAS CUT FROM THE SUPPLIED VERSION
 * The `/api/sync` and `/api/candidates/unmask` routes, which were 501 stubs
 * for functions that this build already implements or has deliberately not
 * enabled. A stub that answers on a real URL is a route someone will
 * eventually trust.
 *
 * THE CREDENTIAL, PLAINLY
 * `FIREBASE_SERVICE_ACCOUNT` is a service-account key held as a Worker
 * secret. Whoever can read it can act as that account. Create a dedicated
 * account with only "Cloud Datastore User" and "Firebase Authentication
 * Admin"; do not use the default Admin SDK account. See
 * docs/hosting-and-domain-estate.md.
 */
import { createRemoteJWKSet, jwtVerify, SignJWT, importPKCS8, type JWTPayload } from 'jose';
import { SEED_ROLES } from '../../src/auth/seedRoles';

// Minimal Workers types, so this package needs no extra type dependency.
interface Fetcher {
  fetch(req: Request): Promise<Response>;
}

export interface Env {
  /** Present only when the Worker also serves the static app; absent in route mode. */
  ASSETS?: Fetcher;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_SERVICE_ACCOUNT: string; // secret: full service-account JSON
  OWNER_EMAILS: string; // comma-separated emails allowed to bootstrap a tenant
}

type Json = Record<string, unknown>;
type Caps = string[];

const TENANT_ID_RE = /^[a-z0-9][a-z0-9-]{2,62}$/;

// ---------------------------------------------------------------- helpers

const json = (body: unknown, status = 200, extra: HeadersInit = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extra,
    },
  });

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function readJson(req: Request, maxBytes = 64 * 1024): Promise<Json> {
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, 'Request body too large');
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Json;
  } catch {
    /* fall through */
  }
  throw new HttpError(400, 'Body must be a JSON object');
}

// ------------------------------------------------- Firebase ID token check

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

interface FirebaseToken extends JWTPayload {
  uid: string;
  email?: string;
  email_verified?: boolean;
  tenantId?: string;
  caps?: Caps;
}

async function verifyIdToken(req: Request, env: Env): Promise<FirebaseToken> {
  const header = req.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw new HttpError(401, 'Missing Firebase ID token');
  jwks ??= createRemoteJWKSet(
    new URL(
      'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
    ),
  );
  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`,
      audience: env.FIREBASE_PROJECT_ID,
      algorithms: ['RS256'],
    });
    if (!payload.sub) throw new Error('no sub');
    return { ...payload, uid: payload.sub } as FirebaseToken;
  } catch {
    throw new HttpError(401, 'Invalid or expired Firebase ID token');
  }
}

// -------------------------------------------- Google OAuth (service account)

let cachedAccess: { token: string; exp: number } | null = null;

async function googleAccessToken(env: Env): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccess && cachedAccess.exp - 60 > now) return cachedAccess.token;
  if (!env.FIREBASE_SERVICE_ACCOUNT)
    throw new HttpError(503, 'Server not configured (service account secret missing)');
  const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT) as {
    client_email: string;
    private_key: string;
  };
  const key = await importPKCS8(sa.private_key, 'RS256');
  const assertion = await new SignJWT({
    scope: [
      'https://www.googleapis.com/auth/datastore',
      'https://www.googleapis.com/auth/identitytoolkit',
      'https://www.googleapis.com/auth/cloud-platform',
    ].join(' '),
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(sa.client_email)
    .setSubject(sa.client_email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!res.ok) throw new HttpError(502, `Google token exchange failed (${res.status})`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedAccess = { token: data.access_token, exp: now + data.expires_in };
  return data.access_token;
}

// ------------------------------------------------ Firestore REST (minimal)

type FsValue =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { stringValue: string }
  | { timestampValue: string }
  | { arrayValue: { values?: FsValue[] } }
  | { mapValue: { fields?: Record<string, FsValue> } };

export function toFs(v: unknown): FsValue {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number')
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFs) } };
  if (typeof v === 'object') {
    const fields: Record<string, FsValue> = {};
    for (const [k, val] of Object.entries(v as Json)) if (val !== undefined) fields[k] = toFs(val);
    return { mapValue: { fields } };
  }
  throw new Error(`Unsupported value type: ${typeof v}`);
}

export function fromFs(v: FsValue | undefined): unknown {
  if (!v) return undefined;
  if ('nullValue' in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('stringValue' in v) return v.stringValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(fromFs);
  if ('mapValue' in v) {
    const out: Json = {};
    for (const [k, val] of Object.entries(v.mapValue.fields ?? {})) out[k] = fromFs(val);
    return out;
  }
  return undefined;
}

const docsBase = (env: Env) =>
  `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;

async function fsGet(env: Env, path: string): Promise<Json | null> {
  const res = await fetch(`${docsBase(env)}/${path}`, {
    headers: { authorization: `Bearer ${await googleAccessToken(env)}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new HttpError(502, `Firestore read failed (${res.status})`);
  const doc = (await res.json()) as { fields?: Record<string, FsValue> };
  return fromFs({ mapValue: { fields: doc.fields ?? {} } }) as Json;
}

/** Create-only write (fails with 409 if the document exists). */
async function fsCreate(env: Env, path: string, data: Json): Promise<void> {
  const res = await fetch(`${docsBase(env)}/${path}?currentDocument.exists=false`, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${await googleAccessToken(env)}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      fields: (toFs(data) as { mapValue: { fields: Record<string, FsValue> } }).mapValue.fields,
    }),
  });
  if (res.status === 400 || res.status === 409)
    throw new HttpError(409, `Document already exists: ${path}`);
  if (!res.ok) throw new HttpError(502, `Firestore write failed (${res.status})`);
}

async function fsAdd(env: Env, collectionPath: string, data: Json): Promise<void> {
  const res = await fetch(`${docsBase(env)}/${collectionPath}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${await googleAccessToken(env)}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      fields: (toFs(data) as { mapValue: { fields: Record<string, FsValue> } }).mapValue.fields,
    }),
  });
  if (!res.ok) throw new HttpError(502, `Firestore append failed (${res.status})`);
}

// ------------------------------------------- custom claims (Identity Toolkit)

async function setCustomClaims(env: Env, uid: string, claims: Json | null): Promise<void> {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/accounts:update`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${await googleAccessToken(env)}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ localId: uid, customAttributes: JSON.stringify(claims ?? {}) }),
    },
  );
  if (!res.ok) throw new HttpError(502, `Setting custom claims failed (${res.status})`);
}

// --------------------------------------------- capability resolution (§4.4)

interface RoleDoc {
  defaultCaps: Caps;
  geoScope: string;
}
interface StaffDoc {
  roleId: string;
  active: boolean;
  wardScope?: string;
  vdScope?: string;
  capOverrides?: { granted?: Caps; revoked?: Caps };
}

/** (role.defaultCaps ∪ overrides.granted) \ overrides.revoked — same as src/auth/capabilities.ts */
export function resolveEffectiveCapabilities(
  role: Pick<RoleDoc, 'defaultCaps'>,
  overrides: StaffDoc['capOverrides'],
): Caps {
  const granted = new Set<string>([...(role.defaultCaps ?? []), ...(overrides?.granted ?? [])]);
  for (const r of overrides?.revoked ?? []) granted.delete(r);
  return [...granted].sort();
}

/** Tenant-customised role if one exists, else the seed role shipped with the app. */
async function loadRole(env: Env, tenantId: string, roleId: string): Promise<RoleDoc | null> {
  const custom = await fsGet(env, `tenants/${tenantId}/roles/${encodeURIComponent(roleId)}`);
  if (custom && Array.isArray(custom.defaultCaps)) {
    return {
      defaultCaps: custom.defaultCaps as Caps,
      geoScope: (custom.geoScope as string) ?? 'VD',
    };
  }
  const seed = SEED_ROLES.find((r) => r.id === roleId);
  return seed ? { defaultCaps: [...seed.defaultCaps], geoScope: seed.geoScope } : null;
}

async function applyClaims(env: Env, uid: string, tenantId: string): Promise<Json | null> {
  const staff = (await fsGet(env, `tenants/${tenantId}/staff/${uid}`)) as StaffDoc | null;
  if (!staff || staff.active !== true) {
    await setCustomClaims(env, uid, null); // strip stale access
    return null;
  }
  const role = await loadRole(env, tenantId, staff.roleId);
  if (!role) throw new HttpError(422, `Unknown role "${staff.roleId}"`);
  const claims = {
    tenantId,
    roleId: staff.roleId,
    caps: resolveEffectiveCapabilities(role, staff.capOverrides),
    geoScope: role.geoScope,
    ...(staff.wardScope ? { wardScope: staff.wardScope } : {}),
    ...(staff.vdScope ? { vdScope: staff.vdScope } : {}),
  };
  if (JSON.stringify(claims).length > 1000)
    throw new HttpError(422, 'Claims exceed Firebase 1000-byte limit');
  await setCustomClaims(env, uid, claims);
  return claims;
}

function requireTenantId(body: Json): string {
  const tid = body.tenantId;
  if (typeof tid !== 'string' || !TENANT_ID_RE.test(tid)) {
    throw new HttpError(400, 'tenantId must be 3–63 chars: lowercase letters, digits, hyphens');
  }
  return tid;
}

// ----------------------------------------------------------------- routes

async function handleApi(req: Request, env: Env, url: URL): Promise<Response> {
  const route = `${req.method} ${url.pathname}`;

  if (route === 'GET /api/health') {
    return json({ ok: true, service: 'election-cos-api', project: env.FIREBASE_PROJECT_ID });
  }

  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed');

  switch (url.pathname) {
    case '/api/claims/refresh': {
      const user = await verifyIdToken(req, env);
      const tenantId = requireTenantId(await readJson(req));
      const claims = await applyClaims(env, user.uid, tenantId);
      await fsAdd(env, `tenants/${tenantId}/auditLog`, {
        action: claims ? 'claims.refresh' : 'claims.revoke',
        actorUid: user.uid,
        at: new Date(),
        source: 'worker',
      }).catch(() => undefined); // audit is best-effort here; never block sign-in on it
      return json({ ok: true, active: !!claims, claims, refreshToken: true });
    }

    case '/api/bootstrap': {
      const user = await verifyIdToken(req, env);
      const owners = (env.OWNER_EMAILS ?? '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      if (!user.email || !user.email_verified || !owners.includes(user.email.toLowerCase())) {
        throw new HttpError(403, 'Only a configured owner account can bootstrap a tenant');
      }
      const body = await readJson(req);
      const tenantId = requireTenantId(body);
      const tenantName =
        typeof body.tenantName === 'string' ? body.tenantName.slice(0, 120) : tenantId;
      const now = new Date();
      await fsCreate(env, `tenants/${tenantId}/profile/main`, {
        tenantId,
        name: tenantName,
        createdAt: now,
        createdBy: user.uid,
      });
      await fsCreate(env, `tenants/${tenantId}/staff/${user.uid}`, {
        uid: user.uid,
        tenantId,
        firstName: '',
        lastName: '',
        phone: '',
        roleId: 'party-hq-admin',
        capOverrides: { granted: [], revoked: [] },
        active: true,
        createdAt: now,
      });
      const claims = await applyClaims(env, user.uid, tenantId);
      await fsAdd(env, `tenants/${tenantId}/auditLog`, {
        action: 'tenant.bootstrap',
        actorUid: user.uid,
        at: now,
        source: 'worker',
      }).catch(() => undefined);
      return json({ ok: true, tenantId, claims, refreshToken: true }, 201);
    }

    default:
      throw new HttpError(404, 'Not found');
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/')) {
      try {
        return await handleApi(req, env, url);
      } catch (err) {
        if (err instanceof HttpError) return json({ error: err.message }, err.status);
        console.error('Unhandled API error', err instanceof Error ? err.message : err);
        return json({ error: 'Internal error' }, 500);
      }
    }
    // Route mode: everything that is not /api/* belongs to the origin (Firebase Hosting).
    return env.ASSETS ? env.ASSETS.fetch(req) : fetch(req);
  },
};
