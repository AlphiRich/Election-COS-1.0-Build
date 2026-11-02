import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { enquiryConfig, enquiryPayload, sendEnquiry } from './enquiryClient';

describe('the enquiry client', () => {
  it('is off unless both the endpoint and the Turnstile key are set, and never over plain HTTP', () => {
    expect(enquiryConfig({})).toBeNull();
    expect(enquiryConfig({ VITE_ENQUIRY_URL: 'https://x.test/e' })).toBeNull();
    expect(enquiryConfig({ VITE_TURNSTILE_SITE_KEY: 'k' })).toBeNull();
    expect(
      enquiryConfig({ VITE_ENQUIRY_URL: 'http://x.test/e', VITE_TURNSTILE_SITE_KEY: 'k' }),
    ).toBeNull();
    expect(
      enquiryConfig({ VITE_ENQUIRY_URL: 'https://x.test/e', VITE_TURNSTILE_SITE_KEY: 'k' }),
    ).toEqual({
      url: 'https://x.test/e',
      siteKey: 'k',
    });
  });

  it('builds the wire payload the function validates, including the honeypot and consent version', () => {
    const fd = new FormData();
    fd.set('name', 'A');
    fd.set('consent', 'on');
    fd.set('website', 'spam');
    const p = enquiryPayload(fd, '[V1.0]', 'tok');
    expect(p).toMatchObject({
      name: 'A',
      consent: true,
      consentVersion: '[V1.0]',
      website: 'spam',
      turnstileToken: 'tok',
      marketingOptIn: false,
    });
    fd.delete('consent');
    expect(enquiryPayload(fd, '[V1.0]', 'tok').consent).toBe(false);
  });

  it('reports success only when the server says ok, and never claims success on a network failure', async () => {
    const cfg = { url: 'https://x.test/e', siteKey: 'k' };
    const payload = enquiryPayload(new FormData(), 'v', 't');
    const reply = (status: number, body: unknown) =>
      (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;
    expect(await sendEnquiry(cfg, payload, reply(200, { ok: true }))).toEqual({ ok: true });
    expect(await sendEnquiry(cfg, payload, reply(400, { ok: false, message: 'Bad' }))).toEqual({
      ok: false,
      message: 'Bad',
    });
    expect(await sendEnquiry(cfg, payload, reply(503, {}))).toMatchObject({ ok: false });
    const down = (async () => {
      throw new Error('offline');
    }) as typeof fetch;
    expect(await sendEnquiry(cfg, payload, down)).toMatchObject({ ok: false });
  });

  it('keeps enquiries unreadable and unwritable from any client in firestore.rules', () => {
    const rules = readFileSync(path.resolve(__dirname, '..', '..', 'firestore.rules'), 'utf-8');
    const i = rules.indexOf('match /enquiries/{enquiryId}');
    expect(i).toBeGreaterThan(-1);
    expect(rules.slice(i, i + 120)).toMatch(/allow read, write: if false;/);
  });
});
