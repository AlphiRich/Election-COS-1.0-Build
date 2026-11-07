import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { SignJWT, exportJWK, exportPKCS8, generateKeyPair } from 'jose';
import worker, { fromFs, resolveEffectiveCapabilities, toFs, type Env } from './index';
import { SEED_ROLES } from '../../src/auth/seedRoles';
import { resolveEffectiveCapabilities as appResolver } from '../../src/auth/capabilities';

describe('resolveEffectiveCapabilities', () => {
  it('unions role defaults with grants and removes revocations', () => {
    expect(
      resolveEffectiveCapabilities({ defaultCaps: ['a', 'b'] }, { granted: ['c'], revoked: ['a'] }),
    ).toEqual(['b', 'c']);
  });
  it('lets a revocation win over a grant of the same capability', () => {
    expect(
      resolveEffectiveCapabilities({ defaultCaps: [] }, { granted: ['x'], revoked: ['x'] }),
    ).toEqual([]);
  });
  it('matches the app-side resolver for every seed role', () => {
    for (const role of SEED_ROLES) {
      const overrides = {
        granted: ['voters.export'] as never[],
        revoked: [role.defaultCaps[0]] as never[],
      };
      expect(resolveEffectiveCapabilities(role, overrides)).toEqual(
        [...appResolver(role, overrides as never)].sort(),
      );
    }
  });
  it('keeps every seed role, with the roll capabilities, inside the 1000-byte claims limit', () => {
    for (const role of SEED_ROLES) {
      const claims = {
        tenantId: 'a-tenant-id-of-reasonable-length',
        roleId: role.id,
        caps: resolveEffectiveCapabilities(role, { granted: [], revoked: [] }),
        geoScope: role.geoScope,
        wardScope: 'NW405-W31',
        vdScope: '86999001',
      };
      expect(JSON.stringify(claims).length, role.id).toBeLessThan(1000);
    }
  });
});

describe('Firestore value conversion', () => {
  it('round-trips nested data', () => {
    const data = { s: 'x', n: 3, d: 1.5, b: true, z: null, arr: [1, 'two'], m: { k: ['v'] } };
    expect(fromFs(toFs(data))).toEqual(data);
  });
});

// ---- the handler, against a faked Google -------------------------------------------------

const PROJECT = 'demo-ecos';
let idKey: CryptoKey;
let jwk: Record<string, unknown>;
let saPem: string;
const written: { path: string; body: unknown }[] = [];
let claimsSet: { localId: string; attrs: Record<string, unknown> }[] = [];
let docs: Record<string, unknown> = {};

const env = (over: Partial<Env> = {}): Env => ({
  FIREBASE_PROJECT_ID: PROJECT,
  FIREBASE_SERVICE_ACCOUNT: JSON.stringify({ client_email: 'sa@x.iam', private_key: saPem }),
  OWNER_EMAILS: 'owner@example.org',
  ...over,
});

async function idToken(uid: string, email = 'u@example.org', verified = true) {
  return new SignJWT({ email, email_verified: verified })
    .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
    .setIssuer(`https://securetoken.google.com/${PROJECT}`)
    .setAudience(PROJECT)
    .setSubject(uid)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(idKey);
}

const fs = (o: Record<string, unknown>) => ({
  fields: (toFs(o) as { mapValue: { fields: unknown } }).mapValue.fields,
});

function fakeGoogle() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const parsedUrl = new URL(url);
      if (
        parsedUrl.hostname === 'www.googleapis.com' &&
        parsedUrl.pathname ===
          '/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
      )
        return Response.json({ keys: [{ ...jwk, kid: 'k1', alg: 'RS256', use: 'sig' }] });
      if (
        parsedUrl.hostname === 'oauth2.googleapis.com' &&
        parsedUrl.pathname === '/token'
      )
        return Response.json({ access_token: 'at', expires_in: 3600 });
      if (
        parsedUrl.hostname === 'identitytoolkit.googleapis.com' &&
        parsedUrl.pathname.endsWith('/accounts:update')
      ) {
        const b = JSON.parse(String(init?.body));
        claimsSet.push({ localId: b.localId, attrs: JSON.parse(b.customAttributes) });
        return Response.json({});
      }
      if (parsedUrl.hostname === 'firestore.googleapis.com') {
        const path = url.split('/documents/')[1]!.split('?')[0]!;
        if (init?.method === 'PATCH' || init?.method === 'POST') {
          if (init.method === 'PATCH' && path in docs) return new Response('{}', { status: 409 });
          written.push({ path, body: JSON.parse(String(init.body)) });
          if (init.method === 'PATCH') docs[path] = JSON.parse(String(init.body));
          return Response.json({});
        }
        return path in docs ? Response.json(docs[path]) : new Response('{}', { status: 404 });
      }
      throw new Error(`unexpected fetch ${url}`);
    }),
  );
}

beforeAll(async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256', { extractable: true });
  idKey = privateKey;
  jwk = (await exportJWK(publicKey)) as Record<string, unknown>;
  const sa = await generateKeyPair('RS256', { extractable: true });
  saPem = await exportPKCS8(sa.privateKey);
});
afterEach(() => {
  vi.unstubAllGlobals();
  written.length = 0;
  claimsSet = [];
  docs = {};
});

const call = async (path: string, body: unknown, token?: string, e: Env = env(), method = 'POST') =>
  worker.fetch(
    new Request(`https://app.example.test${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: method === 'POST' ? JSON.stringify(body) : undefined,
    }),
    e,
  );

describe('the claims API', () => {
  it('answers health without credentials', async () => {
    fakeGoogle();
    expect((await call('/api/health', null, undefined, env(), 'GET')).status).toBe(200);
  });

  it('refuses a request with no token, or a token for another project', async () => {
    fakeGoogle();
    expect((await call('/api/claims/refresh', { tenantId: 'tenant-one' })).status).toBe(401);
    const wrong = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setIssuer('https://securetoken.google.com/other')
      .setAudience('other')
      .setSubject('u1')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(idKey);
    expect((await call('/api/claims/refresh', { tenantId: 'tenant-one' }, wrong)).status).toBe(401);
  });

  it('stamps the claims the rules read, from the staff record and never from the request', async () => {
    fakeGoogle();
    docs['tenants/tenant-one/staff/u1'] = fs({
      roleId: 'canvasser',
      active: true,
      wardScope: 'NW405-W31',
      vdScope: '86999001',
      capOverrides: { granted: [], revoked: [] },
    });
    const r = await call(
      '/api/claims/refresh',
      { tenantId: 'tenant-one', caps: ['team.manage'], geoScope: 'TENANT' },
      await idToken('u1'),
    );
    expect(r.status).toBe(200);
    const set = claimsSet[0]!;
    expect(set.localId).toBe('u1');
    expect(set.attrs).toMatchObject({
      tenantId: 'tenant-one',
      roleId: 'canvasser',
      geoScope: 'VD',
      wardScope: 'NW405-W31',
      vdScope: '86999001',
    });
    expect(set.attrs.caps).toContain('roll.capture');
    expect(set.attrs.caps).not.toContain('team.manage'); // the request's claim was ignored
  });

  it('strips claims for someone with no active staff record', async () => {
    fakeGoogle();
    const r = await call('/api/claims/refresh', { tenantId: 'tenant-one' }, await idToken('u2'));
    expect(((await r.json()) as { active: boolean }).active).toBe(false);
    expect(claimsSet[0]!.attrs).toEqual({});
    docs['tenants/tenant-one/staff/u3'] = fs({ roleId: 'canvasser', active: false });
    await call('/api/claims/refresh', { tenantId: 'tenant-one' }, await idToken('u3'));
    expect(claimsSet[1]!.attrs).toEqual({});
  });

  it('rejects a malformed tenant id and an unknown role', async () => {
    fakeGoogle();
    expect(
      (await call('/api/claims/refresh', { tenantId: '../x' }, await idToken('u1'))).status,
    ).toBe(400);
    docs['tenants/tenant-one/staff/u4'] = fs({ roleId: 'wizard', active: true });
    expect(
      (await call('/api/claims/refresh', { tenantId: 'tenant-one' }, await idToken('u4'))).status,
    ).toBe(422);
  });

  it('lets only a verified owner email bootstrap a tenant, once', async () => {
    fakeGoogle();
    expect(
      (
        await call(
          '/api/bootstrap',
          { tenantId: 'tenant-one' },
          await idToken('u5', 'stranger@example.org'),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await call(
          '/api/bootstrap',
          { tenantId: 'tenant-one' },
          await idToken('u5', 'owner@example.org', false),
        )
      ).status,
    ).toBe(403);
    const ok = await call(
      '/api/bootstrap',
      { tenantId: 'tenant-one', tenantName: 'Pilot' },
      await idToken('u5', 'Owner@Example.org'),
    );
    expect(ok.status).toBe(201);
    expect(docs['tenants/tenant-one/staff/u5']).toBeDefined();
    expect(claimsSet.at(-1)!.attrs).toMatchObject({
      tenantId: 'tenant-one',
      roleId: 'party-hq-admin',
      geoScope: 'TENANT',
    });
    expect(
      (
        await call(
          '/api/bootstrap',
          { tenantId: 'tenant-one' },
          await idToken('u5', 'owner@example.org'),
        )
      ).status,
    ).toBe(409);
  });

  it('with no owner list configured, nobody can bootstrap', async () => {
    fakeGoogle();
    const r = await call(
      '/api/bootstrap',
      { tenantId: 'tenant-two' },
      await idToken('u6', 'owner@example.org'),
      env({ OWNER_EMAILS: '' }),
    );
    expect(r.status).toBe(403);
  });

  it('leaves every non-API path to the origin (route mode)', async () => {
    const origin = vi.fn(async () => new Response('app shell', { status: 200 }));
    vi.stubGlobal('fetch', origin);
    const r = await worker.fetch(new Request('https://app.example.test/voters'), env());
    expect(await r.text()).toBe('app shell');
    expect(origin).toHaveBeenCalledTimes(1);
  });
});
