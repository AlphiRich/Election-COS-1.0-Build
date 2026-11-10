/**
 * Writes `src/data/lge2026/national/seats-2026.json`: every contested metro and local council's seats after Schedule 1,
 * from the ingested 2026 ballots, with whether a majority exists and how far the Commission's own report confirms it.
 * Small enough for the public site's Coalition Tracker to carry without the per-province ballot files.
 * `nationalResults.test.ts` fails if this file differs from what the engine computes, or if a council marked
 * `reconciled` does not reproduce the Commission's Seat Calculation Detail report.
 *
 *   npx vite-node scripts/build-lge2026-national-seats.ts
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { councilHoldersOf, partyLabel, type CouncilTies } from '../src/modules/lge2026/councilResults';
import { majorityOf, type CouncilSeats, type IecStatus, type ProvinceCode, type ProvinceFile } from '../src/modules/lge2026/nationalResults';
import { holdersFromIecReport, reconcile, type IecReport } from '../src/modules/lge2026/reconcile';

/**
 * Councils whose Seat Calculation Detail report was computed on a later count than the downloadable results file: every
 * party's report total is a little higher (checked 10 Nov 2026). Named, not inferred, so a new mismatch anywhere else still
 * stops the build.
 */
const LATER_COUNT = new Set(['FS184', 'KZN216', 'KZN225']);

const DIR = 'src/data/lge2026/national';
const iec = JSON.parse(readFileSync(path.join(DIR, 'seat-calculation-iec.json'), 'utf8')) as {
  municipalities: Record<string, IecReport>;
  notPublished: string[];
};

const tieFile = JSON.parse(readFileSync(path.join(DIR, 'tie-resolutions.json'), 'utf8')) as {
  wards: Array<{ code: string; ward: number; awardedTo: string | null }>;
  remainders: Array<{ code: string; awardedTo: string[] }>;
};
function tiesFor(code: string): CouncilTies | undefined {
  const wards = tieFile.wards.filter((w) => w.code === code);
  const rem = tieFile.remainders.find((r) => r.code === code);
  if (!wards.length && !rem) return undefined;
  return { wards: Object.fromEntries(wards.map((w) => [w.ward, w.awardedTo])), remainders: rem?.awardedTo };
}

const councils: Record<string, CouncilSeats> = {};
const problems: string[] = [];
let retrieved = '';
for (const f of readdirSync(DIR).filter((x) => /^[A-Z]{2}\.json$/.test(x)).sort()) {
  const file = JSON.parse(readFileSync(path.join(DIR, f), 'utf8')) as ProvinceFile;
  retrieved = file.source.retrieved;
  for (const m of Object.values(file.municipalities)) {
    const ties = tiesFor(m.code);
    let holders = councilHoldersOf(m, m.councillors, ties);
    const majority = majorityOf(m.councillors);
    let status: IecStatus;
    const report = iec.municipalities[m.code];
    if (iec.notPublished.includes(m.code)) status = 'notPublished';
    else if (!report) throw new Error(`${m.code}: no Seat Calculation Detail report extracted`);
    else if (LATER_COUNT.has(m.code)) {
      const fromReport = holdersFromIecReport(m, m.councillors, report, ties);
      if (!fromReport) {
        problems.push(`${m.code}: listed as a later count, but its report cannot be matched to parties unambiguously`);
        continue;
      }
      holders = fromReport;
      status = 'laterCount';
    } else {
      const diffs = reconcile(m, m.councillors, report, ties);
      if (report.incomplete) status = 'incomplete';
      else if (diffs.length) {
        problems.push(...diffs.map((d) => `${m.code}: ${d}`));
        continue;
      } else status = 'reconciled';
    }
    const tiedWards = tieFile.wards.filter((w) => w.code === m.code).map((w) => ({ ward: w.ward, awardedTo: w.awardedTo && partyLabel(w.awardedTo) }));
    const pr = m.ballots.pr;
    councils[m.code] = {
      code: m.code,
      name: m.name,
      province: file.province as ProvinceCode,
      category: m.category,
      district: m.district,
      councillors: m.councillors,
      wards: m.wards,
      registered: m.registered,
      turnoutPr: Math.round(((pr.valid + pr.spoilt) / m.registered) * 1000) / 10,
      holders,
      majority,
      hung: holders[0].seats < majority,
      iec: status,
      ...(status === 'incomplete' ? { iecUnallocated: report!.unallocatedSeats } : {}),
      ...(tiedWards.length ? { tiedWards } : {}),
    };
  }
}
if (problems.length) {
  console.error(`${problems.length} reconciliation differences; nothing written:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
const out = {
  source: 'Schedule 1 over the Electoral Commission LGE 2026 results (EEID1887); reconciled with its Seat Calculation Detail reports',
  retrieved,
  councils,
};
writeFileSync(path.join(DIR, 'seats-2026.json'), JSON.stringify(out));
const all = Object.values(councils);
// A few bytes for the home page, which loads eagerly and must not carry the full table. nationalResults.test.ts checks it.
const metros = all.filter((c) => c.category === 'A');
writeFileSync(
  path.join(DIR, 'summary-2026.json'),
  JSON.stringify({ retrieved, councils: all.length, hung: all.filter((c) => c.hung).length, metros: metros.length, metrosHung: metros.filter((c) => c.hung).length }),
);
console.log(`wrote ${all.length} councils: ${all.filter((c) => c.hung).length} hung; ` + `iec ${JSON.stringify(Object.fromEntries(['reconciled', 'laterCount', 'incomplete', 'notPublished'].map((s) => [s, all.filter((c) => c.iec === s).length])))}`);
