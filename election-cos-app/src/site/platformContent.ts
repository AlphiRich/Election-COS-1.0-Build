/**
 * Election Campaign OS — content for /platform, /about and /legal/*.
 *
 * The seven roles are the product's own (src/auth/seedRoles.ts); a test
 * holds this list to it so the public page cannot name a role the
 * application does not have.
 */
export const PLATFORM_ROLES = [
  {
    label: 'Party HQ Admin',
    does: 'Sets up the organisation, wards, people and what each role may do.',
  },
  { label: 'Municipal Team Lead', does: 'Oversees every ward in one municipality.' },
  { label: 'Ward Lead', does: 'Runs one ward and the people assigned to it.' },
  { label: 'VD Captain', does: 'Runs one voting district on the ground.' },
  { label: 'Canvasser', does: 'Captures contacts and cases on a phone, online or offline.' },
  { label: 'Compliance Officer', does: 'Reviews consent, suppression and disclosure exports.' },
  { label: 'Finance Officer', does: 'Tracks donations against the disclosure line.' },
] as const;

export const NEUTRALITY_PLEDGE = [
  'The same modules and terms for every party and every independent.',
  'No party names, logos or colours on this site.',
  'No predictions, no results commentary, no endorsements.',
  'One published price list. Nothing is switched on for one customer and off for another.',
  'Examples use invented wards and invented data, and say so.',
] as const;

/**
 * The company behind the product, from the Innovation Consult Company Profile
 * 2026–2031 (IC-CP-2026-V2.1, November 2026). The entity, registration and
 * B-BBEE level come from `SITE` (siteContent.ts), which is the one source for
 * them; this adds the narrative the profile carries. Product maturity labels
 * are kept explicit so nothing future-dated reads as available now — the same
 * claims discipline the profile itself sets out.
 */
export const CORPORATE = {
  tagline: 'Knowledge to Action',
  lead:
    'Innovation Consult is a South African Agentic and Generative AI software-engineering and strategic-management firm, headquartered in Potchefstroom, North West. It builds sovereign, POPIA-native operating systems, management information systems and application bots.',
  heritage:
    'The firm traces its roots to Thukela Management Consulting (2005) and was incorporated in 2007. Over two decades it executed National Treasury urban-renewal programmes, provincial and co-operative banking initiatives, municipal financial turnarounds and mega-infrastructure feasibility studies before focusing, in 2026, on bespoke Agentic AI software engineering.',
  stats: [
    { value: '21 Years', label: 'Institutional heritage, 2005–2026' },
    { value: '4 Platforms', label: 'Proprietary turnkey OS and agent suite' },
    { value: '9 Domains', label: 'Enterprise MIS and strategic planning' },
  ],
  ethos: [
    {
      name: 'Verify Before You Publish',
      body: 'Checkable primary sources and human sign-off gates stand before anything is stated or filed.',
    },
    {
      name: 'Claims Discipline',
      body: 'Every public statement is backed by a measured test, and a feature not yet built is labelled roadmap, never implied.',
    },
    {
      name: 'Sovereign Compliance by Design',
      body: 'POPIA, PAIA, MFMA, PFMA, LPC, CBDA and PPFA are encoded into the architecture, not bolted on afterwards.',
    },
  ],
  /** The four products. `href` is set only for the one this site is about. */
  products: [
    {
      name: 'Legal-OS 1.1',
      stage: 'Flagship · general availability April 2027',
      body: 'Turnkey AI co-counsel for South African law firms. Every citation is checked against SAFLII and comes back safe, escalated or blocked; the practitioner approves and files.',
      href: null,
    },
    {
      name: 'Election Campaign OS',
      stage: 'Beta · LGE 2026 field pilot',
      body: 'Offline-first campaign, compliance and post-election ward-councillor casework. This product.',
      href: '/for-campaigns',
    },
    {
      name: 'ICPMO Control Tower',
      stage: 'Prototype',
      body: 'A multi-typology programme-management control plane with a confidence-calculus gate for MFMA, PFMA and infrastructure compliance.',
      href: null,
    },
    {
      name: 'IC Books',
      stage: 'Draft specification',
      body: 'A multi-entity, double-entry accounting agent with database-enforced balance and human-approved postings.',
      href: null,
    },
  ],
  leadership: [
    {
      name: 'McMillan Kenny Neo Dlutu',
      role: 'Principal Founder and Managing Director',
      bio: 'B.Com Economics (NMMU). Leads corporate strategy, Agentic AI and turnkey-OS architecture, client pilots and institutional partnerships.',
    },
    {
      name: 'Alphina Nokuzola Dlutu',
      role: 'Director: Administration and Finance',
      bio: 'B.Ed (Hons) and a Master’s in Organisational Development, with over thirty years in administrative and organisational leadership, corporate governance and statutory compliance.',
    },
  ],
  particulars: {
    headOffice: '114 Sol Plaatjie Avenue, Mieder Park, Potchefstroom, 2531',
    postal: 'P.O. Box 2590, Potchefstroom, 2520, North West',
    phone: '+27 (0)67 907 1580',
    phoneHref: 'tel:+27679071580',
    // No corporate mailbox in product source (productMail guard): this site's
    // enquiries go to the product domain, and corporate mail is reached via the
    // company website linked below.
  },
} as const;

export type LegalKind = 'privacy' | 'terms' | 'cookies';

/**
 * Facts only. The binding text of each notice is for the attorney (build
 * rule 3); these pages state what the site actually does today and say the
 * notice is pending sign-off.
 */
export const LEGAL_PAGES: Record<
  LegalKind,
  { title: string; lead: string; facts: string[]; pending: string }
> = {
  privacy: {
    title: 'Privacy Notice',
    lead: 'What this website does with personal information today.',
    facts: [
      'The enquiry form asks for your name, role, ward or municipality, and a way to reach you. It asks for nothing else.',
      'The form holds two separate consent boxes. Neither is ticked for you, and the enquiry is not sent without the one that lets us reply.',
      'Please never type an ID number into the form. The form refuses one.',
      'Enquiries are stored in Johannesburg (africa-south1). Sign-in to the application is the disclosed exception to that.',
      'No analytics or advertising cookie is set before you choose to allow it.',
      'If you answer a poll, your answer is counted with others and is not linked to your name, number or device. A poll asks only for a choice, never for personal details.',
    ],
    pending:
      'The full privacy notice, with the Information Officer’s details, is pending attorney sign-off.',
  },
  terms: {
    title: 'Terms of Use',
    lead: 'The terms for using this website.',
    facts: [
      'This website is information. It is not legal advice, and the tools on it are illustrative.',
      'Prices are published and are the full amount payable: no VAT is charged, as Innovation Consult is not registered for VAT.',
      'The PPFA Governance and Disclosure Add-on is priced after a scoping consultation with our engineering team.',
    ],
    pending: 'The binding terms of use and the customer terms are pending attorney sign-off.',
  },
  cookies: {
    title: 'Cookie Notice',
    lead: 'What is stored in your browser.',
    facts: [
      'Nothing optional is stored before you choose.',
      'If advertising is ever switched on, it is off until you consent, and you can withdraw from the footer on any page.',
      'The site stores your choice on your own device so it need not ask again.',
    ],
    pending: 'The full cookie notice is pending attorney sign-off.',
  },
};
