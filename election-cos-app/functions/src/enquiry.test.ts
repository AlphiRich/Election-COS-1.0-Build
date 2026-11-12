import { describe, expect, it } from 'vitest';
import {
  enquiryId,
  handleEnquiry,
  normaliseMobile,
  validateEnquiry,
  type EnquiryDeps,
} from './enquiry';

const ORIGIN = 'https://innovationconsult.co.za';
const good = {
  name: ' Thandi  Mokoena ',
  email: 'Thandi@Example.org',
  role: 'Ward councillor',
  interest: 'Book a demo',
  demoWindow: 'Weekday mornings',
  consent: true,
  consentVersion: '[V1.0]',
  turnstileToken: 'tok',
};

const deps = (over: Partial<EnquiryDeps> = {}) => {
  const written: Record<string, Record<string, unknown>> = {};
  const d: EnquiryDeps = {
    verifyTurnstile: async () => true,
    verificationConfigured: true,
    store: async (id, data) => {
      if (written[id]) return false;
      written[id] = data;
      return true;
    },
    now: () => new Date('2026-11-04T08:00:00Z'),
    ...over,
  };
  return { d, written };
};

describe('validating an enquiry', () => {
  it('accepts a good one and normalises it', () => {
    const v = validateEnquiry(good, ORIGIN);
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.record).toMatchObject({
        name: 'Thandi Mokoena',
        email: 'thandi@example.org',
        mobile: null,
        origin: ORIGIN,
      });
    }
  });
  it('accepts a report request interest and normalises a mobile number', () => {
    expect(
      validateEnquiry({ ...good, interest: 'report:service-delivery-complaints' }, ORIGIN).ok,
    ).toBe(true);
    expect(normaliseMobile('082 449 7310')).toBe('+27824497310');
    expect(normaliseMobile('27824497310')).toBe('+27824497310');
    expect(normaliseMobile('12345')).toBeNull();
  });
  it('refuses the application’s own origin and any unknown origin', () => {
    expect(validateEnquiry(good, 'https://app.electioncos.co.za')).toMatchObject({
      ok: false,
      field: 'origin',
    });
    expect(validateEnquiry(good, 'https://evil.example')).toMatchObject({
      ok: false,
      field: 'origin',
    });
  });
  it('refuses with no contact point, no consent, no consent version, a bad role or a bad interest', () => {
    expect(validateEnquiry({ ...good, email: undefined }, ORIGIN)).toMatchObject({
      field: 'contact',
    });
    expect(validateEnquiry({ ...good, consent: 'yes' }, ORIGIN)).toMatchObject({
      field: 'consent',
    });
    expect(validateEnquiry({ ...good, consentVersion: '' }, ORIGIN)).toMatchObject({
      field: 'consentVersion',
    });
    expect(validateEnquiry({ ...good, role: 'Hacker' }, ORIGIN)).toMatchObject({ field: 'role' });
    expect(validateEnquiry({ ...good, interest: 'free money' }, ORIGIN)).toMatchObject({
      field: 'interest',
    });
  });
  it('refuses a message carrying an ID number, however it is spaced', () => {
    for (const m of ['id 8001015009087', '800101 5009 087', '8001015009-087']) {
      expect(validateEnquiry({ ...good, message: m }, ORIGIN), m).toMatchObject({
        ok: false,
        field: 'message',
      });
    }
    expect(validateEnquiry({ ...good, message: 'Ward 7, 2026' }, ORIGIN).ok).toBe(true);
  });
  it('silently rejects the honeypot', () => {
    expect(validateEnquiry({ ...good, website: 'http://spam' }, ORIGIN)).toMatchObject({
      ok: false,
    });
  });
});

describe('handling an enquiry', () => {
  it('stores a verified enquiry once, without any IP or user-agent', async () => {
    const { d, written } = deps();
    const r = await handleEnquiry('POST', ORIGIN, good, d);
    expect(r.status).toBe(200);
    const doc = Object.values(written)[0]!;
    expect(
      Object.keys(doc).some((k) => /^(ip|ipAddress|userAgent|ua|turnstileToken|token)$/i.test(k)),
    ).toBe(false);
    expect(doc.status).toBe('NEW');
  });
  it('counts five presses of Send as one enquiry', async () => {
    const { d, written } = deps();
    for (let i = 0; i < 5; i++) await handleEnquiry('POST', ORIGIN, good, d);
    expect(Object.keys(written)).toHaveLength(1);
    expect(enquiryId({ mobile: null, email: 'a@b.co', interest: 'x' }, '2026-11-04')).toHaveLength(
      24,
    );
  });
  it('fails closed when the verification secret is not configured, and stores nothing', async () => {
    const { d, written } = deps({ verificationConfigured: false });
    expect((await handleEnquiry('POST', ORIGIN, good, d)).status).toBe(503);
    expect(Object.keys(written)).toHaveLength(0);
  });
  it('refuses when Turnstile says no, or throws, and stores nothing', async () => {
    for (const verifyTurnstile of [
      async () => false,
      async () => {
        throw new Error('net');
      },
    ]) {
      const { d, written } = deps({ verifyTurnstile });
      expect((await handleEnquiry('POST', ORIGIN, good, d)).status).toBe(400);
      expect(Object.keys(written)).toHaveLength(0);
    }
  });
  it('answers 405 to anything but POST', async () => {
    expect((await handleEnquiry('GET', ORIGIN, good, deps().d)).status).toBe(405);
  });
});
