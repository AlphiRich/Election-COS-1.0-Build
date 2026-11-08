// Proves firestore.rules' mfaOK() against the real Firestore emulator (second sign-in factor).
// Not part of `check:all` (needs Java + the emulator + a dev-only dependency). Run:
//   npm i --no-save --legacy-peer-deps @firebase/rules-unit-testing
//   npx firebase emulators:exec --only firestore --project demo-ecos \
//     "node tools/rules-check/mfa-rules.mjs firestore.rules"
// Session 54: 6/6 pass; flipping the default in mfaOK() to fail-open makes 'no claim at all' fail.
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { setDoc, getDoc, doc } from 'firebase/firestore';
const env = await initializeTestEnvironment({ projectId: 'demo-ecos',
  firestore: { rules: readFileSync(process.argv[2],'utf8'), host: '127.0.0.1', port: 8080 } });
await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(),'tenants/t1/profile/p'), { name: 'x' }); });
const read = (ctx) => getDoc(doc(ctx.firestore(), 'tenants/t1/profile/p'));
const base = { tenantId: 't1', caps: [], geoScope: 'TENANT' };
const now = Math.floor(Date.now()/1000);
const cases = [
  ['canvasser, no mfa', { ...base, mfaRequired: false }, true],
  ['ward-lead, no mfa', { ...base, mfaRequired: true }, false],
  ['ward-lead, mfa live', { ...base, mfaRequired: true, mfaUntil: now + 3600 }, true],
  ['ward-lead, mfa expired', { ...base, mfaRequired: true, mfaUntil: now - 5 }, false],
  ['no claim at all (fail closed)', { ...base }, false],
    ['admin, mfa live, wrong tenant', { ...base, tenantId: 't2', mfaRequired: true, mfaUntil: now + 3600 }, false],
];
let bad = 0;
for (const [name, tok, ok] of cases) {
  const ctx = env.authenticatedContext('u1', tok);
  let got; try { await assertSucceeds(read(ctx)); got = true; } catch { got = false; }
  const pass = got === ok; if (!pass) bad++;
  console.log(pass ? 'PASS' : 'FAIL', name, '->', got ? 'allowed' : 'denied');
}
await env.cleanup(); process.exit(bad ? 1 : 0);
