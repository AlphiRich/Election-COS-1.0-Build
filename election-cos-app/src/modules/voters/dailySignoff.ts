/**
 * Election Campaign OS — VD Captain daily sign-off (a file, not a screen)
 *
 * From a supplied note describing a "Captain Telemetry" worksheet: an
 * end-of-day count a VD captain signs, and a JSON form of it for the
 * analytics side. Built from records this app already holds instead of a
 * second place to type numbers into, so it cannot disagree with the round.
 *
 * WHAT THE NOTE ASKED FOR THAT IS NOT HERE, AND WHY
 *   - "Pledges" and a pledge-conversion rate with CRITICAL below 35 % and
 *     WARNING below 45 %. This build has no pledge concept (it records
 *     consented voters with a sentiment tier), and the two thresholds have
 *     no source; the note itself asks for them to be adjusted. Inventing a
 *     pledge from a sentiment tier would turn a volunteer's guess into a
 *     figure someone is graded on. The alert threshold here is therefore a
 *     parameter that is OFF until the campaign sets one.
 *   - A per-canvasser league table. The human-centred audit (§7.2, metric 8)
 *     treats an unusual per-canvasser pattern as a calibration question for
 *     a supervisor, not a score. The sign-off is for the district.
 *   - A "POPIA §4.3" checklist item: the section reference is not one this
 *     build can verify, so it is not repeated.
 *
 * NO NAMES, NO IDS. Counts only; safe to hand on.
 */
import type { Household } from '@/dal/ports/households';
import type { Incident } from '@/dal/ports/incidents';
import type { Voter } from '@/dal/ports/voters';

export const SIGNOFF_SCHEMA = 'ecos.vd-signoff/1';

export type SignoffAlert = 'OK' | 'SYNC_PENDING' | 'REVIEW_CAPTURE_RATE';

export interface Signoff {
  schema: typeof SIGNOFF_SCHEMA;
  day: string; // YYYY-MM-DD, SAST
  wardCode: string;
  vdCode: string;
  generatedAt: string;
  doors: {
    contacted: number;
    noAnswer: number;
    inaccessible: number;
    askedNotToBeContacted: number;
    total: number;
  };
  capturedWithConsent: number;
  supportiveResponses: number;
  /** Consented captures per contacted door. Null until a door is contacted. Can exceed 1: one door, several voters. */
  capturesPerContact: number | null;
  incidentsByCategory: Record<string, number>;
  pendingSync: number | null;
  alert: SignoffAlert;
}

/** The SAST calendar day an instant falls on. */
export function sastDay(iso: string): string {
  return new Date(new Date(iso).getTime() + 2 * 3_600_000).toISOString().slice(0, 10);
}

export interface SignoffInput {
  day: string;
  wardCode: string;
  vdCode: string;
  households: Pick<Household, 'wardCode' | 'vdCode' | 'contactStatus' | 'lastContactedAt'>[];
  voters: Pick<
    Voter,
    'wardCode' | 'vdCode' | 'createdAt' | 'sentiment' | 'popiaConsentGiven' | 'deletedAt'
  >[];
  incidents: Pick<Incident, 'wardCode' | 'category' | 'createdAt'>[];
  /** Device-local outbox depth; null if it could not be read. */
  pendingSync: number | null;
  /** Set by the campaign. Absent means no capture-rate alert is raised. */
  reviewBelowCapturesPerContact?: number;
  now: Date;
}

export function buildSignoff(i: SignoffInput): Signoff {
  const inVd = (r: { wardCode: string; vdCode?: string }) =>
    r.wardCode === i.wardCode && (r.vdCode === undefined || r.vdCode === i.vdCode);
  const doors = { contacted: 0, noAnswer: 0, inaccessible: 0, askedNotToBeContacted: 0, total: 0 };
  for (const h of i.households) {
    if (!inVd(h) || !h.lastContactedAt || sastDay(h.lastContactedAt) !== i.day) continue;
    doors.total++;
    if (h.contactStatus === 'CONTACTED') doors.contacted++;
    else if (h.contactStatus === 'NO_ANSWER') doors.noAnswer++;
    else if (h.contactStatus === 'INACCESSIBLE') doors.inaccessible++;
    else if (h.contactStatus === 'REFUSED_RECONTACT') doors.askedNotToBeContacted++;
  }
  let captured = 0;
  let supportive = 0;
  for (const v of i.voters) {
    if (!inVd(v) || v.deletedAt || !v.popiaConsentGiven || sastDay(v.createdAt) !== i.day) continue;
    captured++;
    if (v.sentiment === 'STRONG_SUPPORT' || v.sentiment === 'LEAN_SUPPORT') supportive++;
  }
  const incidentsByCategory: Record<string, number> = {};
  for (const n of i.incidents) {
    if (n.wardCode !== i.wardCode || sastDay(n.createdAt) !== i.day) continue;
    incidentsByCategory[n.category] = (incidentsByCategory[n.category] ?? 0) + 1;
  }
  const capturesPerContact = doors.contacted > 0 ? captured / doors.contacted : null;
  let alert: SignoffAlert = 'OK';
  if (i.pendingSync !== null && i.pendingSync > 0) alert = 'SYNC_PENDING';
  else if (
    i.reviewBelowCapturesPerContact !== undefined &&
    capturesPerContact !== null &&
    capturesPerContact < i.reviewBelowCapturesPerContact
  ) {
    alert = 'REVIEW_CAPTURE_RATE';
  }
  return {
    schema: SIGNOFF_SCHEMA,
    day: i.day,
    wardCode: i.wardCode,
    vdCode: i.vdCode,
    generatedAt: i.now.toISOString(),
    doors,
    capturedWithConsent: captured,
    supportiveResponses: supportive,
    capturesPerContact,
    incidentsByCategory,
    pendingSync: i.pendingSync,
    alert,
  };
}

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

const ALERT_TEXT: Record<SignoffAlert, string> = {
  OK: 'Nothing flagged.',
  SYNC_PENDING:
    'Some work is still waiting on a phone. Do not sign off until each canvasser has synced: records still on a handset are not yet with the campaign.',
  REVIEW_CAPTURE_RATE:
    'Captures per contact are below the level your campaign set for review. This is a question about the script and the doorstep, not about a person.',
};

/** A printable, stand-alone sign-off sheet. No script, no external request. */
export function signoffHtml(s: Signoff): string {
  const row = (k: string, v: string | number) =>
    `<tr><th scope="row">${esc(k)}</th><td>${esc(String(v))}</td></tr>`;
  const cats = Object.entries(s.incidentsByCategory);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>VD sign-off ${esc(s.vdCode)} ${esc(s.day)}</title>
<style>body{font:16px/1.6 Arial,sans-serif;color:#1A2246;margin:0;background:#fff}main{max-width:720px;margin:0 auto;padding:28px 20px}h1{margin:0 0 4px;font-size:1.6rem}table{width:100%;border-collapse:collapse;margin:12px 0}th,td{text-align:left;padding:8px 10px;border-top:1px solid #D6D1C8}th{width:60%;font-weight:600}.note{border-left:4px solid #B7913F;padding:10px 14px;background:#F7F4EE;margin:16px 0}.sig{display:flex;gap:24px;margin-top:36px}.sig div{flex:1;border-top:1px solid #1A2246;padding-top:6px;font-size:.9rem}@media print{main{padding:0}}</style></head>
<body><main>
<h1>VD Captain daily sign-off</h1>
<p>Ward ${esc(s.wardCode)} · Voting district ${esc(s.vdCode)} · ${esc(s.day)}</p>
<table><caption class="sr-only">Counts for the day</caption>
${row('Doors worked', s.doors.total)}${row('Contacted', s.doors.contacted)}${row('No answer', s.doors.noAnswer)}${row('Could not be reached', s.doors.inaccessible)}${row('Asked not to be contacted', s.doors.askedNotToBeContacted)}
${row('People recorded with consent', s.capturedWithConsent)}${row('Of those, leaning or strongly supportive', s.supportiveResponses)}
${row('Recorded per contacted door', s.capturesPerContact === null ? 'not yet' : s.capturesPerContact.toFixed(2))}
${row('Work still waiting on a phone', s.pendingSync === null ? 'could not be read' : s.pendingSync)}
</table>
${cats.length ? `<table>${cats.map(([c, n]) => row(`Incidents: ${c.replace(/_/g, ' ').toLowerCase()}`, n)).join('')}</table>` : '<p>No incidents were logged in this ward today.</p>'}
<div class="note"><strong>${esc(s.alert.replace(/_/g, ' '))}.</strong> ${esc(ALERT_TEXT[s.alert])}</div>
<p>Counts only: no names, no ID numbers. Supportive responses are what voters said at the door and what the canvasser recorded; they are not pledges and not a prediction.</p>
<div class="sig"><div>VD Captain</div><div>Ward Lead</div><div>Date and time</div></div>
<p style="font-size:.85rem;color:#6A6E7E">Generated ${esc(s.generatedAt)} in the browser. Nothing was sent.</p>
</main></body></html>`;
}
