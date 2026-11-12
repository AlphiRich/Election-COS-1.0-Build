#!/usr/bin/env node
/**
 * Election Campaign OS — fetch the party emblems the Electoral Commission publishes with its 2026 results.
 *
 *   node tools/lge2026/fetch-party-emblems.mjs
 *
 * SOURCE. The Commission's results dashboard lists every registered party with its emblem file
 * (https://results.elections.org.za/dashboards/lge/MapsJason/2026/PartyList.js: PartyFullName -> PartyImage) and serves
 * the images from .../dashboards/lge/Party_Images/<PartyImage>. Each is the party's emblem as it appears on the ballot and
 * on the Commission's own results pages.
 *
 * WHAT IT DOES. For every party that received a vote in the 2026 results (src/data/lge2026/national/*.json), finds its
 * entry by full name and downloads the emblem to public/party-emblems/<id>.png, where <id> is the build's party id
 * (councilResults.ts partyId) in lower case. Writes src/data/lge2026/party-emblems.json: party name -> file, the
 * Commission's image name and the file's SHA-256. A party with no entry is listed under `missing` and drawn without an
 * emblem; nothing is guessed. "INDEPENDENT" in the results maps to the Commission's "INDEPENDENTS" image.
 *
 * Every party is treated alike: same size, same position, same source.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const BASE = 'https://results.elections.org.za/dashboards/lge';
const OUT_DIR = 'public/party-emblems';
const MANIFEST = 'src/data/lge2026/party-emblems.json';
const DATA = 'src/data/lge2026/national';

// Same rule as councilResults.ts partyId, so a file name can be derived from any party name in the data.
const KNOWN_IDS = { 'AFRICAN NATIONAL CONGRESS': 'ANC', 'DEMOCRATIC ALLIANCE': 'DA', 'ECONOMIC FREEDOM FIGHTERS': 'EFF', 'PATRIOTIC ALLIANCE': 'PA', 'VRYHEIDSFRONT PLUS | FREEDOM FRONT PLUS': 'VFP', 'UMKHONTO WESIZWE PARTY': 'MK', 'AFRICAN CHRISTIAN DEMOCRATIC PARTY': 'ACDP', 'AFRICAN TRANSFORMATION MOVEMENT': 'ATM', 'INKATHA FREEDOM PARTY': 'IFP', 'SOUTH AFRICAN COMMUNIST PARTY': 'SACP', INDEPENDENT: 'IND' };
const partyId = (name) => KNOWN_IDS[name] ?? name.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
const norm = (s) => s.toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
const sha = (b) => createHash('sha256').update(b).digest('hex');

const listRes = await fetch(`${BASE}/MapsJason/2026/PartyList.js`, { headers: { 'User-Agent': 'ECOS-results-ingest/1.0' } });
if (!listRes.ok) throw new Error(`party list: HTTP ${listRes.status}`);
const listText = await listRes.text();
const list = JSON.parse(listText);
// The list spans every election, so an old name can appear more than once with different images. The entry with the
// highest ID is the most recent registration; where a 2026 party's name is duplicated that choice is recorded below.
const byName = new Map();
const duplicated = new Map();
for (const p of list) {
  const k = norm(p.PartyFullName);
  const prev = byName.get(k);
  if (prev && prev.PartyImage !== p.PartyImage) duplicated.set(k, [...(duplicated.get(k) ?? [prev.PartyImage]), p.PartyImage]);
  if (!prev || p.ID > prev.ID) byName.set(k, p);
}
byName.set(norm('INDEPENDENT'), list.find((p) => p.PartyFullName === 'INDEPENDENTS'));

const names = new Set();
for (const f of readdirSync(DATA).filter((x) => /^[A-Z]{2}\.json$/.test(x))) {
  const file = JSON.parse(readFileSync(path.join(DATA, f), 'utf8'));
  for (const m of Object.values(file.municipalities)) for (const b of ['pr', 'ward']) for (const [p] of m.parties[b]) names.add(p);
}

mkdirSync(OUT_DIR, { recursive: true });
const emblems = {};
const missing = [];
const failed = [];
const unavailable = []; // the Commission does not serve an image: drawn without an emblem
for (const name of [...names].sort()) {
  const entry = byName.get(norm(name));
  if (!entry) { missing.push(name); continue; }
  const file = `${partyId(name).toLowerCase()}.png`;
  const dest = path.join(OUT_DIR, file);
  let buf;
  if (existsSync(dest)) buf = readFileSync(dest);
  else {
    if (!entry.PartyImage) { unavailable.push(`${name}: the Commission's list names no image`); continue; }
    // Some names carry a doubled dot ("ACC..PNG") that the server does not hold; the single-dot spelling is tried next.
    const tries = [...new Set([entry.PartyImage, entry.PartyImage.replace(/[.]+PNG$/i, '.PNG')])];
    let res;
    for (const t of tries) {
      res = await fetch(`${BASE}/Party_Images/${encodeURIComponent(t)}`, { headers: { 'User-Agent': 'ECOS-results-ingest/1.0' } });
      if (res.ok) break;
    }
    if (!res.ok) { unavailable.push(`${name}: HTTP ${res.status} for ${tries.join(' / ')}`); continue; }
    buf = Buffer.from(await res.arrayBuffer());
    if (buf.subarray(1, 4).toString() !== 'PNG') { failed.push(`${name}: ${entry.PartyImage} is not a PNG`); continue; }
    writeFileSync(dest, buf);
    await new Promise((r) => setTimeout(r, 150));
  }
  emblems[name] = { file: `/party-emblems/${file}`, iecImage: entry.PartyImage, abbreviation: entry.Name, sha256: sha(buf), ...(duplicated.has(norm(name)) ? { chosenFrom: duplicated.get(norm(name)) } : {}) };
}

writeFileSync(
  MANIFEST,
  JSON.stringify(
    {
      source: 'Electoral Commission of South Africa, LGE 2026 results dashboard: party list and party images',
      listUrl: `${BASE}/MapsJason/2026/PartyList.js`,
      listSha256: sha(listText),
      imageUrlPattern: `${BASE}/Party_Images/<iecImage>`,
      retrieved: new Date().toISOString().slice(0, 10),
      emblems,
      missing,
      unavailable,
    },
    null,
    1,
  ),
);
// The ids that have an emblem, for the pages: a few KB, so they never request an image that is not there.
writeFileSync('src/data/lge2026/party-emblem-ids.json', JSON.stringify(Object.keys(emblems).map((n) => partyId(n)).sort()));
console.log(JSON.stringify({ parties: names.size, emblems: Object.keys(emblems).length, missing, unavailable, failed, chosenAmongDuplicates: Object.entries(emblems).filter(([, e]) => e.chosenFrom).map(([n, e]) => `${n}: ${e.iecImage} of ${e.chosenFrom.join(', ')}`) }, null, 1));
if (failed.length) process.exit(1);
