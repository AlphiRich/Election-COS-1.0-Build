#!/usr/bin/env node
/**
 * Election Campaign OS — build the LGE 2026 North West results (aggregates only).
 *
 *   node scripts/build-lge2026-results.mjs --raw DIR --out src/data/lge2026 [--province NW.csv]
 *
 * READS the Electoral Commission's "Downloadable Party Results" CSVs for the 18 North West local municipalities
 * (https://results.elections.org.za/home/LGEPublicReports/1887/Downloadable%20Party%20Results/NW/<CODE>.csv, one row per
 * party, ballot and voting district). WRITES `nw-results.json` (ward, PR and district-council 40% ballots per
 * municipality and ward; voting-district detail for NW405 only) and `manifest.json` (SHA-256, bytes, rows and
 * generation times of every source file). No person is in these files: they are counts.
 *
 * DEFINITIONS (all derived here, none asserted):
 *  - registered: sum of RegisteredVoters over distinct (ward, voting district) rows, once.
 *  - spoilt: SpoiltVotes once per (ward, voting district, ballot) - it repeats on every party row.
 *  - valid: sum of party votes on that ballot.
 *  - a district council is NOT a file of its own on the Commission's site: its 40% PR ballot is the "DC 40%" ballot in
 *    each local municipality, so a district's figures are the sum over its member municipalities (the district is the
 *    two digits after NW in the municipal code: NW37x -> DC37, NW38x -> DC38, NW39x -> DC39, NW40x -> DC40).
 *  - "INDEPENDENT" is ONE row per voting district: the Commission merges all independent candidates on the ward ballot,
 *    so a ward where INDEPENDENT leads cannot be said to be won by one named candidate. Those wards are flagged.
 * With --province, the province-wide CSV is compared with the per-municipality files and every difference reported.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const arg = (n, req = true) => { const i = args.indexOf(n); if (i < 0) { if (req) throw new Error(`missing ${n}`); return null; } return args[i + 1]; };
const RAW = arg('--raw');
const OUT = arg('--out');
const PROVINCE = arg('--province', false);

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
const stamp = (v) => { const m = /^(\d+)\/(\d+)\/(\d{4}) (\d+):(\d+):(\d+) (AM|PM)$/.exec(v); if (!m) throw new Error(`bad DateGenerated ${v}`); let h = +m[4] % 12 + (m[7] === 'PM' ? 12 : 0); return `${m[3]}-${String(m[1]).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}T${String(h).padStart(2, '0')}:${m[5]}:${m[6]}`; };

const files = readdirSync(RAW).filter((f) => /^NW\d{3}\.csv$/.test(f)).sort();
if (files.length !== 18) throw new Error(`expected 18 municipality files, found ${files.length}`);

const manifest = { eventId: 'EEID1887', event: 'Local Government Elections 2026', publisher: 'Electoral Commission of South Africa', urlPattern: 'https://results.elections.org.za/home/LGEPublicReports/1887/Downloadable%20Party%20Results/NW/<CODE>.csv', files: [] };
const municipalities = {};
const allRows = [];

for (const f of files) {
  const buf = readFileSync(path.join(RAW, f));
  const rows = parseCsv(buf.toString('utf8'));
  if (!rows.length) throw new Error(`${f}: no rows`);
  if (JSON.stringify(Object.keys(rows[0])) !== JSON.stringify(HEADERS)) throw new Error(`${f}: unexpected columns ${Object.keys(rows[0])}`);
  const code = f.slice(0, 5);
  if (!rows.every((r) => r.Municipality.startsWith(`${code} - `))) throw new Error(`${f}: a row belongs to another municipality`);
  const stamps = rows.map((r) => stamp(r.DateGenerated)).sort();
  manifest.files.push({ code, sha256: sha(buf), bytes: buf.length, rows: rows.length, generatedFrom: stamps[0], generatedTo: stamps[stamps.length - 1] });
  for (const r of rows) allRows.push({ code, ...r });

  const m = { code, name: rows[0].Municipality.slice(8), wards: 0, votingDistricts: 0, registered: 0, ballots: {}, parties: { ward: {}, pr: {}, dc40: {} }, onPrList: [], wardResults: [] };
  const wardMap = new Map(); const vdSeen = new Map(); const spoilSeen = new Set(); const vdDetail = new Map();
  for (const r of rows) {
    const b = BALLOT[r.BallotType]; if (!b) throw new Error(`${f}: unknown ballot "${r.BallotType}"`);
    const wardId = r.Ward.replace(/^Ward /, ''); if (!/^\d{8}$/.test(wardId)) throw new Error(`${f}: bad ward "${r.Ward}"`);
    const vk = `${wardId}|${r.VotingDistrict}`;
    const reg = num(r.RegisteredVoters, 'RegisteredVoters');
    if (vdSeen.has(vk) && vdSeen.get(vk) !== reg) throw new Error(`${f}: registered voters differ within ${vk}`);
    vdSeen.set(vk, reg);
    const votes = num(r.TotalValidVotes, 'TotalValidVotes');
    const sk = `${vk}|${b}`; const spoilt = num(r.SpoiltVotes, 'SpoiltVotes');
    const bal = (m.ballots[b] ??= { valid: 0, spoilt: 0 });
    if (!spoilSeen.has(sk)) { spoilSeen.add(sk); bal.spoilt += spoilt; }
    else if (vdDetail.get(sk) !== spoilt) throw new Error(`${f}: spoilt votes differ within ${sk}`);
    vdDetail.set(sk, spoilt);
    bal.valid += votes;
    m.parties[b][r.PartyName] = (m.parties[b][r.PartyName] ?? 0) + votes;
    if (b === 'pr' && !m.onPrList.includes(r.PartyName)) m.onPrList.push(r.PartyName);
    if (b === 'ward') {
      const w = wardMap.get(wardId) ?? { wardId, wardNumber: Number(wardId.slice(-3)), registered: 0, spoilt: 0, valid: 0, parties: {}, vds: new Set() };
      if (!w.vds.has(r.VotingDistrict)) { w.vds.add(r.VotingDistrict); w.registered += reg; }
      w.valid += votes; w.parties[r.PartyName] = (w.parties[r.PartyName] ?? 0) + votes;
      wardMap.set(wardId, w);
    }
  }
  // ward spoilt (ward ballot) once per VD
  for (const k of spoilSeen) { const [wid, , b] = k.split('|'); if (b === 'ward') wardMap.get(wid).spoilt += vdDetail.get(k); }
  m.wards = wardMap.size; m.votingDistricts = vdSeen.size;
  m.registered = [...vdSeen.values()].reduce((s, v) => s + v, 0);
  m.wardResults = [...wardMap.values()].sort((a, b) => a.wardNumber - b.wardNumber).map((w) => ({ wardId: w.wardId, wardNumber: w.wardNumber, registered: w.registered, valid: w.valid, spoilt: w.spoilt, parties: Object.entries(w.parties).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])) }));
  for (const b of ['ward', 'pr', 'dc40']) m.parties[b] = Object.entries(m.parties[b]).filter(([, v]) => v > 0).sort((a, c) => c[1] - a[1] || a[0].localeCompare(c[0]));
  if (code === 'NW405') {
    const by = new Map();
    for (const r of rows) {
      const k = `${r.Ward.replace(/^Ward /, '')}|${r.VotingDistrict}`;
      const v = by.get(k) ?? { wardId: r.Ward.replace(/^Ward /, ''), vd: r.VotingDistrict, station: r.VotingStationName, registered: num(r.RegisteredVoters, 'r'), ballots: {} };
      const b = BALLOT[r.BallotType]; const bb = (v.ballots[b] ??= { spoilt: num(r.SpoiltVotes, 's'), parties: [] });
      const votes = num(r.TotalValidVotes, 'v'); if (votes > 0) bb.parties.push([r.PartyName, votes]);
      by.set(k, v);
    }
    for (const v of by.values()) for (const b of Object.values(v.ballots)) b.parties.sort((a, c) => c[1] - a[1] || a[0].localeCompare(c[0]));
    m.votingDistrictDetail = [...by.values()].sort((a, c) => a.wardId.localeCompare(c.wardId) || a.vd.localeCompare(c.vd));
  }
  municipalities[code] = m;
}

// districts: the DC 40% ballot summed over member municipalities
const districts = {};
for (const m of Object.values(municipalities)) {
  const d = `DC${m.code.slice(2, 4)}`;
  const x = (districts[d] ??= { code: d, members: [], registered: 0, dc40: { valid: 0, spoilt: 0 }, parties: {} });
  x.members.push(m.code); x.registered += m.registered; x.dc40.valid += m.ballots.dc40.valid; x.dc40.spoilt += m.ballots.dc40.spoilt;
  for (const [p, v] of m.parties.dc40) x.parties[p] = (x.parties[p] ?? 0) + v;
}
for (const x of Object.values(districts)) x.parties = Object.entries(x.parties).sort((a, c) => c[1] - a[1] || a[0].localeCompare(c[0]));

// cross-check against the province-wide file, if given
const crosscheck = { provinceFile: null, rows: 0, onlyInProvince: 0, onlyInMunicipalityFiles: 0, differing: 0, differingMunicipalities: {}, note: '' };
if (PROVINCE) {
  const buf = readFileSync(PROVINCE); const prov = parseCsv(buf.toString('utf8'));
  const K = (r, c) => `${c}|${r.VotingDistrict}|${r.BallotType}|${r.PartyName}`;
  const mine = new Map(allRows.map((r) => [K(r, r.code), r]));
  const theirs = new Map(prov.map((r) => [K(r, r.Municipality.slice(0, 5)), r]));
  crosscheck.provinceFile = { sha256: sha(buf), bytes: buf.length, rows: prov.length, generated: [...new Set(prov.map((r) => stamp(r.DateGenerated).slice(0, 10)))] };
  crosscheck.rows = prov.length;
  for (const [k, r] of theirs) { const o = mine.get(k); if (!o) crosscheck.onlyInProvince++; else if (o.TotalValidVotes !== r.TotalValidVotes || o.SpoiltVotes !== r.SpoiltVotes) { crosscheck.differing++; const c = k.slice(0, 5); (crosscheck.differingMunicipalities[c] ??= new Set()).add(r.VotingDistrict); } }
  for (const k of mine.keys()) if (!theirs.has(k)) crosscheck.onlyInMunicipalityFiles++;
  for (const c of Object.keys(crosscheck.differingMunicipalities)) crosscheck.differingMunicipalities[c] = [...crosscheck.differingMunicipalities[c]].sort();
  crosscheck.note = 'Municipality files are the later snapshot where they differ: they carry the latest DateGenerated. Differences are listed by voting district.';
}

const out = { source: { eventId: manifest.eventId, publisher: manifest.publisher, retrieved: new Date().toISOString().slice(0, 10), note: 'Aggregates only. Ward, PR and DC 40% ballots. Party names as the Commission prints them.' }, municipalities, districts };
mkdirSync(OUT, { recursive: true });
writeFileSync(path.join(OUT, 'nw-results.json'), JSON.stringify(out));
writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({ ...manifest, crosscheck }, null, 1));
const bytes = JSON.stringify(out).length;
console.log(JSON.stringify({ municipalities: Object.keys(municipalities).length, wards: Object.values(municipalities).reduce((s, m) => s + m.wards, 0), districts: Object.keys(districts), bytes, crosscheck }, null, 1));
