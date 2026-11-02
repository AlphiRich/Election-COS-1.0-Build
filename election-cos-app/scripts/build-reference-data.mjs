#!/usr/bin/env node
/**
 * Election Campaign OS — build the NW405 voting-district reference (VD locator + voter statistics).
 *
 *   node scripts/build-reference-data.mjs --roll DIR/data --seed seed-data/jb-marks-nw405-wards-vds.json \
 *        --out src/data/reference/nw405-vd-reference.json
 *
 * READS the certified roll's parsed CSVs (verified_voters.csv, rejected_voters.csv, vd_summary.csv). The roll is
 * personal information and is never copied into the output; WRITES ONLY AGGREGATES: per ward and voting
 * district, how many verified voters and how many age-band counts, with small cells suppressed. The roll
 * files stay on the machine they are on (README hard rule 1).
 *
 * AGE comes from the first six digits of the masked ID (YYMMDD). The century is fixed by the rule that
 * every entry on a certified roll is at least 18 on polling day (4 Nov 2026): a two-digit year that would
 * make the person younger than 18 is read as 19YY, and an age over 110 is reported as "unplaced". Sex is NOT derivable:
 * the digits that carry it are masked. Nothing finer than an age band is produced.
 *
 * DISCLOSURE CONTROL: a band with fewer than MIN_CELL people is shown as null. If exactly one band in a
 * row would be hidden, the smallest other band is hidden too, because the row total is published and a
 * lone hidden cell could otherwise be subtracted out.
 */
import { createReadStream, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import path from 'node:path';

const args = process.argv.slice(2);
const arg = (n) => { const i = args.indexOf(n); if (i < 0) throw new Error(`missing ${n}`); return args[i + 1]; };
const ROLL = arg('--roll');
const SEED = arg('--seed');
const OUT = arg('--out');
import { BANDS, MIN_CELL, ageFromMask, bandOf, suppress } from './lib/ageBands.mjs';

function parseCsvLine(line) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c;
  }
  out.push(cur); return out;
}
async function* rows(file) {
  const rl = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  let head = null;
  for await (const line of rl) {
    if (!line) continue;
    const f = parseCsvLine(line);
    if (!head) { head = f; continue; }
    yield Object.fromEntries(head.map((h, i) => [h, f[i]]));
  }
}

const key = (ward, vd) => `${ward}|${vd}`;
const agg = new Map();
const slot = (ward, vd, station) => {
  const k = key(ward, vd);
  if (!agg.has(k)) agg.set(k, { ward, vd, station, verified: 0, rejected: 0, unplaced: 0, bands: Object.fromEntries(BANDS.map((b) => [b, 0])) });
  return agg.get(k);
};
for await (const r of rows(path.join(ROLL, 'verified_voters.csv'))) {
  const s = slot(r.ward_code, r.voting_district, r.voting_station);
  s.verified++;
  const a = ageFromMask(r.id_number_masked);
  if (a === null) s.unplaced++; else s.bands[bandOf(a)]++;
}
for await (const r of rows(path.join(ROLL, 'rejected_voters.csv'))) slot(r.ward_code, r.voting_district, r.voting_station).rejected++;

const declared = new Map();
for await (const r of rows(path.join(ROLL, 'vd_summary.csv'))) {
  declared.set(r.voting_district, { verified: +r.declared_total_verified, rejected: +r.declared_total_rejected, status: r.status });
}
const seed = JSON.parse(readFileSync(SEED, 'utf8'));
const seedVd = new Map();
for (const w of seed) for (const v of w.votingDistricts) seedVd.set(key(w.ward.id.replace('NW405-W', '640050').padStart(8, '0'), v.vdCode), v);

const wardNo = (code) => +String(code).slice(-3);
const list = [...agg.values()].map((s) => {
  const seedRow = [...seed].flatMap((w) => w.votingDistricts).find((v) => v.vdCode === s.vd && v.wardCode === `NW405-W${wardNo(s.ward)}`);
  return {
    wardCode: `NW405-W${wardNo(s.ward)}`,
    wardNumber: wardNo(s.ward),
    vdCode: s.vd,
    station: s.station,
    registeredSeed: seedRow?.registeredVoters ?? null,
    verified: s.verified,
    rejected: s.rejected,
    ageBands: suppress(s.bands),
    ageUnplaced: s.unplaced >= MIN_CELL ? s.unplaced : null,
  };
}).sort((a, b) => a.wardNumber - b.wardNumber || a.vdCode.localeCompare(b.vdCode));

// reconcile with the Commission's printed totals, per voting district (a split VD is summed across wards)
const byVd = new Map();
for (const r of list) { const t = byVd.get(r.vdCode) ?? { v: 0, j: 0 }; t.v += r.verified; t.j += r.rejected; byVd.set(r.vdCode, t); }
let mismatches = 0;
for (const [vd, t] of byVd) { const d = declared.get(vd); if (!d || d.verified !== t.v || d.rejected !== t.j) mismatches++; }

const wards = {};
for (const r of list) {
  const w = (wards[r.wardCode] ??= { wardNumber: r.wardNumber, verified: 0, rejected: 0, bands: Object.fromEntries(BANDS.map((b) => [b, 0])) });
  w.verified += r.verified; w.rejected += r.rejected;
}
for (const s of agg.values()) { const w = wards[`NW405-W${wardNo(s.ward)}`]; for (const b of BANDS) w.bands[b] += s.bands[b]; }
for (const w of Object.values(wards)) w.ageBands = suppress(w.bands), delete w.bands;

const out = {
  municipalityCode: 'NW405',
  generatedFrom: 'IEC LGE 2026 certified voters roll for NW405 (parsed), aggregated; no personal data retained',
  rollEdition: 'LGE2026-CERT-20260807',
  ageAt: '2026-11-04',
  minCell: MIN_CELL,
  ageBandsNote: 'Age is read from the masked ID number. Sex cannot be derived. Cells under 10 are hidden, with a second cell hidden where one alone could be recovered from the total.',
  reconciliation: { vdsCompared: byVd.size, vdsNotMatchingCommissionTotals: mismatches },
  totals: { verified: list.reduce((s, r) => s + r.verified, 0), rejected: list.reduce((s, r) => s + r.rejected, 0), wardVdRows: list.length },
  wards,
  voterDistricts: list,
};
writeFileSync(OUT, JSON.stringify(out));
console.log(JSON.stringify({ rows: list.length, ...out.totals, reconciliation: out.reconciliation, bytes: JSON.stringify(out).length }));
