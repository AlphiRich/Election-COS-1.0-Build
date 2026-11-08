/**
 * Election Campaign OS — Daily Ground Intelligence (a generated report, not a screen)
 *
 * From a supplied newsletter preview: an aggregate of what the field
 * reported, with small groups suppressed, a seat-calculation explainer
 * that declines to calculate, and a compliance notice. Built here as a
 * function that returns a stand-alone HTML document, downloaded from the
 * Sentiment Summary page. It is generated in the browser: no mail is sent
 * and nothing is transmitted.
 *
 * SOURCE
 * Incidents the field logged (ward + category). Those are the only
 * per-ward field signals this build holds as records. The supplied preview
 * showed a survey answer ("Top priority? Service delivery"); this build
 * has no such survey, so none is reported and none is invented.
 *
 * SUPPRESSION
 * A cell with fewer than `MIN_CELL` (5) is not shown, and no per-ward total
 * is shown either, because a total beside a single suppressed cell lets a
 * reader subtract and recover it. The report says that cells were
 * suppressed and how many, never which count they held.
 *
 * Suppression reduces disclosure risk; it does not replace a privacy
 * assessment. The notice says so, in the preview's words.
 */
import type { Incident } from '@/dal/ports/incidents';
import { tokens } from '@/design/tokens';

export const MIN_CELL = 5;

export const CATEGORY_LABEL: Record<Incident['category'], string> = {
  WATER_SANITATION: 'Water and sanitation',
  ELECTRICITY: 'Electricity',
  ROADS_TRANSPORT: 'Roads and transport',
  PUBLIC_SAFETY: 'Public safety',
};

export const SEAT_EXPLAINER =
  'A local council has ward seats, won by the most votes in each ward, and party-list seats. Under ' +
  'Schedule 1 of the Municipal Structures Act the quota is Q = (A / (B - C)) + 1, fractions disregarded, ' +
  'where A is the valid votes cast for parties on the party and ward ballots, B is the number of seats in ' +
  'the council and C is the number of independent ward councillors elected. Each party\'s votes divided by ' +
  'Q give its seats; surplus seats go to the highest remainders; and a party\'s ward seats are deducted from ' +
  'its entitlement to leave its list seats. This report does not calculate official seat allocations: the ' +
  'Electoral Commission publishes them after every election.';

/** Voter education notice carried from the supplied newsletter. SMS to 32810 is the Commission's own registration check. */
export const VOTER_EDUCATION_NOTICE =
  'To vote in a local government election you must be registered on the certified voters\' roll for your ' +
  'voting district. Check your registration status at elections.org.za or by SMS of your ID number to 32810 ' +
  '(SMS charges may apply). Information here follows the Electoral Commission\'s published guidance.';

export const COMPLIANCE_NOTICE =
  'Check current IEC requirements and applicable privacy obligations before distribution. Use only ' +
  'responses collected with valid, documented consent. This report is informational, not legal ' +
  'advice. Do not include directly identifying or free-text voter data. Groups smaller than ' +
  `${MIN_CELL} are suppressed; suppression reduces disclosure risk but does not replace a privacy assessment.`;

export interface WardSignals {
  wardCode: string;
  shown: Array<{ category: string; count: number }>;
  suppressedCells: number;
}

/** One ward and voting district's doorstep sentiment, when a source for it exists. */
export interface SentimentRow {
  ward: string;
  vd: string;
  /** Average on a 1 to 5 scale. */
  avg: number;
  issue: string;
  polled: number;
}

export interface GroundIntelligence {
  period: string;
  generatedAt: string;
  wards: WardSignals[];
  incidentsConsidered: number;
}

/** Aggregate incidents to ward × category cells and suppress small ones. */
export function buildGroundIntelligence(
  incidents: Incident[],
  period: string,
  now: Date,
): GroundIntelligence {
  const cells = new Map<string, Map<Incident['category'], number>>();
  let considered = 0;
  for (const i of incidents) {
    if (i.createdAt.slice(0, 7) !== period) continue;
    considered++;
    const w = cells.get(i.wardCode) ?? new Map<Incident['category'], number>();
    w.set(i.category, (w.get(i.category) ?? 0) + 1);
    cells.set(i.wardCode, w);
  }
  const wards: WardSignals[] = [...cells.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([wardCode, byCat]) => {
      const shown = [...byCat.entries()]
        .filter(([, n]) => n >= MIN_CELL)
        .map(([c, n]) => ({ category: CATEGORY_LABEL[c], count: n }))
        .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
      return { wardCode, shown, suppressedCells: byCat.size - shown.length };
    });
  return { period, generatedAt: now.toISOString(), wards, incidentsConsidered: considered };
}

/**
 * The ward and voting-district sentiment table from the supplied newsletter. A row built on fewer than MIN_CELL people shows
 * neither its average nor its issue (the supplied preview showed averages for 1 and 2 people, which identifies them). This build
 * holds sentiment tenant-wide only and polls are anonymous, so today no rows are passed and the section says so.
 */
export function sentimentTableHtml(rows: SentimentRow[]): string {
  if (!rows.length) {
    return '<section class="card"><p class="eyebrow">SENTIMENT AND ISSUES BY WARD AND VOTING DISTRICT</p><p>No sentiment by ward or voting district is held: the application keeps sentiment for the whole tenant only, and polls are anonymous and carry no ward. This section fills only when a consented, ward-level source exists.</p></section>';
  }
  const body = rows
    .map((r) =>
      r.polled < MIN_CELL
        ? `<tr><td>${esc(r.ward)}</td><td>${esc(r.vd)}</td><td colspan="3">Hidden: fewer than ${MIN_CELL} people</td></tr>`
        : `<tr><td>${esc(r.ward)}</td><td>${esc(r.vd)}</td><td>${r.avg.toFixed(1)} / 5.0</td><td>${esc(r.issue)}</td><td>${r.polled}</td></tr>`,
    )
    .join('');
  return `<section class="card"><p class="eyebrow">SENTIMENT AND ISSUES BY WARD AND VOTING DISTRICT</p><table><thead><tr><th>Ward</th><th>VD</th><th>Average sentiment</th><th>Primary issue</th><th>Polled</th></tr></thead><tbody>${body}</tbody></table></section>`;
}

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

/** A self-contained HTML document: no scripts, no external requests. */
export function groundIntelligenceHtml(g: GroundIntelligence, sentiment: SentimentRow[] = []): string {
  const cards = g.wards.length
    ? g.wards
        .map(
          (w) =>
            `<section class="card"><p class="eyebrow">${esc(w.wardCode)}</p><h2>Reported by the field</h2>${
              w.shown.length
                ? `<ul>${w.shown.map((s) => `<li><span>${esc(s.category)}</span><strong>${s.count}</strong></li>`).join('')}</ul>`
                : '<p>No category reached the minimum group size.</p>'
            }${
              w.suppressedCells
                ? `<p class="small">${w.suppressedCells} smaller group${w.suppressedCells === 1 ? '' : 's'} not shown.</p>`
                : ''
            }</section>`,
        )
        .join('\n')
    : '<div class="empty"><p>No field signals were logged for this period.</p></div>';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Daily Ground Intelligence ${esc(g.period)}</title>
<style>body{margin:0;background:${tokens.color.paper};color:${tokens.color.ink};font:16px/1.65 Arial,sans-serif}main{max-width:760px;margin:0 auto;padding:32px 20px}header{border-bottom:3px solid ${tokens.color.gold};padding-bottom:20px}h1,h2{line-height:1.2}h1{margin:0;font-size:2rem}h2{margin:4px 0 12px;font-size:1.25rem}.eyebrow{color:${tokens.color.teal};font-size:.85rem;font-weight:600}.card{margin:20px 0;padding:20px;border:1px solid ${tokens.color.line};border-radius:8px;background:white}ul{margin:0;padding:0;list-style:none}li{display:flex;justify-content:space-between;gap:16px;padding:8px 0;border-top:1px solid ${tokens.color.line}}strong{font-family:Consolas,monospace}.small{color:${tokens.color.slate};font-size:.9rem}.notice{margin-top:28px;padding:16px;border-left:4px solid ${tokens.color.gold};background:white}.empty{padding:18px;background:white}footer{margin-top:24px;color:${tokens.color.slate};font-size:.9rem}</style></head>
<body><main>
<header><p class="eyebrow">GROUND INTELLIGENCE</p><h1>Daily Ground Intelligence</h1><p>Reporting period: ${esc(g.period)}</p></header>
<h2>Aggregated field signals</h2>
${cards}
${sentimentTableHtml(sentiment)}
<aside class="notice"><strong>Voter education notice</strong><br>${esc(VOTER_EDUCATION_NOTICE)}</aside>
<section class="card"><p class="eyebrow">SEAT CALCULATION EXPLAINER</p><h2>From votes to representation</h2><p>${esc(SEAT_EXPLAINER)}</p></section>
<aside class="notice"><strong>Compliance and data notice</strong><br>${esc(COMPLIANCE_NOTICE)}</aside>
<footer>Generated ${esc(g.generatedAt)} in the browser. No email is sent and no data is transmitted.</footer>
</main></body></html>`;
}
