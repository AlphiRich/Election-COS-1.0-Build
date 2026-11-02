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
  'Seat allocation depends on the applicable statutory method, verified election inputs, ward ' +
  'results and any required remainder or overhang treatment. This report does not calculate ' +
  'official seat allocations. Confirm the governing rules and figures with the IEC or a qualified ' +
  'adviser before relying on a calculation.';

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

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

/** A self-contained HTML document: no scripts, no external requests. */
export function groundIntelligenceHtml(g: GroundIntelligence): string {
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
<section class="card"><p class="eyebrow">SEAT CALCULATION EXPLAINER</p><h2>From votes to representation</h2><p>${esc(SEAT_EXPLAINER)}</p></section>
<aside class="notice"><strong>Compliance and data notice</strong><br>${esc(COMPLIANCE_NOTICE)}</aside>
<footer>Generated ${esc(g.generatedAt)} in the browser. No email is sent and no data is transmitted.</footer>
</main></body></html>`;
}
