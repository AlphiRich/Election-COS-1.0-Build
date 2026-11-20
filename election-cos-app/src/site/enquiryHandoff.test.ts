import { describe, expect, it } from 'vitest';
import { SALES_MAILBOX, handoff } from './enquiryHandoff';

const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};

describe('handoff', () => {
  const fd = form({
    name: 'Thandi Mokoena',
    role: 'Ward councillor',
    interest: 'Book a Demo',
    municipality: 'JB Marks',
    ward: '12',
    demoWindow: 'weekday mornings',
    mobile: '',
    email: 'thandi@example.co.za',
    consent: 'on',
    website: 'bot-honeypot',
  });
  const h = handoff(fd, true, '[V1.0]');

  it('goes to the sales mailbox and the sales WhatsApp line', () => {
    expect(SALES_MAILBOX).toBe('sales@electioncos.co.za');
    expect(h.mailto.startsWith('mailto:sales@electioncos.co.za?subject=')).toBe(true);
    expect(h.whatsApp.startsWith('https://wa.me/27824497310?text=')).toBe(true);
  });

  it('carries what the visitor typed, under the form’s labels, and leaves empty fields out', () => {
    expect(h.subject).toBe('Demo request: Thandi Mokoena');
    expect(h.body).toContain('Name: Thandi Mokoena');
    expect(h.body).toContain('When suits me: weekday mornings');
    expect(h.body).not.toContain('Mobile:');
    expect(decodeURIComponent(h.mailto)).toContain('Ward: 12');
  });

  it('records consent and the wording version, and never copies the honeypot field', () => {
    expect(h.body).toContain('Consent to be contacted about this request: yes (wording [V1.0])');
    expect(h.body).toContain('Product updates: no');
    expect(h.body).not.toContain('bot-honeypot');
  });
});
