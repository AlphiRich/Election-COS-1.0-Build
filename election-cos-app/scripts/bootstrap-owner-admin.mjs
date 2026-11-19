#!/usr/bin/env node
/**
 * Election Campaign OS — one-time first-admin bootstrap (run by the OWNER).
 *
 * WHY THIS EXISTS
 * The app reads a user's role from custom claims (tenantId, caps, geoScope),
 * minted by the `resolveCapabilities` Cloud Function OR the Cloudflare Claims
 * Worker (worker/src/index.ts). When neither is deployed, no account ever
 * receives claims and every user sees "Awaiting access". This script does
 * exactly what the Worker's /api/bootstrap route does — create the tenant,
 * create the owner's staff record as party-hq-admin, and set the claims —
 * but as a ONE-OFF you run yourself, so you can sign in before the backend
 * is stood up. It is not a substitute for the Worker: new users still need
 * the Worker (or the Function) to be minted a role.
 *
 * HOW IT AUTHENTICATES
 * It uses `gcloud auth print-access-token` — i.e. YOUR identity in Cloud
 * Shell. No service-account key is created or stored. You must be a project
 * Owner (or hold Datastore User + Firebase Authentication Admin).
 *
 * RUN (in Cloud Shell on project electioncos1-0, which is already signed in):
 *   node scripts/bootstrap-owner-admin.mjs \
 *     --uid nGsTExXMeQgCchZSkqe3uhoTz6G3 \
 *     --tenant jb-marks --name "JB Marks"
 *
 * It is create-only for the tenant and staff docs (safe to re-run; an
 * existing doc is left alone), and it always (re)sets the claims. After it
 * runs, sign out and back in — or just reload — so the app picks up the new
 * token. Node 18+ (Cloud Shell has it); no npm install needed.
 */
import { execSync } from 'node:child_process';

// ---- args -----------------------------------------------------------------
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1]]);
    return acc;
  }, []),
);
const PROJECT = args.project || 'electioncos1-0';
const UID = args.uid;
const TENANT = args.tenant;
const NAME = args.name || TENANT;

const TENANT_RE = /^[a-z0-9][a-z0-9-]{2,62}$/;
if (!UID || !TENANT) {
  console.error('Usage: node scripts/bootstrap-owner-admin.mjs --uid <firebaseUid> --tenant <id> [--name "Tenant Name"] [--project electioncos1-0]');
  process.exit(2);
}
if (!TENANT_RE.test(TENANT)) {
  console.error(`--tenant must be 3–63 chars: lowercase letters, digits, hyphens (got "${TENANT}")`);
  process.exit(2);
}

// party-hq-admin default capabilities — a mirror of src/auth/seedRoles.ts
// (guarded by roleMirror.test.ts). If the role set changes, update this or
// use the Worker, which reads SEED_ROLES directly.
const HQ_ADMIN_CAPS = [
  'analytics.export', 'analytics.view', 'diary.view', 'dsr.manage', 'dsr.view',
  'incidents.escalate', 'incidents.triage', 'incidents.view',
  'logistics.approve', 'logistics.edit', 'logistics.view',
  'ppfa.manage_thresholds', 'ppfa.view',
  'roll.manage', 'roll.segment', 'roll.view',
  'settings.permissions', 'settings.tenant', 'team.manage',
  'voters.view', 'warroom.view', 'wards.edit', 'wards.view',
];

const token = execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
const auth = { authorization: `Bearer ${token}` };
const DOCS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

// ---- minimal Firestore typed-value encoding (same shape as the Worker) ----
function toFs(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFs) } };
  if (typeof v === 'object') {
    const fields = {};
    for (const [k, val] of Object.entries(v)) if (val !== undefined) fields[k] = toFs(val);
    return { mapValue: { fields } };
  }
  throw new Error(`Unsupported value type: ${typeof v}`);
}

async function createOnly(path, data) {
  const res = await fetch(`${DOCS}/${path}?currentDocument.exists=false`, {
    method: 'PATCH',
    headers: { ...auth, 'content-type': 'application/json' },
    body: JSON.stringify({ fields: toFs(data).mapValue.fields }),
  });
  if (res.status === 409 || res.status === 400) { console.log(`  • ${path} already exists — left as is`); return; }
  if (!res.ok) throw new Error(`Firestore write failed for ${path} (${res.status}): ${await res.text()}`);
  console.log(`  • created ${path}`);
}

async function setClaims(uid, claims) {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:update`, {
    method: 'POST',
    headers: { ...auth, 'content-type': 'application/json' },
    body: JSON.stringify({ localId: uid, customAttributes: JSON.stringify(claims) }),
  });
  if (!res.ok) throw new Error(`Setting custom claims failed (${res.status}): ${await res.text()}`);
}

// ---- run ------------------------------------------------------------------
const now = new Date();
console.log(`Bootstrapping owner admin on ${PROJECT}: tenant "${TENANT}", uid ${UID}`);

await createOnly(`tenants/${TENANT}/profile/main`, {
  tenantId: TENANT, name: NAME, createdAt: now, createdBy: UID,
});
await createOnly(`tenants/${TENANT}/staff/${UID}`, {
  uid: UID, tenantId: TENANT, firstName: '', lastName: '', phone: '',
  roleId: 'party-hq-admin', capOverrides: { granted: [], revoked: [] },
  active: true, createdAt: now,
});

// mfaRequired:false — the second sign-in factor (SMS/WhatsApp code) is not
// configured on this deployment, so requiring it would lock the owner out at
// an unpassable code screen (and firestore.rules mfaOK() would refuse data).
// This bypasses it for the bootstrap. Once the 2FA sender is wired, re-provision
// with mfaRequired:true (or let the Worker/Function manage claims) to enforce it.
const claims = { tenantId: TENANT, roleId: 'party-hq-admin', caps: HQ_ADMIN_CAPS, geoScope: 'TENANT', mfaRequired: false };
await setClaims(UID, claims);
console.log('  • custom claims set:', JSON.stringify({ tenantId: TENANT, roleId: 'party-hq-admin', geoScope: 'TENANT', mfaRequired: false, caps: `${HQ_ADMIN_CAPS.length} caps` }));

console.log('\n✅ Done. Sign out and back in to the app (or reload) to pick up the new token.');
console.log('   If "Awaiting access" persists, wait ~1 minute for the token to refresh, then reload.');
