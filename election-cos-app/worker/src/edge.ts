/**
 * Election Campaign OS — edge gate for /api/sync (Cloudflare Worker)
 *
 * The supplied "edge security worker" took the tenant from an `X-Tenant-ID`
 * request header and forwarded it. A header the caller sets is not an
 * authority: any client could name another party's tenant. This gate does
 * the three jobs worth doing at the edge and none that need trusting the
 * client:
 *
 *   1. REQUIRE A VERIFIED FIREBASE ID TOKEN before the request goes any
 *      further, so unauthenticated floods are turned away at Cloudflare and
 *      never reach (or bill) the origin.
 *   2. THROTTLE per signed-in user, so one handset in a retry loop on a bad
 *      signal cannot spend the day's Worker and Firestore allowance for the
 *      whole field team. The limiter lives in the isolate's memory: it is
 *      best-effort, per Cloudflare location, and resets when the isolate
 *      does. The hard limits are Cloudflare's own rate-limiting rules, set
 *      in the dashboard (docs/hosting-and-domain-estate.md).
 *   3. SCRUB identity headers a client might send (`x-tenant-id`,
 *      `x-verified-*`) so nothing downstream can mistake them for ours, cap
 *      the body at the sync contract's 5 MB, and add the response headers
 *      the origin did not set. It never sets a Content-Security-Policy:
 *      the origin's (firebase.json) is stricter, and a second one that
 *      allowed 'unsafe-inline' would only be a way to weaken it.
 *
 * The tenant is never read here. The origin (the `sync` Function) takes it
 * from the token's claims and the rules compare it to the path.
 */
export const SYNC_MAX_BYTES = 5 * 1024 * 1024;
export const RATE = { capacity: 30, refillPerSecond: 0.5 }; // a burst of 30, then one every 2 s

interface Bucket {
  tokens: number;
  at: number;
}
const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5000;

/** Token bucket per key. Returns true if the request may proceed. */
export function allow(key: string, nowMs: number, rate = RATE): boolean {
  if (buckets.size > MAX_BUCKETS) buckets.clear(); // bounded memory; the dashboard rule is the real limit
  const b = buckets.get(key) ?? { tokens: rate.capacity, at: nowMs };
  b.tokens = Math.min(rate.capacity, b.tokens + ((nowMs - b.at) / 1000) * rate.refillPerSecond);
  b.at = nowMs;
  const ok = b.tokens >= 1;
  if (ok) b.tokens -= 1;
  buckets.set(key, b);
  return ok;
}

export function resetLimiter() {
  buckets.clear();
}

const SCRUB = /^(x-tenant-id|x-verified-.*|x-forwarded-user|x-auth-.*)$/i;

export function scrubbedHeaders(h: Headers): Headers {
  const out = new Headers();
  h.forEach((v, k) => {
    if (!SCRUB.test(k)) out.set(k, v);
  });
  return out;
}

export function withBaselineHeaders(res: Response): Response {
  const h = new Headers(res.headers);
  if (!h.has('x-content-type-options')) h.set('x-content-type-options', 'nosniff');
  if (!h.has('referrer-policy')) h.set('referrer-policy', 'same-origin');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

const deny = (status: number, error: string, extra: HeadersInit = {}) =>
  new Response(JSON.stringify({ error }), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extra,
    },
  });

export interface EdgeDeps {
  /** Verifies the bearer token; resolves the uid or throws. */
  verify: (req: Request) => Promise<{ uid: string }>;
  /** Forwards to the origin. */
  forward: (req: Request) => Promise<Response>;
  now: () => number;
}

export async function gateSync(req: Request, deps: EdgeDeps): Promise<Response> {
  if (req.method !== 'POST') return deny(405, 'Method not allowed', { allow: 'POST' });
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (declared > SYNC_MAX_BYTES)
    return deny(413, `Max ${SYNC_MAX_BYTES} bytes per batch: the client must chunk`);

  let uid: string;
  try {
    uid = (await deps.verify(req)).uid;
  } catch {
    return deny(401, 'Invalid or missing sign-in');
  }
  if (!allow(`sync:${uid}`, deps.now())) {
    return deny(
      429,
      'Too many sync requests. Wait a moment; your work is still saved on your phone.',
      {
        'retry-after': '2',
      },
    );
  }
  const clean = new Request(req, { headers: scrubbedHeaders(req.headers) });
  return withBaselineHeaders(await deps.forward(clean));
}
