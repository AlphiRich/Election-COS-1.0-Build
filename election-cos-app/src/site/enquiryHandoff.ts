/**
 * Election Campaign OS — public site: handing an enquiry to email or WhatsApp
 *
 * Until the enquiry service is switched on (`enquiryClient.ts`: VITE_ENQUIRY_URL and VITE_TURNSTILE_SITE_KEY), the contact
 * and demo forms used to end on a page that said "Thank You. We Have Your Enquiry." and then, underneath, that nothing had
 * been sent. That was a mock-up of a confirmation. This replaces it with a real route: the form writes the request out and
 * opens it in the visitor's own email app (to the sales mailbox) or in WhatsApp (the sales line), for them to send. Nothing
 * is stored or sent by this page, and the page says so.
 *
 * The text carries only what the visitor typed into the form, under the same labels, so what they send is what they saw.
 */
import { SITE } from './siteContent';

export const SALES_MAILBOX = SITE.mailboxes.find((m) => m.address.startsWith('sales@'))!.address;

const LABELS: Array<[field: string, label: string]> = [
  ['name', 'Name'],
  ['role', 'Role'],
  ['interest', 'Interested in'],
  ['municipality', 'Municipality'],
  ['ward', 'Ward'],
  ['demoWindow', 'When suits me'],
  ['mobile', 'Mobile'],
  ['email', 'Email'],
  ['message', 'Message'],
];

export interface Handoff {
  subject: string;
  body: string;
  mailto: string;
  whatsApp: string;
}

/** The request as plain text, from the submitted form. Empty fields are left out. */
export function handoff(fd: FormData, demo: boolean, consentVersion: string): Handoff {
  const s = (k: string) => {
    const v = fd.get(k);
    return typeof v === 'string' ? v.trim() : '';
  };
  const lines = LABELS.filter(([k]) => s(k)).map(([k, label]) => `${label}: ${s(k)}`);
  lines.push(`Consent to be contacted about this request: yes (wording ${consentVersion})`);
  lines.push(`Product updates: ${fd.get('marketing') ? 'yes' : 'no'}`);
  const subject = demo ? `Demo request: ${s('name') || 'Election-COS'}` : `Enquiry: ${s('interest') || 'Election-COS'}`;
  const body = lines.join('\n');
  return {
    subject,
    body,
    mailto: `mailto:${SALES_MAILBOX}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    whatsApp: `https://wa.me/${SITE.whatsApp.e164}?text=${encodeURIComponent(`${subject}\n\n${body}`)}`,
  };
}
