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

// REGISTERED VOTERS come from the seed (gazette baseline, 122,059 for NW405) and are the only voter count
// the application shows. The roll contributes the AGE MIX only, as a percentage of a row's age-banded
// entries; no roll count (verified, rejected, or banded) is written to the output.
const rollByWardVd = new Map();
for (const s of agg.values()) rollByWardVd.set(`NW405-W${wardNo(s.ward)}|${s.vd}`, s);

const share = (bands, total) => Object.fromEntries(BANDS.map((b) => [b, bands[b] === null || !total ? null : Math.round((bands[b] / total) * 1000) / 10]));
const mix = (raw) => {
  const total = BANDS.reduce((t, b) => t + raw[b], 0);
  if (total < MIN_CELL) return null;
  return share(suppress(raw), total);
};

const wards = {};
const list = [];
for (const w of seed) {
  const code = w.ward.wardCode;
  const no = +code.replace('NW405-W', '');
  const raw = Object.fromEntries(BANDS.map((b) => [b, 0]));
  for (const v of w.votingDistricts) {
    const roll = rollByWardVd.get(`${code}|${v.vdCode}`);
    if (roll) for (const b of BANDS) raw[b] += roll.bands[b];
    list.push({ wardCode: code, wardNumber: no, vdCode: v.vdCode, station: v.name, registered: v.registeredVoters, split: !!v._split, ageMix: roll ? mix(roll.bands) : null });
  }
  wards[code] = { wardNumber: no, registered: w.ward.registeredVoters, ageMix: mix(raw) };
}
list.sort((a, b) => a.wardNumber - b.wardNumber || a.vdCode.localeCompare(b.vdCode));

// municipality age mix, from all banded roll entries (a percentage; the count is not kept)
const all = Object.fromEntries(BANDS.map((b) => [b, 0]));
for (const s of agg.values()) for (const b of BANDS) all[b] += s.bands[b];

// reconcile the roll with the Commission's printed totals per voting district (checked here, not shipped as a count)
const byVd = new Map();
for (const s of agg.values()) { const t = byVd.get(s.vd) ?? { v: 0, j: 0 }; t.v += s.verified; t.j += s.rejected; byVd.set(s.vd, t); }
let mismatches = 0;
for (const [vd, t] of byVd) { const d = declared.get(vd); if (!d || d.verified !== t.v || d.rejected !== t.j) mismatches++; }

const registeredTotal = list.reduce((t, r) => t + r.registered, 0);
const wardTotal = Object.values(wards).reduce((t, w) => t + w.registered, 0);
if (registeredTotal !== wardTotal) throw new Error(`seed VD total ${registeredTotal} != ward total ${wardTotal}`);

const out = {
  municipalityCode: 'NW405',
  registeredSource: 'Delimitation seed (gazetted baseline); equals IEC Circular 1 of 2025, Annexure A',
  ageSource: 'IEC LGE 2026 certified voters roll for NW405 (parsed), reduced to percentages; no personal data and no roll count retained',
  rollEdition: 'LGE2026-CERT-20260807',
  ageAt: '2026-11-04',
  minCell: MIN_CELL,
  ageBandsNote: 'Age is read from the masked ID number and shown as a share of the entries that could be placed in a band. Sex cannot be derived. Groups under 10 people are hidden, with a second hidden where one alone could be recovered from the total.',
  reconciliation: { vdsCompared: byVd.size, vdsNotMatchingCommissionTotals: mismatches },
  totals: { registered: registeredTotal, wards: Object.keys(wards).length, votingDistrictRows: list.length, withAgeMix: list.filter((r) => r.ageMix).length },
  municipalityAgeMix: mix(all),
  wards,
  voterDistricts: list,
};
writeFileSync(OUT, JSON.stringify(out));
console.log(JSON.stringify({ ...out.totals, reconciliation: out.reconciliation, bytes: JSON.stringify(out).length }));
