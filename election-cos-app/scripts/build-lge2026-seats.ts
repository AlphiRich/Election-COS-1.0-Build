/**
 * Writes `src/data/lge2026/nw-seats-2026.json`: the council seats after Schedule 1 for each North West local municipality,
 * from the ingested 2026 ballots. A small file (a few KB) so the public site's coalition tool can carry the real result
 * without bundling the 450 KB ballot file. `lge2026Results.test.ts` fails if this file differs from what the engine computes.
 *
 *   npx vite-node scripts/build-lge2026-seats.ts
 */
import { writeFileSync } from 'node:fs';
import { MUNICIPALITY_CODES, councilHolders, municipality } from '../src/modules/lge2026/lge2026Results';
import { delimitationFor } from '../src/modules/reference/municipalRegister';

const out = {
  source: 'Schedule 1 over the Electoral Commission LGE 2026 results (EEID1887); reconciled with its Seat Calculation Detail reports',
  municipalities: Object.fromEntries(
    MUNICIPALITY_CODES.map((c) => [c, { name: municipality(c).name, totalSeats: delimitationFor(c)!.councillors, holders: councilHolders(c) }]),
  ),
};
writeFileSync('src/data/lge2026/nw-seats-2026.json', JSON.stringify(out));
console.log(`wrote ${MUNICIPALITY_CODES.length} councils`);
