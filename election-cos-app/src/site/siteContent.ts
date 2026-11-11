/**
 * Election Campaign OS — public site content
 *
 * The copy and data for electioncos.co.za, implemented from the design
 * canvas "Election Campaign OS 1.0" (seven artboards, read 29 Oct 2026).
 *
 * WHY THE COPY LIVES HERE RATHER THAN IN THE PAGES
 *
 * Because a claim on a marketing page is the same kind of object as a
 * figure in the application: somebody has to be able to find it, check
 * it and change it without reading JSX. The canvas's own note says every
 * capability shown is a draft until its check is marked passed, and the
 * Compliance rows must be matched word-for-word to IC-ECOS-LEG-03. That
 * is far easier to do against a list than against markup.
 *
 * PLACEHOLDERS ARE KEPT AS PLACEHOLDERS
 *
 * The canvas marks facts still to supply in square brackets, and they
 * stay in square brackets here. `PLACEHOLDER_RE` finds them and
 * `siteContent.test.ts` asserts none has been quietly invented — rule 2,
 * applied to the sales page rather than the seat calculator.
 *
 * TWO WERE FILLED, BECAUSE THIS BUILD HOLDS THE ANSWER
 *
 *  - `[GAZETTE NUMBER AND DATE]` — the demarcation source is
 *    `docs/nw405-seed-data.md`: North West *Provincial Gazette,
 *    Extraordinary*, Vol 268 No. 8929, 18 November 2025, Provincial
 *    Notice 1300 of 2025.
 *  - `[COMPANY REGISTRATION NUMBER]` — Just Be Trading 10 (Pty) Ltd t/a
 *    Innovation Consult, Reg. 2007/021390/07, as settled this session.
 *
 * THE THREE FIGURES ON THE HOME PAGE WERE CHECKED, NOT COPIED
 *
 * 34 wards, 108 voting districts and 122,059 registered voters are
 * asserted against `seed-data/jb-marks-nw405-wards-vds.json` in
 * `siteContent.test.ts`. The seed holds 135 voting-district rows for 108
 * distinct codes, because a station split across wards is listed once
 * per ward — the count on the page is the distinct one.
 */

/** Marks a fact the canvas says is still to be supplied. */
export const PLACEHOLDER_RE = /\[[A-Z0-9][A-Z0-9 ,.\-/]*\]/;

export const SITE = {
  productName: 'Election Campaign OS',
  byline: 'by Innovation Consult',
  siteOrigin: 'https://electioncos.co.za',
  appOrigin: 'https://app.electioncos.co.za',
  corporateUrl: 'https://innovationconsult.co.za',
  /** Reg. number and trading style as settled 29 Oct 2026. */
  entity: 'Just Be Trading 10 (Pty) Ltd t/a Innovation Consult',
  registration: 'Reg. 2007/021390/07',
  /** Postal, not street: the company takes post at a box. */
  address: 'P.O. Box 2590, Potchefstroom, 2520',
  /**
   * The one WhatsApp number: the company's customer-care and sales line. `whatsAppHref` is built from `e164`.
   * The QR code beside it (`assets/whatsapp-qr.svg`) encodes `https://wa.me/<e164>`; a test pins the file.
   */
  whatsApp: {
    display: '082 449 7310',
    e164: '27824497310',
    role: 'Customer care and sales line',
  },
  bbbee: '[B-BBEE STATUTORY COMPLIANCE NOTE]',
  /**
   * The company's addresses on electioncos.co.za (owner, 2 Nov 2026; `accounts@` replaced by `cto@` and the order changed 8 Nov 2026). Seven, in this order. `noreply` only sends;
   * nobody reads replies to it, and the page says so.
   */
  mailboxes: [
    { address: 'admin@electioncos.co.za', purpose: 'Administration' },
    { address: 'info@electioncos.co.za', purpose: 'General enquiries' },
    { address: 'legal@electioncos.co.za', purpose: 'Legal, privacy and POPIA' },
    { address: 'sales@electioncos.co.za', purpose: 'Sales, demonstrations, billing and accounts' },
    { address: 'techsupport@electioncos.co.za', purpose: 'Technical support' },
    { address: 'cto@electioncos.co.za', purpose: 'Tech and platform enquiries: tech architecture, build security, pull requests and any other tech or code-stack matter' },
    { address: 'noreply@electioncos.co.za', purpose: 'Sends notices only; replies are not read' },
  ],
} as const;

/**
 * The one WhatsApp number, with the enquiry subject per page.
 *
 * Built rather than written out so a number change is one edit, and so
 * the text is encoded once and correctly.
 */
export function whatsAppHref(subject: string): string {
  return `https://wa.me/${SITE.whatsApp.e164}?text=${encodeURIComponent(subject)}`;
}

export interface NavItem {
  label: string;
  href: string;
  /** One line under the label in a menu. */
  hint?: string;
}
export interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * The primary menu, grouped. After 4 November 2026 the certified results lead: who runs each council, and who your
 * councillors are. Learning material and the campaign product follow. Every page a menu reaches is one the router serves
 * (siteContent.test.ts).
 */
export const SITE_NAV: NavGroup[] = [
  {
    label: 'Results 2026',
    items: [
      { label: 'Coalition Tracker', href: '/coalitions', hint: 'Every council: who holds the seats, who needs whom' },
      { label: 'My Ward', href: '/my-ward', hint: 'Your ward councillor and PR councillors' },
      { label: 'Results by Province', href: '/results', hint: 'Certified figures, provinces and metros' },
    ],
  },
  {
    label: 'Tools',
    items: [
      { label: 'Try a Coalition', href: '/tools/how-coalitions-work', hint: 'Combine parties in any council' },
      { label: 'How Seats Are Calculated', href: '/tools/how-seats-are-calculated', hint: 'From votes to seats, step by step' },
      { label: 'Party-Funding Checker', href: '/tools/party-funding-checker', hint: 'Where a donation sits against the law' },
      { label: 'All Voter Tools', href: '/tools' },
    ],
  },
  {
    label: 'Learn',
    items: [
      { label: 'Explainers', href: '/explainers', hint: 'The rules, in plain language, with sources' },
      { label: 'Videos', href: '/watch' },
      { label: 'Research', href: '/research' },
      { label: 'Tour', href: '/tutorial', hint: 'The 60-second tour' },
    ],
  },
  {
    label: 'For Campaigns',
    items: [
      { label: 'Campaign OS', href: '/for-campaigns', hint: 'The product for parties and councillors' },
      { label: 'Casework Tracker', href: '/casework-tracker' },
      { label: 'Packages', href: '/packages' },
      { label: 'Compliance', href: '/compliance' },
    ],
  },
];

/* ------------------------------------------------------------- home */

/**
 * The hero changes between seasons.
 *
 * The canvas exposes this as an editor control with two settings. Here
 * it is a constant the page reads, because a marketing site that
 * silently changed its headline on a date nobody can see would be worse
 * than one somebody edits deliberately.
 */
export type Season = 'casework' | 'pre-election';

export const SEASON: Season = 'casework';

export const HERO = {
  casework: {
    eyebrow: 'Casework Season · From 5 November 2026',
    line: 'Every Case, Followed Through.',
    sub: 'Doorstep complaints become signed referrals to the municipality, tracked to resolution.',
    cta: 'See the Casework Tracker',
    ctaHref: '/casework-tracker',
    band: 'R2,500 per Ward a Month',
  },
  'pre-election': {
    eyebrow: 'Election Season',
    line: 'Comply Before You Campaign.',
    sub: 'Party-funding tracking, POPIA-by-design voter contact and offline field operations, set up before the proclamation.',
    cta: 'See the Platform',
    ctaHref: '/for-campaigns#pillars',
    band: 'Set Up Your Wards Before the Proclamation',
  },
} as const;

export interface Audience {
  title: string;
  blurb: string;
  linkLabel: string;
  href: string;
  icon: 'office' | 'grid' | 'person';
}

export const AUDIENCES: Audience[] = [
  {
    title: 'Ward Councillors and Caucus Offices',
    blurb: "Follow every resident's complaint from the doorstep to the municipality and back.",
    linkLabel: 'Casework Tracker',
    href: '/casework-tracker',
    icon: 'office',
  },
  {
    title: 'Party Structures',
    blurb: 'Run field operations, funding tracking and ward intelligence across a municipality.',
    linkLabel: 'The Platform',
    href: '/for-campaigns#pillars',
    icon: 'grid',
  },
  {
    title: 'Independent Candidates',
    blurb: 'One ward licence, the same modules and terms as everyone else.',
    linkLabel: 'Packages',
    href: '/packages',
    icon: 'person',
  },
];

/**
 * The reference-build figures.
 *
 * Every one is checked against the seed data by `siteContent.test.ts`.
 * They are the only numbers on the public site that describe this
 * product's own data, and the footnote names where they come from.
 */
export const REFERENCE_FIGURES = [
  { label: 'Wards', value: '34' },
  { label: 'Voting Stations', value: '108' },
  { label: 'Registered Voters', value: '122,059' },
] as const;

export const REFERENCE_FOOTNOTE =
  'JB Marks Local Municipality reference build, reconciled against the gazette. ' +
  'North West Provincial Gazette, Extraordinary, Vol 268 No. 8929, 18 November 2025 ' +
  '(Provincial Notice 1300 of 2025).';

export interface Pillar {
  name: string;
  does: string;
  proof: string;
  status: 'built' | 'roadmap';
}

export const PILLARS: Pillar[] = [
  {
    name: 'Offline-First Field Operations',
    does: 'Canvassers capture on a phone through load-shedding and dead zones; it syncs when signal returns.',
    proof: 'offline capture and sync tested on mobile networks',
    status: 'built',
  },
  {
    name: 'POPIA by Design',
    does: 'Consent is recorded before anything is stored; numbers are masked; suppression on request.',
    proof: 'consent record on every contact',
    status: 'built',
  },
  {
    name: 'Party-Funding Tracking',
    does: 'Nightly donor totals with alerts at the disclosure line and warnings near the cap.',
    proof: 'donor aggregation tested on simulated streams',
    status: 'built',
  },
  {
    name: 'Incident-to-Council Escalation',
    does: 'A logged incident becomes a signed referral the municipality can act on.',
    proof: 'integrity hash on every referral PDF',
    status: 'built',
  },
  {
    name: 'Ward-Level Intelligence',
    does: 'Issues and sentiment summarised by ward, never by person.',
    proof: 'ward-scoped access, three-place tenant isolation',
    status: 'built',
  },
];

export const PLEDGE = [
  'No hidden modules',
  'No per-party switches',
  'Wards, not people',
  'No predictions or results commentary',
  'One published price list',
  'Invented examples only',
];

/* --------------------------------------------------------- casework */

export interface CaseStep {
  n: string;
  title: string;
  body: string;
}

export const CASE_STEPS: CaseStep[] = [
  { n: '01', title: 'Report', body: 'A canvasser or the office logs the complaint at the door, online or offline.' },
  { n: '02', title: 'Triage', body: 'The office sorts it by service: water, electricity, roads, safety.' },
  { n: '03', title: 'Authorise', body: 'The councillor approves what goes out under their name.' },
  { n: '04', title: 'Signed Referral', body: 'A signed, hashed PDF goes to the right municipal department.' },
  { n: '05', title: 'Tracked to Resolution', body: 'The case stays open until it is resolved, and the resident is told.' },
];

/**
 * The example case on the hero card and the referral facsimile.
 *
 * Invented ward, office and municipality, and labelled as such on every
 * surface it appears. The canvas is explicit that all case examples use
 * invented wards — this product does not put a real resident's complaint
 * on a sales page.
 */
export const EXAMPLE_CASE = {
  reference: 'CASE EX-0417',
  referralReference: 'REF EX-2026-0417',
  title: 'Streetlights Out on Four Blocks',
  where: 'Ward 07, Example Local Municipality · reported at the door',
  office: "Ward 07 Councillor's Office",
  hash: 'sha256 9f3a…c21e',
  disclaimer: 'Example · invented ward and data',
  timeline: [
    { label: 'Reported', detail: 'by canvasser', at: '06 Nov 09:12', current: false },
    { label: 'Triaged', detail: '· electricity', at: '06 Nov 11:40', current: false },
    { label: 'Authorised', detail: 'by ward councillor', at: '06 Nov 16:05', current: false },
    { label: 'Signed Referral', detail: 'sent to municipality', at: '07 Nov 08:30', current: false },
    { label: 'Tracking', detail: '· day 3 of 14', at: 'Open', current: true },
  ],
} as const;

export const CASEWORK_FEATURES = [
  {
    title: 'Works Offline',
    body: 'Capture cases through load-shedding and rural dead zones. They sync when signal returns.',
    icon: 'offline' as const,
  },
  {
    title: 'Ward-Scoped Access',
    body: 'Each person sees only the wards they are assigned to.',
    icon: 'shield' as const,
  },
  {
    title: 'POPIA by Design',
    body: 'Consent recorded before storage. Numbers masked. Suppression on request.',
    icon: 'lock' as const,
  },
];

export const CASEWORK_FAQ = [
  {
    q: 'What Does It Cost?',
    a: 'R2,500 per ward a month, the full price (no VAT is charged). The same price for every party and every independent councillor.',
  },
  { q: 'How Does Onboarding Work?', a: '[ONBOARDING STEPS AND TIMELINE]' },
  { q: 'Who Owns the Case Data?', a: '[DATA OWNERSHIP ANSWER, AS IN THE TERMS]' },
  {
    q: 'What Happens to the Data If a Councillor Leaves Office?',
    a: '[HANDOVER AND RETENTION ANSWER, AS IN THE TERMS]',
  },
];

/* ------------------------------------------------------- compliance */

export interface ClaimRow {
  does: string;
  not: string;
  ref: string;
}

/**
 * The capability and limitations rows.
 *
 * The canvas note is explicit: these are drafted from the white paper
 * and **must be matched word-for-word to IC-ECOS-LEG-03** with each test
 * reference filled in. They are therefore published here exactly as
 * drafted, references still bracketed, and the page says the date they
 * were drawn from so nobody mistakes a draft for the signed statement.
 */
export const CLAIM_ROWS: ClaimRow[] = [
  {
    does: 'Totals donations per donor and flags the disclosure thresholds',
    not: 'That it ensures compliance',
    ref: '[LEG-03 T-01]',
  },
  {
    does: 'Prepares a quarterly disclosure export for a person to check and sign off',
    not: 'That it files with the IEC',
    ref: '[LEG-03 T-02]',
  },
  { does: "Suppresses a person's records from use on request", not: 'That it deletes data', ref: '[LEG-03 T-03]' },
  {
    does: 'Stores tenant data in Johannesburg (africa-south1), with sign-in disclosed as the exception',
    not: 'That data never leaves South Africa',
    ref: '[LEG-03 T-04]',
  },
  {
    does: 'Logs incidents and escalates them to the council as signed referrals',
    not: 'That it manages gathering permits',
    ref: '[LEG-03 T-05]',
  },
  { does: '[SIXTH ROW, AS IN LEG-03]', not: '[SIXTH ROW, AS IN LEG-03]', ref: '[LEG-03 T-06]' },
];

export const CLAIMS_CAPTION = 'Rows as Published in IC-ECOS-LEG-03, 8 August 2026';

export const FUNDING_POINTS = [
  'Donor totals aggregated every night',
  'An alert when a donor reaches the R200,000 disclosure line',
  'Warnings as a donor nears the R30 million cap',
  'A quarterly export, prepared for a person to check and sign off',
];

/**
 * The gazette behind the two thresholds above.
 *
 * R200,000 and R30 million are the current figures and match
 * `ppfaDefaults.ts`; `siteContent.test.ts` holds the page to them so the
 * superseded R100,000 regime cannot reappear here the way it did in the
 * ecos-v2 fork's settings copy.
 */
export const FUNDING_SOURCE =
  'Thresholds as published on 18 August 2025 (Government Gazette 53182). ' +
  'These thresholds are under court challenge; we update them when the law changes.';

export const EXAMPLE_DONOR = {
  reference: 'Donor D-0031',
  disclaimer: 'Example · invented figures',
  amount: 'R184,500',
  line: 'R200,000 line',
  percent: 92,
  alert: 'R15,500 below the disclosure line. Review before the next deposit.',
  caption: 'How the alert appears to a treasurer in the application.',
} as const;

export const POPIA_POINTS = [
  'Consent is recorded before anything is stored',
  "On request, a person's records are suppressed from use",
  'Voter and lead data are stored in Johannesburg; sign-in is the disclosed exception',
];

export const INFORMATION_OFFICER = '[INFORMATION OFFICER NAME]';

/* --------------------------------------------------------- packages */

export interface Package {
  buyer: string;
  pkg: string;
  price: string;
  unit: string;
  href: string;
}

export const PACKAGES: Package[] = [
  { buyer: 'Independent Ward Candidate', pkg: 'Ward Licence', price: 'R1,800', unit: 'ward licence', href: '/contact' },
  { buyer: 'Small Party, Selected Wards', pkg: 'Ward Licences', price: 'R1,800', unit: 'per ward', href: '/contact' },
  {
    buyer: 'Established Party, Municipal',
    pkg: 'Municipal Package',
    price: 'R45,000',
    unit: 'per cycle, plus the PPFA add-on by consultation',
    href: '/contact',
  },
  {
    buyer: 'Provincial Structure',
    pkg: 'Provincial Package',
    price: 'By agreement',
    unit: 'scoped with you',
    href: '/contact',
  },
  {
    buyer: "Ward Councillor's Office",
    pkg: 'Councillor Casework Tracker',
    price: 'R2,500',
    unit: 'per ward a month',
    href: '/casework-tracker',
  },
];

/**
 * Innovation Consult is below the SARS compulsory VAT registration threshold
 * and not registered, so it may not charge VAT: the published price is the
 * whole price. Change this line and the prices together on registration.
 */
export const VAT_NOTE = 'No VAT is charged: Innovation Consult is not registered for VAT, so the published price is the full price.';

/* ---------------------------------------------------------- contact */

export const CONTACT_ROLES = [
  'Ward councillor',
  'Caucus office',
  'Party structure',
  'Independent candidate',
  'Media or academic',
  'Other',
];

export const CONTACT_INTERESTS = [
  'Councillor Casework Tracker',
  'Ward licence',
  'Municipal package',
  'Provincial package',
  'PPFA add-on consultation',
  'Capability and Limitations Statement',
  'Commission a research report',
];

/** The consent wording version, recorded with every submission. */
export const CONSENT_VERSION = '[V1.0]';

export const MESSAGE_WARNING =
  "Please don't include your party, your political views or any voter's details.";
