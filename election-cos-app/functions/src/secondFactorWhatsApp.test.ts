import { describe, expect, it, vi } from 'vitest';
import { buildAuthTemplateBody, postWhatsAppLoginCode, type WhatsAppConfig } from './secondFactorWhatsApp';
import { SmsNotConfigured } from './secondFactor';

const CONFIG: WhatsAppConfig = {
  token: 'T0KEN',
  phoneNumberId: '1234567890',
  template: 'election_cos_login_code',
  lang: 'en',
  graphVersion: 'v21.0',
};

const res = (ok: boolean, body: unknown, status = ok ? 200 : 400) => ({
  ok,
  status,
  headers: { get: () => 'req-1' },
  json: async () => body,
});

describe('buildAuthTemplateBody', () => {
  it('carries the code in both the body and the one-tap button, with the approved template and language', () => {
    const b = buildAuthTemplateBody('+27824497310', '482913', 'election_cos_login_code', 'en');
    expect(b.messaging_product).toBe('whatsapp');
    expect(b.to).toBe('+27824497310');
    expect(b.template.name).toBe('election_cos_login_code');
    expect(b.template.language.code).toBe('en');
    const bodyComp = b.template.components.find((c) => c.type === 'body')!;
    const btnComp = b.template.components.find((c) => c.type === 'button')!;
    expect(bodyComp.parameters[0].text).toBe('482913');
    expect(btnComp.parameters[0].text).toBe('482913');
  });
});

describe('postWhatsAppLoginCode', () => {
  it('refuses (fails closed) when the credential is absent', async () => {
    await expect(postWhatsAppLoginCode({ ...CONFIG, token: '' }, '+27824497310', '1', vi.fn())).rejects.toBeInstanceOf(
      SmsNotConfigured,
    );
    await expect(
      postWhatsAppLoginCode({ ...CONFIG, phoneNumberId: '' }, '+27824497310', '1', vi.fn()),
    ).rejects.toBeInstanceOf(SmsNotConfigured);
  });

  it('posts to the Graph API with the bearer token and the code, and reports success on a message id', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(true, { messages: [{ id: 'wamid.X' }] }));
    const ok = await postWhatsAppLoginCode(CONFIG, '+27824497310', '482913', fetchImpl);
    expect(ok).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://graph.facebook.com/v21.0/1234567890/messages');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer T0KEN');
    expect(init.body).toContain('482913');
  });

  it('reports failure (never throws) when Meta rejects the send', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(false, { error: { message: 'bad' } }));
    expect(await postWhatsAppLoginCode(CONFIG, '+27824497310', '1', fetchImpl)).toBe(false);
  });

  it('reports failure when the response carries no message id', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(true, { messages: [] }));
    expect(await postWhatsAppLoginCode(CONFIG, '+27824497310', '1', fetchImpl)).toBe(false);
  });
});
