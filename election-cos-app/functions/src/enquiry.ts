/**
 * Election Campaign OS — the enquiry pipeline (Book a demo, report requests, contact)
 *
 * Pure logic. `enquiryHttp.ts` is the wiring. Everything that decides
 * whether an enquiry is accepted lives here so it can be tested without a
 * network.
 *
 * WHAT IT REFUSES TO COLLECT
 *   - A South African ID number, anywhere in the message. The form's own
 *     warning says no voter details; a 13-digit run is the one violation a
 *     machine can see, and it is refused rather than stored.
 *   - Anything without a named person's consent, with the wording version.
 *   - Anything with neither a mobile number nor an email address.
 *
 * WHAT IT DOES NOT STORE
 *   - The caller's IP address or user agent. Cloudflare holds those for the
 *     WAF; an enquiry record has no use for them.
 *
 * DUPLICATES
 *   The record id is a hash of the contact point and the day, written
 *   create-if-absent. Pressing Send five times is one enquiry, and a bot
 *   hammering one address writes one document a day.
 */
import { createHash } from 'node:crypto';
import { ENQUIRY_ORIGINS } from './enquiryOrigins';

export const ROLES = [
  'Ward councillor',
  'Caucus office',
  'Party structure',
  'Independent candidate',
  'Media or academic',
  'Other',
] as const;

export const INTERESTS = [
  'Book a demo',
  'Councillor Casework Tracker',
  'Ward licence',
  'Municipal package',
  'Provincial package',
  'PPFA add-on consultation',
  'Capability and Limitations Statement',
  'Commission a research report',
] as const;

const REPORT_INTEREST = /^report:[a-z0-9-]{1,60}$/;

export interface EnquiryInput {
  name?: unknown;
  mobile?: unknown;
  email?: unknown;
  role?: unknown;
  interest?: unknown;
  municipality?: unknown;
  ward?: unknown;
  message?: unknown;
  /** Preferred demo window, free text, short. */
  demoWindow?: unknown;
  consent?: unknown;
  consentVersion?: unknown;
  marketingOptIn?: unknown;
  /** Honeypot: a real person never fills this in. */
  website?: unknown;
  turnstileToken?: unknown;
}

export interface EnquiryRecord {
  name: string;
  mobile: string | null;
  email: string | null;
  role: string;
  interest: string;
  municipality: string | null;
  ward: string | null;
  message: string | null;
  demoWindow: string | null;
  consentVersion: string;
  marketingOptIn: boolean;
  origin: string;
}

export type Validation =
  | { ok: true; record: EnquiryRecord; turnstileToken: string }
  | { ok: false; field: string; reason: string };

const str = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, max) : null;
};

export function normaliseMobile(raw: string): string | null {
  const d = raw.replace(/[^\d+]/g, '');
  if (/^\+27\d{9}$/.test(d)) return d;
  if (/^27\d{9}$/.test(d)) return `+${d}`;
  if (/^0\d{9}$/.test(d)) return `+27${d.slice(1)}`;
  return null;
}

const ID_LIKE = /(?<!\d)\d{13}(?!\d)/;

export function validateEnquiry(input: EnquiryInput, origin: string): Validation {
  if (!(ENQUIRY_ORIGINS as readonly string[]).includes(origin)) {
    return { ok: false, field: 'origin', reason: 'Origin not allowed.' };
  }
  if (input.website) return { ok: false, field: 'website', reason: 'Rejected.' }; // honeypot
  const name = str(input.name, 120);
  if (!name) return { ok: false, field: 'name', reason: 'Name is required.' };

  const mobileRaw = str(input.mobile, 30);
  const mobile = mobileRaw ? normaliseMobile(mobileRaw) : null;
  if (mobileRaw && !mobile)
    return { ok: false, field: 'mobile', reason: 'Use a South African mobile number.' };
  const email = str(input.email, 200);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { ok: false, field: 'email', reason: 'That email address does not look right.' };
  }
  if (!mobile && !email)
    return { ok: false, field: 'contact', reason: 'Give us a mobile number or an email address.' };

  const role = str(input.role, 60);
  if (!role || !(ROLES as readonly string[]).includes(role)) {
    return { ok: false, field: 'role', reason: 'Choose your role.' };
  }
  const interest = str(input.interest, 80);
  if (
    !interest ||
    !((INTERESTS as readonly string[]).includes(interest) || REPORT_INTEREST.test(interest))
  ) {
    return { ok: false, field: 'interest', reason: 'Choose what you are interested in.' };
  }
  const message = str(input.message, 1000);
  const demoWindow = str(input.demoWindow, 120);
  const municipality = str(input.municipality, 80);
  const ward = str(input.ward, 20);
  for (const [f, v] of [
    ['message', message],
    ['demoWindow', demoWindow],
    ['municipality', municipality],
  ] as const) {
    if (v && ID_LIKE.test(v.replace(/[\s-]/g, ''))) {
      return {
        ok: false,
        field: f,
        reason: 'Please remove any ID number. We do not collect them.',
      };
    }
  }
  if (input.consent !== true)
    return { ok: false, field: 'consent', reason: 'Consent is required to contact you.' };
  const consentVersion = str(input.consentVersion, 20);
  if (!consentVersion)
    return { ok: false, field: 'consentVersion', reason: 'Consent wording version missing.' };
  const token = str(input.turnstileToken, 2048);
  if (!token) return { ok: false, field: 'turnstileToken', reason: 'Verification missing.' };

  return {
    ok: true,
    turnstileToken: token,
    record: {
      name,
      mobile,
      email: email ? email.toLowerCase() : null,
      role,
      interest,
      municipality,
      ward,
      message,
      demoWindow,
      consentVersion,
      marketingOptIn: input.marketingOptIn === true,
      origin,
    },
  };
}

/** Same contact + same day = same enquiry. */
export function enquiryId(
  r: Pick<EnquiryRecord, 'mobile' | 'email' | 'interest'>,
  day: string,
): string {
  const key = `${r.email ?? ''}|${r.mobile ?? ''}|${r.interest}|${day}`;
  return createHash('sha256').update(key).digest('hex').slice(0, 24);
}

export interface EnquiryDeps {
  /** Cloudflare Turnstile siteverify. Throws or returns false when it cannot confirm. */
  verifyTurnstile: (token: string) => Promise<boolean>;
  /** True when the Turnstile secret is configured. Without it the endpoint refuses (fails closed). */
  verificationConfigured: boolean;
  /** Create-if-absent. Returns true if it wrote. */
  store: (id: string, data: Record<string, unknown>) => Promise<boolean>;
  now: () => Date;
}

export interface HttpReply {
  status: number;
  body: { ok: boolean; message?: string; field?: string };
}

export async function handleEnquiry(
  method: string,
  origin: string,
  body: unknown,
  deps: EnquiryDeps,
): Promise<HttpReply> {
  if (method !== 'POST') return { status: 405, body: { ok: false, message: 'POST only.' } };
  if (!deps.verificationConfigured) {
    // Fails closed: without the bot check we would accept anything, and a
    // sales form that stores whatever arrives is an abuse channel.
    return {
      status: 503,
      body: { ok: false, message: 'Enquiries are not open yet. Please use WhatsApp.' },
    };
  }
  const v = validateEnquiry((body ?? {}) as EnquiryInput, origin);
  if (!v.ok)
    return {
      status: v.field === 'origin' ? 403 : 400,
      body: { ok: false, field: v.field, message: v.reason },
    };

  let human = false;
  try {
    human = await deps.verifyTurnstile(v.turnstileToken);
  } catch {
    human = false;
  }
  if (!human)
    return {
      status: 400,
      body: {
        ok: false,
        field: 'turnstileToken',
        message: 'Verification failed. Please try again.',
      },
    };

  const now = deps.now();
  const id = enquiryId(v.record, now.toISOString().slice(0, 10));
  await deps.store(id, { ...v.record, createdAt: now.toISOString(), status: 'NEW' });
  return { status: 200, body: { ok: true, message: 'Thank you. We have your enquiry.' } };
}
