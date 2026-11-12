/**
 * Election Campaign OS — the Voter Intelligence Instrument as a standalone report, for any council.
 *   npx vite-node scripts/build-voter-intelligence.ts <COUNCIL_CODE> [--out reports]   e.g. NW405, BUF, JHB, TSH
 *   npx vite-node scripts/build-voter-intelligence.ts --list                           every code, name and province
 * Writes <out>/voter-intelligence-<code>.html (self-contained, no scripts, fonts embedded) and .json (the same figures).
 * Same computation as /analytics/voter-intelligence (src/modules/lge2026/voterIntelligence.ts); read its header for what
 * is computed and what is deliberately absent. Exit 1 on an unknown code, never a made-up report.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tokens } from '../src/design/tokens';
import { COUNCIL_CODES, NATIONAL_SEATS, PROVINCES } from '../src/modules/lge2026/nationalResults';
import { partyLabel } from '../src/modules/lge2026/councilResults';
import { partyName, voterIntelligence } from '../src/modules/lge2026/voterIntelligence';

const C = tokens.color;
const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
if (args.includes('--list')) {
  for (const c of COUNCIL_CODES) console.log(`${c.padEnd(8)}${NATIONAL_SEATS.councils[c].name.padEnd(34)}${PROVINCES[NATIONAL_SEATS.councils[c].province]}`);
  process.exit(0);
}
const code = (args.find((a) => !a.startsWith('--')) ?? '').toUpperCase();
if (!COUNCIL_CODES.includes(code)) {
  console.error(`"${code}" is not one of the 213 councils. Run with --list to see the codes.`);
  process.exit(1);
}
const outDir = path.resolve(ROOT, args.includes('--out') ? args[args.indexOf('--out') + 1] : 'reports');
const n = (v: number) => v.toLocaleString('en-ZA');
const p1 = (v: number) => v.toFixed(1);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const font = (f: string, w: number, fam: string) => `@font-face{font-family:'${fam}';font-weight:${w};src:url(data:font/woff2;base64,${readFileSync(path.join(ROOT, 'public/fonts', f)).toString('base64')}) format('woff2')}`;

async function main() {
  const v = await voterIntelligence(code);
  mkdirSync(outDir, { recursive: true });
  const base = path.join(outDir, `voter-intelligence-${code.toLowerCase()}`);
  writeFileSync(`${base}.json`, JSON.stringify(v, null, 2));
  const tierColour = { Safe: C.ink, Comfortable: C.teal, Marginal: C.gold, Contested: C.maroon } as const;
  const strip = v.wards.map((w) => `<i title="Ward ${w.ward}: ${esc(partyName(w.leader))}, ${p1(w.leaderShare)}%" style="background:${tierColour[w.tier]}"></i>`).join('');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(v.name)}: Voter Intelligence, LGE 2026</title><style>
${font('public-sans-400-normal-latin.woff2', 400, 'Public Sans')}${font('public-sans-700-normal-latin.woff2', 700, 'Public Sans')}${font('archivo-narrow-700-normal-latin.woff2', 700, 'Archivo Narrow')}
*{box-sizing:border-box}body{margin:0;background:${C.paper};color:${C.ink};font:16px/1.5 'Public Sans',sans-serif}main{max-width:980px;margin:0 auto;padding:24px 16px 64px}
h1{font:700 34px/1.1 'Archivo Narrow',sans-serif;margin:4px 0}h2{font:700 13px 'Archivo Narrow',sans-serif;letter-spacing:.1em;text-transform:uppercase;color:${C.slate};margin:0 0 10px}
.card{background:#fff;border:1px solid ${C.line};border-radius:10px;padding:18px;margin:16px 0}.accent{border-color:${C.gold}}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px}.tile{background:#fff;border:1px solid ${C.line};border-radius:10px;padding:12px 14px}.tile b{display:block;font:700 26px 'Archivo Narrow'}.tile span{font-size:13px;color:${C.slate}}
.wrap{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:14px}th{font:700 11px 'Archivo Narrow';letter-spacing:.1em;text-transform:uppercase;color:${C.slate};text-align:left;border-bottom:1px solid ${C.line};padding:6px 8px;white-space:nowrap}td{border-bottom:1px solid ${C.line};padding:6px 8px}.n{text-align:right;font-variant-numeric:tabular-nums}
.strip{display:flex;gap:2px;height:34px;margin:10px 0}.strip i{flex:1;border-radius:2px}.leg{display:flex;flex-wrap:wrap;gap:4px 16px;font-size:13px;color:${C.slate}}.leg b{display:inline-block;width:12px;height:12px;border-radius:2px;margin-right:6px;vertical-align:-1px}small{color:${C.slate}}
</style></head><body><main>
<small>${esc(v.code)} · ${esc(PROVINCES[v.province])} · LGE 2026 · Election-COS</small>
<h1>${esc(v.name)}: Voter Intelligence</h1>
<div class="card ${v.seats.hung ? 'accent' : ''}"><h2>${v.seats.hung ? 'Hung council: a coalition is required' : 'One party holds a majority'}</h2>
<p>${esc(v.name)} has ${v.seats.councillors} seats; ${v.majority} are needed to govern alone. ${esc(v.topHolder?.name ?? '')} holds ${v.topHolder?.seats ?? 0}${v.shortOfMajority ? `, ${v.shortOfMajority} short of a majority` : ''}.</p>
${v.iecStatus !== 'reconciled' ? `<p style="color:${C.maroon}">The Commission's own seat report for this council is "${v.iecStatus}", so these seats are not fully confirmed by it.</p>` : ''}</div>
<div class="tiles"><div class="tile"><b>${n(v.seats.councillors)}</b><span>seats · ${v.seats.wards} ward · ${v.seats.councillors - v.seats.wards} list</span></div><div class="tile"><b>${v.majority}</b><span>majority line</span></div><div class="tile"><b>${n(v.seats.registered)}</b><span>registered · turnout ${p1(v.seats.turnoutPr)}% (PR ballot)</span></div><div class="tile"><b>${v.competitive.wards.length}</b><span>wards within 10 points · ${p1(v.competitive.electorateShare)}% of voters</span></div></div>
<div class="card"><h2>Who holds the seats</h2><div class="wrap"><table><thead><tr><th>Party</th><th class="n">Seats</th><th class="n">Ward</th></tr></thead><tbody>${[...v.seats.holders].sort((a, b) => b.seats - a.seats).map((h) => `<tr><td>${esc(h.name)}</td><td class="n">${h.seats}</td><td class="n">${h.wardSeats}</td></tr>`).join('')}</tbody></table></div></div>
${v.coalitions.length ? `<div class="card"><h2>Coalition arithmetic</h2><div class="wrap"><table><thead><tr><th>Parties</th><th class="n">Seats</th><th class="n">Over the line</th></tr></thead><tbody>${v.coalitions.map((c) => `<tr><td>${esc(c.parties.join(' + '))}</td><td class="n">${c.seats}</td><td class="n">+${c.surplus}</td></tr>`).join('')}</tbody></table></div><small>Smallest combinations where no member could leave and still leave a majority. What-if arithmetic on seats, not a forecast.</small></div>` : ''}
<div class="card"><h2>The ward map in numbers</h2><div class="strip" role="img" aria-label="Wards in order, coloured by tier">${strip}</div><div class="leg">${(Object.keys(tierColour) as Array<keyof typeof tierColour>).map((t) => `<span><b style="background:${tierColour[t]}"></b>${t}: ${v.tierCounts[t]}</span>`).join('')}</div>
<p>${v.wardsLedBy.slice(0, 4).map((w) => `${esc(partyName(w.party))} led ${w.wards}`).join('; ')}.</p>
<div class="wrap"><table><thead><tr><th class="n">Ward</th><th>Leader</th><th class="n">Share</th><th class="n">Margin</th><th>Tier</th><th>Runner-up</th></tr></thead><tbody>${v.wards.map((w) => `<tr><td class="n">${w.ward}</td><td>${esc(partyName(w.leader))}</td><td class="n">${p1(w.leaderShare)}%</td><td class="n">${p1(w.margin)} pts</td><td>${w.tier}</td><td>${w.runnerUp ? esc(partyLabel(w.runnerUp)) : '—'}</td></tr>`).join('')}</tbody></table></div></div>
<div class="card"><h2>What this instrument does not have</h2><ul><li>Demographics (race, age, gender): not in this build.</li><li>"Psychographic" voter segments: not derivable from results, and race-linked profiling is a POPIA special-personal-information question.</li><li>Special-vote counts and any trend before 2021: not ingested.</li></ul><small>Source: ${esc(v.source)}.</small></div>
</main></body></html>`;
  writeFileSync(`${base}.html`, html);
  console.log(`${base}.html (${(html.length / 1024).toFixed(0)} KB) and .json`);
}
main();
