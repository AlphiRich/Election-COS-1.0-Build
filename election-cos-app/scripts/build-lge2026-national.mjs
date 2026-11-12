#!/usr/bin/env node
/**
 * Election Campaign OS — build the LGE 2026 results for the whole country (aggregates only).
 *
 *   node scripts/build-lge2026-national.mjs --raw DIR --out src/data/lge2026/national
 *
 * READS every metro and local municipality's "Downloadable Party Results" CSV from DIR/csv (fetched from
 * https://results.elections.org.za/home/LGEPublicReports/1887/Downloadable%20Party%20Results/<PROV>/<CODE>.csv, where
 * PROV is the Commission's own folder code: EC FS GP KN NP MP NC NW WP). WRITES one file per province, <PROV>.json, with
 * the same shape as nw-results.json (ward, PR and DC 40% ballots per municipality and ward) but without voting-district
 * detail, and manifest.json with every source file's SHA-256, size, rows and generation times.
 *
 * Same definitions and refusals as build-lge2026-results.mjs: a file whose columns, municipality, numbers or repeated
 * figures do not hold together stops the build. The expected set of councils is the proclaimed register
 * (circular-1-2025-annexure-a.json) with register-corrections-2026.json applied: a council in the register and not on
 * disk, or on disk and not in the register, is an error, except one the corrections mark as not contested.
 *
 * No person is in these files: they are counts.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const arg = (n) => { const i = args.indexOf(n); if (i < 0) throw new Error(`missing ${n}`); return args[i + 1]; };
const RAW = arg('--raw');
const OUT = arg('--out');

const FOLDER = { 'Eastern Cape': 'EC', 'Free State': 'FS', Gauteng: 'GP', 'KwaZulu-Natal': 'KN', Limpopo: 'NP', Mpumalanga: 'MP', 'Northern Cape': 'NC', 'North West': 'NW', 'Western Cape': 'WP' };

const register = JSON.parse(readFileSync('src/data/iec/circular-1-2025-annexure-a.json', 'utf8')).municipalities.map((m) => ({ ...m }));
const byCode = Object.fromEntries(register.map((m) => [m.code, m]));
for (const c of JSON.parse(readFileSync('src/data/iec/register-corrections-2026.json', 'utf8')).corrections) Object.assign(byCode[c.code], c.as2026);

function parseCsv(text) {
  const rows = []; let row = []; let cur = ''; let q = false;
  const s = text.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"') { if (s[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && s[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.length > 1 || row[0] !== '') rows.push(row); row = []; }
    else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  const head = rows.shift();
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}
const sha = (buf) => createHash('sha256').update(buf).digest('hex');
const HEADERS = ['Province', 'Municipality', 'Ward', 'VotingDistrict', 'VotingStationName', 'RegisteredVoters', 'BallotType', 'SpoiltVotes', 'PartyName', 'TotalValidVotes', 'DateGenerated'];
const BALLOT = { Ward: 'ward', PR: 'pr', 'DC 40%': 'dc40' };
const num = (v, what) => { if (!/^\d+$/.test(v)) throw new Error(`not a whole number in ${what}: "${v}"`); return Number(v); };
const stamp = (v) => { const m = /^(\d+)\/(\d+)\/(\d{4}) (\d+):(\d+):(\d+) (AM|PM)$/.exec(v); if (!m) throw new Error(`bad DateGenerated ${v}`); const h = +m[4] % 12 + (m[7] === 'PM' ? 12 : 0); return `${m[3]}-${String(m[1]).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}T${String(h).padStart(2, '0')}:${m[5]}:${m[6]}`; };

// The district a local belongs to: the digits after the province prefix, less the last (docs/national-delimitation-baseline.md).
const districtOf = (code) => { const m = /^[A-Z]+(\d+)$/.exec(code); if (!m) return null; const d = m[1].slice(0, -1).replace(/^0/, ''); return `DC${d}`; };

const expected = register.filter((m) => m.category !== 'C' && byCode[m.code].contested !== false).map((m) => m.code).sort();
const onDisk = readdirSync(path.join(RAW, 'csv')).filter((f) => /\.csv$/.test(f)).map((f) => f.slice(0, -4)).sort();
const missing = expected.filter((c) => !onDisk.includes(c));
const extra = onDisk.filter((c) => !expected.includes(c));
if (missing.length || extra.length) throw new Error(`council set mismatch: missing ${missing.join(' ') || '-'}; not in register ${extra.join(' ') || '-'}`);

const manifest = { eventId: 'EEID1887', event: 'Local Government Elections 2026', publisher: 'Electoral Commission of South Africa', urlPattern: 'https://results.elections.org.za/home/LGEPublicReports/1887/Downloadable%20Party%20Results/<PROV>/<CODE>.csv', retrieved: new Date().toISOString().slice(0, 10), files: [] };
const provinces = {};
const problems = [];

for (const code of expected) {
  const reg = byCode[code];
  const prov = FOLDER[reg.province];
  const buf = readFileSync(path.join(RAW, 'csv', `${code}.csv`));
  const rows = parseCsv(buf.toString('utf8'));
  if (!rows.length) throw new Error(`${code}: no rows`);
  if (JSON.stringify(Object.keys(rows[0])) !== JSON.stringify(HEADERS)) throw new Error(`${code}: unexpected columns ${Object.keys(rows[0])}`);
  if (!rows.every((r) => r.Municipality.startsWith(`${code} - `))) throw new Error(`${code}: a row belongs to another municipality`);
  const stamps = rows.map((r) => stamp(r.DateGenerated)).sort();
  manifest.files.push({ code, province: prov, sha256: sha(buf), bytes: buf.length, rows: rows.length, generatedFrom: stamps[0], generatedTo: stamps[stamps.length - 1] });

  const m = { code, name: rows[0].Municipality.slice(code.length + 3), category: reg.category, district: reg.category === 'B' ? districtOf(code) : null, councillors: reg.councillors, wards: 0, votingDistricts: 0, registered: 0, ballots: {}, parties: { ward: {}, pr: {}, dc40: {} }, onPrList: [], wardResults: [] };
  const wardMap = new Map(); const vdSeen = new Map(); const spoilSeen = new Map(); const prByWard = new Map();
  for (const r of rows) {
    const b = BALLOT[r.BallotType]; if (!b) throw new Error(`${code}: unknown ballot "${r.BallotType}"`);
    const wardId = r.Ward.replace(/^Ward /, ''); if (!/^\d{8}$/.test(wardId)) throw new Error(`${code}: bad ward "${r.Ward}"`);
    const vk = `${wardId}|${r.VotingDistrict}`;
    const reg2 = num(r.RegisteredVoters, 'RegisteredVoters');
    if (vdSeen.has(vk) && vdSeen.get(vk) !== reg2) throw new Error(`${code}: registered voters differ within ${vk}`);
    vdSeen.set(vk, reg2);
    const votes = num(r.TotalValidVotes, 'TotalValidVotes');
    const sk = `${vk}|${b}`; const spoilt = num(r.SpoiltVotes, 'SpoiltVotes');
    const bal = (m.ballots[b] ??= { valid: 0, spoilt: 0 });
    if (!spoilSeen.has(sk)) { spoilSeen.set(sk, spoilt); bal.spoilt += spoilt; }
    else if (spoilSeen.get(sk) !== spoilt) throw new Error(`${code}: spoilt votes differ within ${sk}`);
    bal.valid += votes;
    m.parties[b][r.PartyName] = (m.parties[b][r.PartyName] ?? 0) + votes;
    if (b === 'pr' && !m.onPrList.includes(r.PartyName)) m.onPrList.push(r.PartyName);
    if (b === 'ward') {
      const w = wardMap.get(wardId) ?? { wardId, wardNumber: Number(wardId.slice(-3)), registered: 0, spoilt: 0, valid: 0, parties: {}, vds: new Set() };
      if (!w.vds.has(r.VotingDistrict)) { w.vds.add(r.VotingDistrict); w.registered += reg2; }
      w.valid += votes; w.parties[r.PartyName] = (w.parties[r.PartyName] ?? 0) + votes;
      wardMap.set(wardId, w);
    }
    // The PR (party) ballot as cast in this ward. PR seats are council-wide, but how a ward voted on the party ballot is
    // what a resident compares with the council's list seats.
    if (b === 'pr') {
      const x = prByWard.get(wardId) ?? { valid: 0, spoilt: 0, parties: {} };
      x.valid += votes; x.parties[r.PartyName] = (x.parties[r.PartyName] ?? 0) + votes;
      prByWard.set(wardId, x);
    }
  }
  for (const [k, s] of spoilSeen) { const [wid, , b] = k.split('|'); if (b === 'ward') wardMap.get(wid).spoilt += s; else if (b === 'pr' && prByWard.has(wid)) prByWard.get(wid).spoilt += s; }
  // A voting district with PR rows but no ward-ballot rows: the ward's result in this file is short (KZN216 ward 13 on
  // 10 Nov 2026). Recorded on the ward, so no page presents that ward's leader as final.
  const wardBallotVds = new Set(rows.filter((r) => r.BallotType === 'Ward').map((r) => `${r.Ward.replace(/^Ward /, '')}|${r.VotingDistrict}`));
  const gaps = new Map();
  for (const vk of vdSeen.keys()) if (!wardBallotVds.has(vk)) { const wid = vk.split('|')[0]; gaps.set(wid, (gaps.get(wid) ?? 0) + 1); }
  if (gaps.size) m.wardBallotGaps = [...gaps].map(([wardId, vds]) => ({ wardId, wardNumber: Number(wardId.slice(-3)), votingDistrictsWithoutWardResult: vds, registeredNotInWard: [...vdSeen].filter(([k]) => k.startsWith(`${wardId}|`) && !wardBallotVds.has(k)).reduce((s, [, v]) => s + v, 0) }));
  m.wards = wardMap.size; m.votingDistricts = vdSeen.size;
  m.registered = [...vdSeen.values()].reduce((s, v) => s + v, 0);
  if (m.wards !== reg.wards) problems.push(`${code}: ${m.wards} wards in the results, ${reg.wards} in the register`);
  m.wardResults = [...wardMap.values()].sort((a, b) => a.wardNumber - b.wardNumber).map((w) => ({ wardId: w.wardId, wardNumber: w.wardNumber, registered: w.registered, valid: w.valid, spoilt: w.spoilt, parties: Object.entries(w.parties).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])), ...(prByWard.has(w.wardId) ? { pr: { valid: prByWard.get(w.wardId).valid, spoilt: prByWard.get(w.wardId).spoilt, parties: Object.entries(prByWard.get(w.wardId).parties).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])) } } : {}) }));
  for (const b of ['ward', 'pr', 'dc40']) m.parties[b] = Object.entries(m.parties[b]).filter(([, v]) => v > 0).sort((a, c) => c[1] - a[1] || a[0].localeCompare(c[0]));
  m.onPrList.sort();
  if (reg.category === 'A') delete m.parties.dc40;
  (provinces[prov] ??= { municipalities: {}, districts: {} }).municipalities[code] = m;
}

// District councils: the DC 40% ballot summed over member locals. Every district in the register must get members.
for (const [prov, p] of Object.entries(provinces)) {
  for (const m of Object.values(p.municipalities)) {
    if (m.category !== 'B') continue;
    const d = m.district;
    if (!byCode[d] || byCode[d].category !== 'C') throw new Error(`${m.code}: derived district ${d} is not a district council in the register`);
    const x = (p.districts[d] ??= { code: d, name: byCode[d].name, councillors: byCode[d].councillors, members: [], registered: 0, dc40: { valid: 0, spoilt: 0 }, parties: {} });
    x.members.push(m.code); x.registered += m.registered; x.dc40.valid += m.ballots.dc40.valid; x.dc40.spoilt += m.ballots.dc40.spoilt;
    for (const [party, v] of m.parties.dc40) x.parties[party] = (x.parties[party] ?? 0) + v;
  }
  for (const x of Object.values(p.districts)) x.parties = Object.entries(x.parties).sort((a, c) => c[1] - a[1] || a[0].localeCompare(c[0]));
}
const districtsBuilt = Object.values(provinces).flatMap((p) => Object.keys(p.districts));
const districtsExpected = register.filter((m) => m.category === 'C').map((m) => m.code);
const noMembers = districtsExpected.filter((d) => !districtsBuilt.includes(d));
if (noMembers.length) throw new Error(`districts with no member results: ${noMembers.join(' ')}`);

mkdirSync(OUT, { recursive: true });
const source = { eventId: manifest.eventId, publisher: manifest.publisher, retrieved: manifest.retrieved, note: 'Aggregates only. Ward, PR and DC 40% ballots. Party names as the Commission prints them.' };
const sizes = {};
for (const [prov, p] of Object.entries(provinces).sort()) {
  const body = JSON.stringify({ source, province: prov, ...p });
  writeFileSync(path.join(OUT, `${prov}.json`), body);
  sizes[prov] = { councils: Object.keys(p.municipalities).length, districts: Object.keys(p.districts).length, kb: Math.round(body.length / 1024) };
}
writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({ ...manifest, wardCountDifferences: problems }, null, 1));
console.log(JSON.stringify({ councils: manifest.files.length, districts: districtsBuilt.length, wards: Object.values(provinces).flatMap((p) => Object.values(p.municipalities)).reduce((s, m) => s + m.wards, 0), sizes, wardCountDifferences: problems }, null, 1));
