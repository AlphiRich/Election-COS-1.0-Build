/**
 * Election Campaign OS — Voter Intelligence report as a clean, Docs-convertible HTML file, for ANY of the 213 councils.
 *
 *   npx vite-node scripts/build-vi-doc.ts <COUNCIL_CODE> [--out <dir>]     e.g. NW405, BUF, JHB, TSH
 *   npx vite-node scripts/build-vi-doc.ts --list
 *
 * Writes <out>/vi-doc-<code>.html — semantic HTML (headings, tables, paragraphs; no scripts, no web styling) that Google
 * Drive converts cleanly into a Google Doc (create_file, HTML source → application/vnd.google-apps.document). This is the
 * repeatable engine behind "the JB Marks report for any municipality": every figure is COMPUTED from the Commission's
 * certified LGE 2026 results in this repo, never typed per municipality. Unknown code → exit 1, never a made-up report.
 *
 * Structure follows the municipal-electoral-research-report skill, scoped honestly to the data this build holds: 2026
 * certified results + the Schedule 1 engine (reconciled against the Commission's Seat Calculation Detail). Sections the
 * data cannot support — a multi-cycle historical spine, demographics, psychographics, special-vote breakdowns — are named
 * in the Limitations section rather than invented.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { COUNCIL_CODES, NATIONAL_SEATS, PROVINCES, council, loadProvince } from '@/modules/lge2026/nationalResults';
import { seatAllocationOf, seatInputOf, partyLabel, type CouncilTies } from '@/modules/lge2026/councilResults';
import { partyName, voterIntelligence } from '@/modules/lge2026/voterIntelligence';

const args = process.argv.slice(2);
if (args.includes('--list')) {
  for (const c of COUNCIL_CODES) console.log(`${c.padEnd(8)}${NATIONAL_SEATS.councils[c].name}`);
  process.exit(0);
}
const code = (args.find((a) => !a.startsWith('--')) ?? '').toUpperCase();
if (!COUNCIL_CODES.includes(code)) {
  console.error(`"${code}" is not one of the 213 councils. Run with --list.`);
  process.exit(1);
}
const outDir = path.resolve(__dirname, '..', args.includes('--out') ? args[args.indexOf('--out') + 1] : 'reports');

const n = (v: number) => v.toLocaleString('en-ZA');
const p1 = (v: number) => v.toFixed(1);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const today = new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });

const vi = await voterIntelligence(code);
const seats = council(code);
const prov = await loadProvince(seats.province);
const m = prov.municipalities[code];
const ties: CouncilTies | undefined = m.tiedWards ? ({ wards: m.tiedWards } as unknown as CouncilTies) : undefined;
const alloc = seatAllocationOf(m, seats.councillors, ties);
const si = seatInputOf(m, seats.councillors, ties);
const A = alloc.parties.reduce((s, p) => s + p.votes, 0);
// Schedule 1 Item 12 denominator: seats minus ward seats won by independents (C) and by parties with no list (D).
const denom = seats.councillors - si.independentWardSeats - si.noPRListWardSeats;
const provName = PROVINCES[seats.province];
const place = `${seats.name}, ${provName}`;
const holders = [...seats.holders].sort((a, b) => b.seats - a.seats);
const allocByName = new Map(alloc.parties.map((p) => [p.name, p]));

const rows = (body: string) => body;
const th = (s: string, right = false) => `<td style="border:1px solid #c6c5cf;padding:4px 8px;font-weight:700;${right ? 'text-align:right' : ''}">${s}</td>`;
const td = (s: string | number, right = false) => `<td style="border:1px solid #c6c5cf;padding:4px 8px;${right ? 'text-align:right' : ''}">${s}</td>`;

const seatRows = holders
  .map((h) => {
    const a = allocByName.get(h.name);
    const pr = vi.prShares.find((r) => partyLabel(r.party) === h.name || r.party === h.name);
    return `<tr>${td(esc(h.name))}${td(pr ? n(pr.votes) : '—', true)}${td(pr ? p1(pr.share) + '%' : '—', true)}${td(n(h.wardSeats), true)}${td(n(h.seats - h.wardSeats), true)}${td(`<b>${n(h.seats)}</b>`, true)}${td(a ? n(a.quotaEntitlement) : '—', true)}</tr>`;
  })
  .join('');

const coalitionRows = vi.coalitions
  .slice(0, 8)
  .map((c) => `<tr>${td(esc(c.parties.join(' + ')))}${td(n(c.seats), true)}${td('+' + c.surplus, true)}</tr>`)
  .join('');

const turnoutHi = vi.turnoutWards.highest.map((r) => `${r.ward} (${p1(r.turnout)}%)`).join(', ');
const turnoutLo = vi.turnoutWards.lowest.map((r) => `${r.ward} (${p1(r.turnout)}%)`).join(', ');
const ledBy = vi.wardsLedBy.map((w) => `${partyName(w.party)} ${w.wards}`).join('; ');
const competitive =
  vi.competitive.wards.length > 0
    ? `${vi.competitive.wards.length} ward${vi.competitive.wards.length === 1 ? '' : 's'} (${vi.competitive.wards.join(', ')}) were decided by under 10 percentage points, holding ${p1(vi.competitive.electorateShare)}% of the registered electorate between them.`
    : 'No ward was decided by under 10 percentage points.';

const hungLine = seats.hung
  ? `No party holds the ${vi.majority} seats needed to govern alone. The largest, ${vi.topHolder?.name}, holds ${vi.topHolder?.seats}, ${vi.shortOfMajority} short of a majority.`
  : `${vi.topHolder?.name} holds ${vi.topHolder?.seats} of ${seats.councillors} seats, a majority.`;

const html = `<!doctype html><html lang="en-ZA"><head><meta charset="utf-8"><title>${esc(place)} — Voter Intelligence, LGE 2026</title></head><body>
<h1>${esc(seats.name)} Voter Intelligence</h1>
<p><b>${esc(place)}</b> &middot; Municipal code ${code} &middot; ${seats.category === 'A' ? 'Metropolitan municipality' : 'Local municipality'}${seats.district ? ` within ${esc(seats.district)}` : ''} &middot; Local Government Election, 4 November 2026</p>
<p>A Research &amp; Development report &middot; Innovation Consult &middot; ${today}</p>

<h2>Executive summary</h2>
<p style="text-align:justify">${esc(seats.name)} has ${seats.councillors} council seats — ${seats.wards} elected in wards and ${seats.councillors - seats.wards} from party lists. ${esc(hungLine)} Turnout on the proportional ballot was ${p1(seats.turnoutPr)}% of ${n(seats.registered)} registered voters. The seat figures in this report are the Electoral Commission's certified result, reproduced independently by this build's Schedule 1 engine (status: ${seats.iec}).</p>

<h2>Methodology and data provenance</h2>
<p style="text-align:justify">Every figure here is computed from a single primary source: the Electoral Commission of South Africa's certified "Downloadable Party Results" for the 4 November 2026 Local Government Election (electoral event EEID1887), reduced to counts per ballot, party and ward. Seats are allocated by this build's implementation of Schedule 1 of the Local Government: Municipal Structures Act, 1998 (Act 117 of 1998), and reconciled party-by-party against the Commission's own Seat Calculation Detail report; this council reconciles as <b>${seats.iec}</b>. No figure is estimated: where the data does not support a section, the Limitations section says so plainly rather than filling the gap.</p>

<h2>The seat formula, in plain language</h2>
<p style="text-align:justify">A council of ${seats.councillors} seats is filled so that the whole council reflects how people voted. Schedule 1, Item 12 sets a <i>quota</i> — the price of one seat in votes:</p>
<p style="font-family:monospace;background:#f3f3f3;padding:8px 12px;border:1px solid #c6c5cf">Q = ⌊ A ÷ (B − C − D) ⌋ + 1</p>
<p style="text-align:justify">where <b>A</b> is the total valid votes counted for parties, <b>B</b> the ${seats.councillors} seats, and <b>C</b> and <b>D</b> deduct any seats won by independents or by parties that filed no list. For ${esc(seats.name)}: A = ${n(A)} valid votes, B = ${seats.councillors} seats, giving</p>
<p style="font-family:monospace;background:#f3f3f3;padding:8px 12px;border:1px solid #c6c5cf">Q = ⌊ ${n(A)} ÷ ${denom} ⌋ + 1 = <b>${n(alloc.quota)}</b> votes per seat</p>
<p style="text-align:justify">Each party first takes one seat for every full ${n(alloc.quota)} votes it won (its quota entitlement, in the last column of the table below); the seats still unfilled go to the parties with the largest remainders. A party's ward wins count towards its total, so a party that won more wards than its entitlement keeps those wards (Item 16). This is arithmetic laid down in the Act, not a forecast.</p>

<h2>Result and seats</h2>
<table style="border-collapse:collapse;border:1px solid #c6c5cf"><tr>${th('Party')}${th('PR votes', true)}${th('PR share', true)}${th('Ward seats', true)}${th('List seats', true)}${th('Total seats', true)}${th('Quota entitlement', true)}</tr>${rows(seatRows)}</table>
<p>${esc(competitive)}</p>

${
  seats.hung
    ? `<h2>Coalition arithmetic</h2>
<p style="text-align:justify">No party reached ${vi.majority} seats, so a coalition is needed to govern. The combinations below each reach a majority and are <i>minimal</i> — every member is needed; drop any one and the majority is lost. This is what-if arithmetic on seats, not a prediction of what any party will do, and independents are left out because they do not act as a bloc.</p>
<table style="border-collapse:collapse;border:1px solid #c6c5cf"><tr>${th('Parties')}${th('Seats', true)}${th('Over the line', true)}</tr>${coalitionRows}</table>`
    : `<h2>Council control</h2><p>${esc(vi.topHolder?.name ?? '')} holds a majority of the council's seats, so no coalition is required to form a government.</p>`
}

<h2>Ward battlegrounds</h2>
<p style="text-align:justify">Wards led by each party: ${esc(ledBy)}. By the instrument's tiers — Safe (leader above 60%), Comfortable (50–60%), Marginal (40–50%), Contested (below 40%) — the ${seats.wards} wards fall out as: Safe ${vi.tierCounts.Safe}, Comfortable ${vi.tierCounts.Comfortable}, Marginal ${vi.tierCounts.Marginal}, Contested ${vi.tierCounts.Contested}. ${esc(competitive)}</p>

<h2>Turnout</h2>
<p style="text-align:justify">Turnout on the proportional ballot was ${p1(seats.turnoutPr)}%, measured as ballots cast over registered voters on that one ballot (never the two ballots added together). The five highest-turnout wards were ${esc(turnoutHi)}; the five lowest were ${esc(turnoutLo)}.</p>

<h2>Limitations and outstanding data</h2>
<p style="text-align:justify">This report is built from the 4 November 2026 certified result alone. It deliberately does <b>not</b> contain, because the data to support them honestly is not held:</p>
<ul>
<li>A multi-cycle historical spine (2016, 2021, and national elections as swing inputs): this build holds the 2026 certified result; earlier cycles need their own primary IEC files.</li>
<li>Demographic and psychographic voter profiles: no sourced Statistics South Africa ward-level product is loaded, and race-linked profiling of voters is special personal information under POPIA.</li>
<li>Special-vote breakdowns by party: the Commission has not published a party-by-special-vote split for this council.</li>
</ul>
<p>Where any of these is needed, the primary file must be supplied; a figure will not be invented to fill the gap.</p>

<h2>References</h2>
<ol>
<li>Electoral Commission of South Africa, certified results, Local Government Election, 4 November 2026 (${code} — ${esc(place)}). Party results by ballot and ward.</li>
<li>Electoral Commission of South Africa, Seat Calculation Detail, ${code}. Reconciled against this build's Schedule 1 engine.</li>
<li>Local Government: Municipal Structures Act, 1998 (Act 117 of 1998), Schedule 1 (seat allocation) and Item 12 (quota).</li>
</ol>
<p style="font-size:9pt;color:#555">Election-COS is an independent, non-partisan service of Innovation Consult. Not affiliated with the Electoral Commission, any party or any candidate. Seat, coalition and ward figures are calculated from the Commission's certified public results and are not official declarations. Coalition scenarios are what-if arithmetic, not forecasts. Generated ${today}.</p>
</body></html>`;

mkdirSync(outDir, { recursive: true });
const file = path.join(outDir, `vi-doc-${code.toLowerCase()}.html`);
writeFileSync(file, html);
console.log(`Wrote ${file} (${(html.length / 1024).toFixed(1)} KB). Quota ${n(alloc.quota)}, ${seats.councillors} seats, turnout ${p1(seats.turnoutPr)}%.`);
