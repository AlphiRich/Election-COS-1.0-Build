/**
 * Election Campaign OS — ingest a supplied candidate CSV
 *
 *   CANDIDATES_CSV=/path/to/file.csv RECEIVED_ON=2026-11-01 \
 *     npx vite-node scripts/ingest-candidates.ts
 *
 * Validates (see src/modules/ingest/candidateList.ts), drops the ID column,
 * and writes src/data/iec/candidates-lge2026-<name>.json as UNCONFIRMED. It
 * exits non-zero, writing nothing, if the format is unmapped. A partial file
 * is written, labelled PARTIAL, with the findings: the point is to record
 * what arrived, not to pretend it is whole.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ingestCandidateCsv, type CandidateDataset } from '../src/modules/ingest/candidateList';

const file = process.env.CANDIDATES_CSV;
const out = process.env.CANDIDATES_OUT ?? 'src/data/iec/candidates-lge2026-supplied.json';
if (!file) {
  console.error('CANDIDATES_CSV is not set. Nothing was read.');
  process.exit(2);
}
const raw = readFileSync(file);
const outcome = ingestCandidateCsv(raw.toString('utf-8'));
if (!outcome.ok) {
  console.error(outcome.reason);
  console.error(`Columns in the file: ${outcome.columns.join(', ')}`);
  process.exit(1);
}
const r = outcome.report;
const dataset: CandidateDataset & { report: Omit<typeof r, 'entries'> } = {
  provenance: {
    suppliedFile: path.basename(file),
    sha256: createHash('sha256').update(raw).digest('hex'),
    bytes: raw.length,
    receivedOn: process.env.RECEIVED_ON ?? new Date().toISOString().slice(0, 10),
    producedBy: process.env.PRODUCED_BY ?? 'Not stated',
    sourceDocumentNamed: process.env.SOURCE_DOCUMENT ?? 'Not stated',
    sourceDocumentSupplied: false,
    status: 'UNCONFIRMED',
    confirmedBy: null,
    confirmedOn: null,
  },
  status: r.status,
  entries: r.entries,
  report: {
    rowsRead: r.rowsRead,
    rejected: r.rejected,
    findings: r.findings,
    coverage: r.coverage,
    dualNominated: r.dualNominated,
    idColumn: r.idColumn,
    status: r.status,
  },
};
writeFileSync(out, JSON.stringify(dataset, null, 2) + '\n');
console.log(
  `Read ${r.rowsRead} rows: ${r.entries.length} kept, ${r.rejected.length} rejected, status ${r.status}. Wrote ${out}.`,
);
for (const f of r.findings) console.log(`[${f.severity}] ${f.text}`);
