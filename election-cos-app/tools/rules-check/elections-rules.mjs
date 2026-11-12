// Proves the election-data rules against the real Firestore emulator: signed-in users read, nobody writes, anonymous is refused.
//   npm i --no-save --legacy-peer-deps @firebase/rules-unit-testing
//   npx firebase emulators:exec --only firestore --project demo-ecos "node tools/rules-check/elections-rules.mjs firestore.rules"
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { setDoc, getDoc, doc } from 'firebase/firestore';
const env = await initializeTestEnvironment({ projectId: 'demo-ecos', firestore: { rules: readFileSync(process.argv[2], 'utf8'), host: '127.0.0.1', port: 8080 } });
const paths = ['elections/E1', 'elections/E1/councils/NW405', 'elections/E1/councils/NW405/wards/W1', 'municipalProfiles/NW405/layers/L1'];
await env.withSecurityRulesDisabled(async (c) => { for (const p of paths) await setDoc(doc(c.firestore(), p), { x: 1 }); });
const who = { anonymous: env.unauthenticatedContext(), 'canvasser (no mfa)': env.authenticatedContext('u', { tenantId: 't1', mfaRequired: false }), 'ward-lead (no mfa yet)': env.authenticatedContext('v', { tenantId: 't1', mfaRequired: true }), 'other tenant': env.authenticatedContext('w', { tenantId: 't2' }) };
let bad = 0;
const t = async (label, fn, ok) => { let got; try { await fn(); got = true; } catch { got = false; } const pass = got === ok; if (!pass) bad++; console.log(pass ? 'PASS' : 'FAIL', label); };
for (const [name, ctx] of Object.entries(who)) for (const p of paths) {
  const readOk = name !== 'anonymous';
  await t(`${name} reads ${p}`, () => assertSucceeds(getDoc(doc(ctx.firestore(), p))), readOk);
  await t(`${name} cannot write ${p}`, () => assertSucceeds(setDoc(doc(ctx.firestore(), p), { x: 2 })), false);
}
await env.cleanup(); process.exit(bad ? 1 : 0);
