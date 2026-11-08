/**
 * Election Campaign OS — the Master Command & Media Hub: its content.
 *
 * The master application (a single-page HTML stack: strategy, media assets, the agent stack, the Schedule 1 calculator, the
 * legal vault and the DNS and deployment gate) is built into the application here, tab for tab, "mutatis mutandis": every
 * function and feature is present, and each place where the stack's content could not be carried over as written is changed
 * the minimum needed and RECORDED in `CHANGES_FROM_MASTER`, so nothing is dropped silently and nothing false is shipped.
 */
import { tokens } from '@/design/tokens';

/** Every change made in carrying the master stack over, and why. Shown on the hub and checked by hub.test.ts. */
export const CHANGES_FROM_MASTER: Array<{ where: string; master: string; here: string; why: string }> = [
  { where: 'Header strip', master: '4,488 wards, 258 municipalities; region africa-south1', here: 'Same: 258 municipalities and 4,488 wards are summed from the proclaimed register', why: 'Verified against IEC Circular 1 of 2025, Annexure A, not asserted.' },
  { where: 'Metric: NW405 quota', master: '1,515 valid votes per seat', here: '2,069 (2026, the Commission’s own figure); 1,515 is the 2021 quota', why: 'The 2026 result is certified; 1,515 was the 2021 quota.' },
  { where: 'Metric: agents', master: '32 operational agents, 4 hybrid tiers', here: '32 named; each shows what implements it in this build and whether it is built', why: 'The build runs on Firebase, not AWS ECS or PostgreSQL; the catalogue says what exists.' },
  { where: 'Metric: legal instruments', master: '6 docs, "PUBLISHED & ACTIVE v1.0.0"', here: 'The 6 documents with their true status: drafting packs and drafts for an attorney, one not drafted', why: 'Build rule 3: no binding legal instrument is drafted here or presented as published.' },
  { where: 'Marketing chart', master: 'CPA and conversion rate drawn as measured channel results on two y-axes', here: 'Two charts, labelled planning targets, one axis each', why: 'No campaign has run, so these cannot be results; dual-axis charts mislead.' },
  { where: 'Quota chart', master: 'ANC 18, DA 12, EFF 4 ward seats and a PR split, labelled NW405 baseline', here: 'The certified 2026 NW405 seats from Schedule 1 (ANC 22, DA 21, VF+ 6 ...)', why: 'The master numbers were not the result of any election.' },
  { where: 'Quota calculator: D', master: '"Uncontested wards" (D)', here: '"Ward seats won by parties with no PR list" (D)', why: 'That is what D is in the Commission’s own report; uncontested wards are a different thing (Item 12(2)).' },
  { where: 'Turnout chart', master: '2011 to 2026, including 2024 NPE and two 2026 "forecasts" (47.8%, 39.1%)', here: 'Valid PR votes as a share of registered voters, 2021 and 2026, from the Commission’s data', why: 'The forecasts and earlier years had no source; the build holds two elections for JB Marks.' },
  { where: 'Ward swing chart', master: '"Flip Risk Probability" by ward (82.4% ...)', here: 'Wards closest to changing hands: the 2026 margin in points', why: 'The build has no model that can state a probability; a margin is a fact.' },
  { where: 'PPFA aggregator', master: 'R80,000 disclosure, R200,000 single-donor boundary, R15,000,000 annual cap, "Section 8(1)(a)", "Form IEC-PPFA-1"', here: 'R160,000 warning rung, R200,000 disclosure line, R30,000,000 annual line (Government Gazette 53182, under court challenge), no section citations', why: 'Held to ppfaDefaults.ts; the master stack’s section numbers and form name are not in any source this build holds.' },
  { where: 'DNS table', master: 'SPF "v=spf1 -all"; app as a DNS-only CNAME to electioncos1-0.web.app', here: 'Specified and OBSERVED side by side (8 Nov 2026)', why: 'The live SPF record allows the company’s mail servers (the seven mailboxes need it) and app. is currently proxied by Cloudflare.' },
  { where: 'Discipline checklist', master: '13/13 PASSED', here: 'Each rule shows the test or check that enforces it, or says it is a process rule', why: 'A pass count nobody ran is not a result.' },
  { where: 'Metric: volunteer cost', master: 'R16.40 per volunteer per cycle (activity-based micro-transactions)', here: 'Shown as not set', why: 'No activity-based schedule is adopted in this build and the figure has no source.' },
  { where: 'Copy', master: '"predictive seat modeling"', here: '"seat scenario modelling"', why: 'The product says its scenarios are not forecasts.' },
  { where: 'Poster mock-up', master: 'A grey box standing in for the QR code', here: 'The real WhatsApp QR (decoded to wa.me/27824497310)', why: 'The build already has the verified code.' },
  { where: 'Footer', master: 'Dead links; information officer on the corporate domain', here: 'Links to the real pages; legal@electioncos.co.za', why: 'The company addresses moved to electioncos.co.za on 2 Nov 2026.' },
];

export interface Funnel {
  title: string;
  target: string;
  offer: string;
  headline: string;
  channel: string;
  kpi: string;
  copy: string;
}
export const FUNNEL: Record<'bofu' | 'tofu', Funnel> = {
  bofu: {
    title: '2026 Bottom-of-Funnel (BOFU) Campaign',
    target: 'Independent Ward Candidates & Local Campaign Managers',
    offer: 'R1,800 / Ward License Package',
    headline: '“Comply before you campaign.”',
    channel: 'Google Search (Exact Match: ‘ward campaign software’, ‘POPIA consent tool’)',
    kpi: 'Cost Per Acquisition (target about R420), Immediate Lead Conversion Value',
    copy: 'Automated POPIA canvasser consent, ward donor tracking, and doorstep case logging for R1,800/ward.',
  },
  tofu: {
    title: '2029 Top-of-Funnel (TOFU) Institutional Campaign',
    target: 'Party National Directors & Chief Elections Strategists',
    offer: 'Enterprise Platform & Custom Service Level Agreements',
    headline: '“Every case, followed through.”',
    channel: 'Demand Gen (YouTube Shorts, Discover, LinkedIn) & Contextual News Sites',
    kpi: 'Pipeline Influenced Value, View-Through Conversions (VTCs), Brand Equity',
    copy: 'Centralized election war room, seat scenario modelling, and multi-tenant data governance for national campaigns.',
  },
};

export const CHANNELS: Array<{ label: string; cpaTarget: number; conversionAssumption: number }> = [
  { label: 'Google Search (BOFU)', cpaTarget: 420, conversionAssumption: 8.5 },
  { label: 'Demand Gen (TOFU)', cpaTarget: 1850, conversionAssumption: 1.2 },
  { label: 'LinkedIn (TOFU)', cpaTarget: 2100, conversionAssumption: 0.8 },
  { label: 'Display Retargeting', cpaTarget: 890, conversionAssumption: 3.4 },
];

export const ROADMAP = [
  { phase: 'PHASE 1: WEEKS 1-4', title: 'Compliance & Baseline Setup', body: 'Complete Google South Africa Election Ads identity verification. Connect CRM offline conversion imports. Lock Canva Brand Kit to WCAG 2.2 AA standards.' },
  { phase: 'PHASE 2: PRE-2026 ELECTIONS', title: 'Ground Game Activation', body: 'Deploy high-intent search campaigns (“ward campaign software”). Activate WhatsApp polling engine via QR codes on field pamphlets. Launch Daily Ground Intelligence lead magnet.' },
  { phase: 'PHASE 3: POST-2026 & BEYOND', title: 'Institutional Scaling', body: 'Shift to Smart Bidding (tROAS). Launch Demand Gen campaigns showcasing anonymized 2026 victory case studies to national party executives for 2029 election planning.' },
] as const;

export type AssetCategory = 'digital' | 'print' | 'video';
export interface Asset {
  id: number;
  name: string;
  category: AssetCategory;
  dims: string;
  copy: string;
  cta: string;
  bg: string;
}
export const ASSETS: Asset[] = [
  { id: 1, name: 'BOFU Urgency Square Banner', category: 'digital', dims: '1080x1080', copy: 'Manage your ward legally. R1,800/ward.', cta: 'Start Free Trial', bg: 'Paper' },
  { id: 2, name: 'TOFU Strategy Leaderboard', category: 'digital', dims: '16:9 Ratio', copy: 'Enterprise data intelligence for South African elections.', cta: 'Request Demo', bg: 'Ink' },
  { id: 4, name: 'Field Canvasser Poster', category: 'print', dims: 'A3 Field Poster', copy: 'Take the War Room to the Streets. WhatsApp Engine.', cta: 'Scan QR Code', bg: 'High-Vis Paper' },
  { id: 3, name: 'Ward Candidate Playbook', category: 'print', dims: '4-Page A4 PDF', copy: 'POPIA compliance risks, PPFA donor limits & seat formulas.', cta: 'Download Whitepaper', bg: 'Paper Whitepaper' },
  { id: 5, name: 'The Ground Game (30s)', category: 'video', dims: '16:9 & 9:16 Video', copy: 'Electoral compliance is stricter than ever. Comply before you campaign.', cta: 'Watch Teaser', bg: 'Kinetic Video' },
  { id: 6, name: 'Casework Tracker (15s)', category: 'video', dims: '9:16 Mobile Video', copy: 'Doorstep complaints shouldn’t get lost in WhatsApp groups.', cta: 'Sign Up Today', bg: 'App Screenshot' },
];

export interface ScriptBlock {
  time: string;
  visual: string;
  audio: string;
}
export const SCRIPTS: Record<'30s' | '15s', { label: string; seconds: number; blocks: ScriptBlock[] }> = {
  '30s': {
    label: '30s “Ground Game” Promo',
    seconds: 30,
    blocks: [
      { time: '0:00 - 0:05', visual: 'Dark Ink background. Kinetic typography flashes: POPIA. PPFA. Data Fragmentation.', audio: 'Electoral compliance is stricter than ever. And the election is won on the ground.' },
      { time: '0:05 - 0:15', visual: 'Crisp mockup of ECOS mobile app used on dusty street. Amber highlights pop up: ‘Consent Logged’ and ‘Offline Sync Active’.', audio: 'Election-COS connects your war room directly to your canvassers in real-time, even in rural dead zones.' },
      { time: '0:15 - 0:25', visual: 'Campaign war room dashboard on laptop showing Schedule 1 Seat Calculator adjusting dynamically.', audio: 'From automated donor tracking to seat scenario modelling. Same modules. Same terms. For every party.' },
      { time: '0:25 - 0:30', visual: 'Paper background. Bold Ink text: ‘Comply before you campaign.’ Amber button pulses: ‘Start Free Trial’.', audio: 'Election Campaign OS. Comply before you campaign.' },
    ],
  },
  '15s': {
    label: '15s “Casework Tracker” Promo',
    seconds: 15,
    blocks: [
      { time: '0:00 - 0:05', visual: 'Split screen. Left: Frustrated resident. Right: Councillor phone buzzing with ECOS notification.', audio: 'Doorstep complaints shouldn’t get lost in WhatsApp groups.' },
      { time: '0:05 - 0:10', visual: 'ECOS app converting complaint into formatted PDF referral.', audio: 'The Councillor Casework Tracker turns every report into a tracked municipal referral.' },
      { time: '0:10 - 0:15', visual: 'Bold text: R1,800 per ward licence. Button: Start Free Trial.', audio: 'Every case, followed through. Sign up today.' },
    ],
  },
};

export const VOICE_PROFILE = [
  ['Tone & Delivery', 'Authoritative, grounded, reassuring, precise, civic.'],
  ['Accent Profile', 'Clear, professional South African English (resembling a seasoned news anchor or documentary narrator).'],
  ['Pacing & Rhythms', 'Deliberate and measured, matching “Paper & Ink” precision. Subdued Amapiano / corporate electronic underscore.'],
] as const;

export const CANVA_PROMPT =
  `Professional B2B political software Facebook ad. Background color light beige/paper (${tokens.color.paper}). Large bold text in dark blue (${tokens.color.ink}) saying 'Manage your ward legally. R1,800/ward.' Include a button-like shape in amber (${tokens.color.gold}) with text 'Start Free Trial'. Clean, authoritative, minimalist civic style.`;

export const TIERS = [
  { tier: 'TIER 1: CLIENT PWA', agents: 'AGENTS 01-04', what: 'Firebase Hosting & Dexie DB', body: 'React 18 PWA executing client-side with offline Dexie IndexedDB outbox persistence and client-side image compression.' },
  { tier: 'TIER 2: EDGE GATEWAY', agents: 'AGENTS 05-06', what: 'Cloudflare Edge Workers', body: 'Rate-limiting, edge security headers, and tenant context taken from the verified token (not from an X-Tenant-ID header).' },
  { tier: 'TIER 3: BACKEND', agents: 'AGENTS 07-11', what: 'Firebase Cloud Functions, africa-south1', body: 'POPIA masking and export sweep, last-write-wins reconciliation, document vault, scenario simulation in the browser. Not AWS ECS Fargate: nothing can be deployed to AWS from this build.' },
  { tier: 'TIER 4: STATUTORY DATA', agents: 'AGENTS 12-16', what: 'Firestore with security rules', body: 'Tenant, capability and ward scope enforced by rules; the Schedule 1 formula in code (cross-checked in SQL on Postgres 16). Not RDS PostgreSQL with Row-Level Security.' },
] as const;

export const DNS_SPECIFIED = [
  { type: 'NS', host: '@', value: 'damian.ns.cloudflare.com', posture: 'Authoritative', why: 'Primary delegation to Cloudflare Edge DNS.' },
  { type: 'A', host: '@', value: '172.67.149.237 / 104.21.79.234', posture: 'Proxied (Orange Cloud)', why: 'Landing page DDoS protection and caching.' },
  { type: 'CNAME', host: 'app', value: 'electioncos1-0.web.app', posture: 'DNS-Only (Grey Cloud)', why: 'Bypasses double-CDN proxy; guarantees Firebase ACME SSL renewals.' },
  { type: 'TXT', host: '@', value: 'v=spf1 -all', posture: 'DNS-Only', why: 'Hard-fail anti-spoofing policy.' },
] as const;

/** Read from the build machine on 8 Nov 2026 through Cloudflare DNS-over-HTTPS and an HTTPS request. A snapshot, not a live check. */
export const DNS_OBSERVED = {
  asOf: '2026-11-08',
  method: 'Cloudflare DNS-over-HTTPS and HTTPS requests from the build machine',
  rows: [
    { type: 'NS', host: '@', value: 'holly.ns.cloudflare.com, damian.ns.cloudflare.com', matches: true, note: 'Both Cloudflare name servers; the master stack lists one.' },
    { type: 'A', host: '@', value: '104.21.79.234, 172.67.149.237', matches: true, note: 'Cloudflare proxy addresses, as specified. https://electioncos.co.za answers 301 to https://www.electioncos.co.za.' },
    { type: 'app', host: 'app', value: 'No CNAME answer; resolves to 172.67.149.237 (Cloudflare) and the response header says server: cloudflare, with a Firebase-style cache behind it', matches: false, note: 'app. is behind the Cloudflare proxy, not DNS-only. That is the double-CDN arrangement the master stack says to avoid, and the certificate-renewal reason it gives. Decide in the Cloudflare dashboard.' },
    { type: 'TXT', host: '@', value: 'v=spf1 ip4:169.239.218.67 include:_spf.tld-mx.com ~all (plus two google-site-verification records); MX 10 mx1.tld-mx.com', matches: false, note: 'Do NOT replace this with “v=spf1 -all”: that forbids every mail server and would stop the seven company mailboxes sending.' },
  ],
} as const;

export interface DisciplineRule {
  id: number;
  name: string;
  desc: string;
  /** How it is kept: a named test or check, or a person's process. */
  kind: 'enforced' | 'process' | 'partial';
  evidence: string;
}
export const DISCIPLINE: DisciplineRule[] = [
  { id: 1, name: '2026 Delimitation Hardwired', desc: '4,488 wards fixed. No hedging.', kind: 'enforced', evidence: 'municipalRegister.test.ts sums the proclaimed register to 258 municipalities and 4,488 wards' },
  { id: 2, name: 'No Fabricated Statute', desc: 'Quotas explicitly derived via Item 12.', kind: 'enforced', evidence: 'lge2026Results.test.ts: the engine reproduces all 18 of the Commission’s 2026 seat calculations' },
  { id: 3, name: 'No Drafted Legal Inst.', desc: 'Terms strictly summarized from vault.', kind: 'enforced', evidence: 'legal.test.ts guards NO_OPERATIVE_CLAUSES on every drafting pack' },
  { id: 4, name: 'Guard Tests Must Fail', desc: 'Defect class injected before passing.', kind: 'process', evidence: 'Each guard is broken on purpose and the failure recorded in the change log' },
  { id: 5, name: 'Present != Correct', desc: 'Emulator variables explicitly asserted.', kind: 'enforced', evidence: 'npm run preflight fails when the web config points at the emulator' },
  { id: 6, name: 'Cloud Function Markers', desc: 'Functions carry deploy gates.', kind: 'enforced', evidence: 'preflight reports functions readiness (22 reviewed, 4 fail closed pending infrastructure)' },
  { id: 7, name: 'Region africa-south1', desc: 'All resources pinned to JHB.', kind: 'enforced', evidence: 'preflight checks the region is pinned in every function' },
  { id: 8, name: 'Run the Product', desc: 'Mobile field layouts verified.', kind: 'process', evidence: 'Pages are driven in a real browser at 390 and 1280 px before they are called done' },
  { id: 9, name: 'Probe Before Linking', desc: 'Launch cards verify asset origin.', kind: 'process', evidence: 'Hostnames are resolved and requested before they are written into a page' },
  { id: 10, name: 'Secrets Isolated', desc: 'No credentials in chat history.', kind: 'process', evidence: 'Keys go in the environment’s secrets settings; .env.production.local is git-ignored' },
  { id: 11, name: 'Safe Shell Patterns', desc: 'No self-matching process kills.', kind: 'process', evidence: 'A working practice; there is no check for it' },
  { id: 12, name: 'Verify, Then Commit', desc: 'check:all -> build -> preflight.', kind: 'enforced', evidence: 'npm run check:all (lint, types, token guards, tests) and the CI workflow' },
  { id: 13, name: 'Semantic Primitives', desc: 'ARIA tags and distinct markup.', kind: 'partial', evidence: 'The shared UI layer and page tests cover roles and labels; there is no automated accessibility audit' },
];

export const LEGAL_DOCS = [
  { id: 'popia', button: '01. POPIA Privacy Policy', title: 'Protection of Personal Information Act (POPIA) Policy', text: 'Suppression, not erasure: personal information is suppressed on request and nothing hard-deletes. Unconsented capture is quarantined for a person to release, not purged on a timer. Identity numbers are never stored beyond the last four digits. Data sits in the africa-south1 region, with the Firebase Authentication cross-border processing disclosed.', status: 'Public notice live on the site; privacy-policy-DRAFT.docx awaiting attorney review' },
  { id: 'ecta', button: '02. ECTA Terms of Use', title: 'Terms of Use (ECTA / CPA)', text: 'The agreement between the platform and the individual user: how an invited canvasser is bound, acceptable use, device security, ending access. The drafting pack lists the decisions the company must make and the questions for the attorney.', status: 'Drafting pack IC-ECOS-LEG-04 and terms-of-use-DRAFT.docx; no operative clauses; to be drafted by an attorney' },
  { id: 'sub', button: '03. Master Subscription', title: 'Subscriber Tenancy Agreement and Licence', text: 'The agreement with the subscribing organisation, carrying the POPIA operator relationship (sections 20 and 21), module entitlements, exit and retention, and breach notification.', status: 'Drafting packs IC-ECOS-LEG-05 and IC-ECOS-LEG-06; no operative clauses; to be drafted by an attorney' },
  { id: 'price', button: '04. Pricing Schedule', title: 'Pricing & Accounts Terms', text: 'Ward licences are advertised at R1,800 per ward. The master stack’s activity-based rates (database writes R0.0005, sync events R0.02, image uploads R0.15) are not in this build and have not been adopted.', status: 'Drafting pack IC-ECOS-LEG-08; commercial decisions still with the company' },
  { id: 'tech', button: '05. Technical Build', title: 'Architecture Disclosure', text: 'A plain statement of how the platform is built: Firebase (Hosting, Authentication, Firestore, Functions in africa-south1) with a Cloudflare edge worker. The master stack’s AWS ECS and RDS PostgreSQL description is not how this build works.', status: 'docs/architecture-agent-map.md states it; not published as a customer document' },
  { id: 'paia', button: '06. PAIA Manual', title: 'PAIA Section 51 Manual', text: 'The statutory manual under the Promotion of Access to Information Act. The Information Officer is shown on the compliance page as legal@electioncos.co.za. The manual itself has not been drafted: it is a legal instrument.', status: 'Not drafted. Needs the Information Officer and an attorney' },
] as const;
