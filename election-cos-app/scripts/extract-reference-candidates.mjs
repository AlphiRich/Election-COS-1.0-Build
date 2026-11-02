#!/usr/bin/env node
/**
 * Extract one municipality's candidates from the Commission's supplementary list dataset into a small
 * file the application can bundle (src/data/reference/<code>-candidates.json).
 *
 *   node scripts/extract-reference-candidates.mjs NW405
 *
 * WHY ONE MUNICIPALITY. The full dataset is 10,018 entries (1.7 MB). The application precaches every asset
 * for offline use on field phones; shipping all 22 municipalities to every device would spend a
 * canvasser's data on lists they will never open. The public site serves any municipality by fetch.
 *
 * Carries only names, party, kind, ward or list rank, and the provenance needed to say where the list
 * came from. No identity-number column exists in the source dataset and none is added.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const code = process.argv[2];
if (!/^(NW|DC)\d{2,3}$/.test(code ?? '')) throw new Error('usage: extract-reference-candidates.mjs NW405');
const src = JSON.parse(readFileSync('src/data/iec/candidates-lge2026-iec-nw-23102026.json', 'utf8'));
const p = src.provenance;
const entries = src.entries
  .filter((e) => e.municipalityCode === code)
  .map((e) => ({ party: e.party, fullName: e.fullName, surname: e.surname, kind: e.kind, ...(e.kind === 'WARD' ? { ward: e.wardNumber } : { rank: e.listRank }) }));
const dual = (src.dualNominated ?? []).filter((d) => d.municipalityCode === code).map((d) => ({ name: d.name, party: d.party, ward: d.ward, rank: d.rank }));
const out = {
  municipalityCode: code,
  provenance: {
    source: p.source,
    url: p.url,
    fetchedOn: p.fetchedOn,
    sha256: p.sha256,
    status: p.status,
    confirmedBy: p.confirmedBy,
    confirmedOn: p.confirmedOn,
  },
  counts: { total: entries.length, ward: entries.filter((e) => e.kind === 'WARD').length, pr: entries.filter((e) => e.kind === 'PR').length },
  dualNominated: dual,
  entries,
};
writeFileSync(`src/data/reference/${code.toLowerCase()}-candidates.json`, JSON.stringify(out));
console.log(JSON.stringify({ code, ...out.counts, dual: dual.length, parties: new Set(entries.map((e) => e.party)).size }));
