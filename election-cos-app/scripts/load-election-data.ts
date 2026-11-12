/**
 * Loads the election results held in this repository into Firestore (collections in src/modules/electionData/model.ts).
 *
 *   npx vite-node scripts/load-election-data.ts                      # dry run: counts only, writes nothing
 *   npx vite-node scripts/load-election-data.ts --write              # needs administrator credentials
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npx vite-node scripts/load-election-data.ts --write --project demo-ecos
 *
 * Idempotent: documents are keyed by election, council and ward, so a second run overwrites with identical content.
 */
import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { councilDocs, councilPath, wardPath, ELECTIONS, type ElectionDoc } from '../src/modules/electionData/model';
import type { NationalCouncil, ProvinceCode } from '../src/modules/lge2026/nationalResults';

const root = path.resolve(__dirname, '..');
const dir = path.join(root, 'src/data/lge2026/national');
const args = process.argv.slice(2);
const write = args.includes('--write');
const project = args.includes('--project') ? args[args.indexOf('--project') + 1] : process.env.GCLOUD_PROJECT ?? 'electioncos1-0';

const ELECTION_ID = 'EEID1887';
const writes: Array<{ path: string; data: unknown }> = [];

for (const f of readdirSync(dir).filter((x) => /^[A-Z]{2}\.json$/.test(x))) {
  const prov = f.replace('.json', '') as ProvinceCode;
  const file = JSON.parse(readFileSync(path.join(dir, f), 'utf8')) as { source: { eventId: string; publisher: string; retrieved: string; note: string }; municipalities: Record<string, NationalCouncil> };
  if (file.source.eventId !== ELECTION_ID) throw new Error(`${f}: expected ${ELECTION_ID}, found ${file.source.eventId}.`);
  for (const [code, c] of Object.entries(file.municipalities)) {
    const { council, wards } = councilDocs(ELECTION_ID, prov, code, c);
    writes.push({ path: councilPath(ELECTION_ID, code), data: council });
    for (const w of wards) writes.push({ path: wardPath(ELECTION_ID, code, w.wardId), data: w });
  }
}
const election: ElectionDoc = {
  id: ELECTION_ID, kind: 'LGE', year: 2026, date: '2026-11-04',
  publisher: 'Electoral Commission of South Africa', retrieved: '2026-11-10',
  note: 'Aggregates only. Ward, PR and DC 40% ballots. Party names as the Commission prints them.',
};
writes.unshift({ path: `${ELECTIONS}/${ELECTION_ID}`, data: election });

const councils = writes.filter((w) => /\/councils\/[^/]+$/.test(w.path)).length;
console.log(`${writes.length} documents: 1 election, ${councils} councils, ${writes.length - councils - 1} wards.`);
if (!write) { console.log('Dry run. Nothing written. Add --write to load.'); process.exit(0); }

// @google-cloud/firestore (a dependency of firebase-admin) reads Application Default Credentials itself, including the keyless
// Workload Identity Federation file CI signs in with; firebase-admin's own credential parser rejects that file type.
const req = createRequire(path.join(root, 'functions/package.json'));
const { Firestore } = req('@google-cloud/firestore');
const db = new Firestore({ projectId: project });
(async () => {
  for (let i = 0; i < writes.length; i += 400) {
    const batch = db.batch();
    for (const w of writes.slice(i, i + 400)) batch.set(db.doc(w.path), w.data);
    await batch.commit();
    console.log(`  wrote ${Math.min(i + 400, writes.length)} / ${writes.length}`);
  }
  console.log(`Loaded into project ${project}.`);
})().catch((e) => { console.error(e); process.exit(1); });
