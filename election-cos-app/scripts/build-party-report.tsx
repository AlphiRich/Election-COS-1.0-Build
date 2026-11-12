/**
 * Election Campaign OS — standalone report: one party's candidates and result in one municipality.
 * Renders the same charts and the same computed facts/insights as /analytics/lge-2026-party, so the two cannot differ.
 *   npx vite-node scripts/build-party-report.tsx [MUNICIPALITY] [PARTY]     (default NW405 ACTIONSA)
 * Output: reports/<party>-<municipality>.html (self-contained, fonts embedded) and a PNG preview.
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { tokens } from '../src/design/tokens';
import { ListDepthChart, PositionChart, WardShareChart } from '../src/modules/lge2026/PartyCharts';
import { LIST_PROVENANCE, partyProfile, profileFacts, profileInsights, reconcileAppCopies } from '../src/modules/lge2026/partyProfile';
import { partyLabel } from '../src/modules/lge2026/lge2026Results';

const { chromium } = createRequire(import.meta.url)('playwright') as typeof import('playwright');
const C = tokens.color;
const ROOT = path.resolve(__dirname, '..');
const code = process.argv[2] ?? 'NW405';
const party = process.argv[3] ?? 'ACTIONSA';
const P = partyProfile(code, party);
const n = (v: number) => v.toLocaleString('en-ZA');
const p1 = (v: number) => v.toFixed(1);
const ord = (k: number) => `${k}${['th', 'st', 'nd', 'rd'][k % 10 > 3 || Math.floor(k / 10) === 1 ? 0 : k % 10]}`;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const font = (f: string, w: number, fam: string) => `@font-face{font-family:'${fam}';font-weight:${w};src:url(data:font/woff2;base64,${readFileSync(path.join(ROOT, 'public/fonts', f)).toString('base64')}) format('woff2')}`;
const recon = code === 'NW405' ? reconcileAppCopies(party) : null;

const headline = [
  `${P.label} put up ${P.wardCandidates.length} ward candidates in ${P.municipality}, led in ${P.wardCandidates.filter((c) => c.position === 1).length}, and won ${P.seats.total} council seats, all from the list vote.`,
  `The Commission's published PR list for ${P.label} here has ${P.prList.length} name${P.prList.length === 1 ? '' : 's'}${P.listDepth.unfilled > 0 ? `; it won ${P.seats.pr} list seats, so ${P.listDepth.unfilled} cannot be named from the published list` : ''}.`,
  `Best ward ${P.wardCandidates.slice().sort((a, b) => b.share - a.share)[0].ward} at ${p1(Math.max(...P.wardCandidates.map((c) => c.share)))}%; overall ${p1(P.ballots.pr.sharePct)}% of the PR vote.`,
];

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(P.label)} in ${esc(P.municipality)}: candidates and result</title><style>
${font('public-sans-400-normal-latin.woff2', 400, 'Public Sans')}${font('public-sans-700-normal-latin.woff2', 700, 'Public Sans')}${font('archivo-narrow-700-normal-latin.woff2', 700, 'Archivo Narrow')}${font('ibm-plex-mono-500-normal-latin.woff2', 500, 'IBM Plex Mono')}
*{box-sizing:border-box}body{margin:0;background:${C.paper};color:${C.ink};font:16px/1.5 'Public Sans',sans-serif}
main{max-width:980px;margin:0 auto;padding:24px 16px 64px}
h1{font:700 34px/1.1 'Archivo Narrow',sans-serif;margin:4px 0 6px}h2{font:700 13px 'Archivo Narrow',sans-serif;letter-spacing:.1em;text-transform:uppercase;color:${C.slate};margin:0 0 10px}
.kick{font:500 12px 'IBM Plex Mono',monospace;color:${C.slate}}
.card{background:white;border:1px solid ${C.line};border-radius:10px;padding:18px;margin:16px 0}.accent{border-color:${C.gold}}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin:16px 0}.tile{background:white;border:1px solid ${C.line};border-radius:10px;padding:12px 14px}
.tile b{display:block;font:700 26px 'Archivo Narrow',sans-serif}.tile span{font-size:13px;color:${C.slate}}
ul,ol{margin:6px 0;padding-left:20px}li{margin:5px 0}
.wrap{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:14px}th{font:700 11px 'Archivo Narrow';letter-spacing:.1em;text-transform:uppercase;color:${C.slate};text-align:left;border-bottom:1px solid ${C.line};padding:6px 8px;white-space:nowrap}
td{border-bottom:1px solid ${C.line};padding:6px 8px}td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}
.warn{color:${C.maroon}}.mono{font-family:'IBM Plex Mono',monospace;font-size:12px}small{color:${C.slate}}
</style></head><body><main>
<div class="kick">${esc(code)} ${esc(P.municipality)} · LGE 2026 · Election-COS</div>
<h1>${esc(P.label)} in ${esc(P.municipality)}: candidates and result</h1>
<div class="card accent"><h2>The short answer</h2><ul>${headline.map((h) => `<li>${esc(h)}</li>`).join('')}</ul></div>

<div class="card"><h2>How the list was obtained and checked</h2><ol>
<li>The Commission publishes certified candidate lists as PDFs by province. This is the North West list of 23 Oct 2026, "as supplemented" after the Constitutional Court order in CCT 282/26.</li>
<li>Fetched from the Commission's site on ${LIST_PROVENANCE.fetchedOn} and again on 9 Nov 2026: both ${n(LIST_PROVENANCE.bytes)} bytes, same SHA-256 <span class="mono">${LIST_PROVENANCE.sha256.slice(0, 16)}…</span>.</li>
<li>Inside the PDF, rows are grouped by municipality: Dr Kenneth Kaunda (DC40) is the district and JB Marks (NW405) sits within it. Each row is a candidate with a ward id or a list rank.</li>
<li>${esc(P.label)}'s rows were re-read from the PDF text independently of the app's stored copy and compared row for row${recon ? `: ${recon.iec} in the ingest, ${recon.reference} in the reference file, ${recon.onlyIec.length + recon.onlyReference.length} differences` : ''}.</li>
<li>Candidates were joined to the ward and list results for the same municipality, and the seats are Schedule 1 over the Commission's ballots (reconciled to its own seat calculation).</li></ol>
<small>Names and places are as printed. Identity numbers are never read or shown. The website's navigation pages block automated access; the document itself was fetched directly.</small></div>

<div class="tiles"><div class="tile"><b>${P.candidates}</b><span>entries · ${P.wardCandidates.length} ward · ${P.prList.length} list · ${P.distinctPeople} people</span></div>
<div class="tile"><b>${P.seats.total}</b><span>seats · ${P.seats.ward} ward · ${P.seats.pr} list</span></div>
<div class="tile"><b>${p1(P.ballots.pr.sharePct)}%</b><span>PR ballot · ${n(P.ballots.pr.votes)} votes</span></div>
<div class="tile"><b>${p1(P.ballots.ward.sharePct)}%</b><span>ward ballot · ${n(P.ballots.ward.votes)} votes</span></div></div>

<div class="card"><h2>Facts</h2><ul>${profileFacts(P).map((f) => `<li>${esc(f)}</li>`).join('')}</ul></div>

<div class="card"><h2>PR councillor candidate list, ${esc(P.municipality)}</h2><div class="wrap"><table><thead><tr><th class="n">Rank</th><th>Candidate</th><th>Also printed as</th></tr></thead><tbody>
${P.prList.map((e) => `<tr><td class="n mono">${e.rank}</td><td>${esc(e.name)}</td><td>${e.alsoWard.length ? e.alsoWard.map((w) => `Ward ${w}`).join(', ') : 'none'}</td></tr>`).join('')}</tbody></table></div>
${P.listDepth.unfilled > 0 ? `<p class="warn">${esc(P.label)} won ${P.seats.pr} list seats. The published list has ${P.listDepth.eligible} eligible name${P.listDepth.eligible === 1 ? '' : 's'}, so ${P.listDepth.unfilled} seat${P.listDepth.unfilled === 1 ? '' : 's'} cannot be named from it. No names have been invented.</p>` : ''}
<small>District council (${P.districtList.code}, a separate ballot): ${P.districtList.entries.map((e) => `${e.rank}. ${esc(e.name)}`).join('; ') || 'no list'}.</small></div>

<div class="card"><h2>Ward candidates and ward results</h2><div class="wrap"><table><thead><tr><th class="n">Ward</th><th>Candidate</th><th class="n">Votes</th><th class="n">Share</th><th>Finished</th><th class="n">Behind leader</th><th>Ward leader</th></tr></thead><tbody>
${P.wardCandidates.map((c) => `<tr><td class="n mono">${c.ward}</td><td>${esc(c.name)}${c.alsoOn.length ? ` <small>(also ${c.alsoOn.join(', ')})</small>` : ''}</td><td class="n">${n(c.votes)}</td><td class="n">${p1(c.share)}%</td><td>${c.position === 1 ? 'Led' : ord(c.position)}</td><td class="n">${c.position === 1 ? '—' : n(c.gapToWinner)}</td><td>${esc(partyLabel(c.winner))}</td></tr>`).join('')}</tbody></table></div></div>

<div class="card"><h2>Share of the ward vote, by ward</h2>${renderToStaticMarkup(<WardShareChart wards={P.wardCandidates} title={`${P.label}: share of the valid ward vote in each ward, coloured by finishing position`} />)}</div>
<div class="card"><h2>Wards by finishing position</h2><div style="max-width:420px">${renderToStaticMarkup(<PositionChart positions={P.wardPositions} total={P.wardCandidates.length} />)}</div></div>
<div class="card"><h2>List seats against names on the list, every party</h2>${renderToStaticMarkup(<ListDepthChart rows={P.peers} highlight={P.party} />)}</div>

<div class="card accent"><h2>Analytical insights</h2><ul>${profileInsights(P).map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
<small>Description, not prediction. Verify with <span class="mono">python3 -I tools/candidates/verify-party-list.py --muni ${code} --party ${party}</span>.</small></div>
</main></body></html>`;

async function main() {
  const base = `${party.toLowerCase()}-${code.toLowerCase()}`;
  writeFileSync(path.join(ROOT, 'reports', `${base}.html`), html);
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1000, height: 900 }, deviceScaleFactor: 1 });
  await page.goto(`file://${path.join(ROOT, 'reports', `${base}.html`)}`);
  await page.screenshot({ path: path.join(ROOT, 'reports', `${base}.png`), fullPage: true });
  await b.close();
  console.log(`reports/${base}.html (${(html.length / 1024).toFixed(0)} KB)`);
}
main();
