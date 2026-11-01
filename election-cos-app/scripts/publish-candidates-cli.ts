/**
 * Election Campaign OS — publish candidates entry point.
 * @deployable fails-closed (see publish-candidates.ts)
 *
 *   CANDIDATES_DATASET=src/data/iec/candidates-lge2026-iec-nw-23102026.json \
 *   CANDIDATES_OUT=dist-site npx vite-node scripts/publish-candidates-cli.ts
 */
import { readFileSync } from 'node:fs';
import { publishCandidates } from './publish-candidates';

const file = process.env.CANDIDATES_DATASET;
if (!file) {
  console.error('CANDIDATES_DATASET is not set.');
  process.exit(2);
}
const r = publishCandidates(
  JSON.parse(readFileSync(file, 'utf-8')),
  process.env.CANDIDATES_OUT ?? 'dist-site',
);
if (r.published === 0) {
  console.error(r.reason);
  process.exit(1);
}
console.log(`Published ${r.published} municipalities.`);
