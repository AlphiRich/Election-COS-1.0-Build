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
