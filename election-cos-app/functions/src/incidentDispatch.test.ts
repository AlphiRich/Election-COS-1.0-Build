import { describe, expect, it } from 'vitest';
import {
  buildMessage,
  dispatchIncident,
  type DispatchChannel,
  type DispatchDeps,
} from './incidentDispatch';

const incident = {
  id: 'INC-7',
  category: 'ELECTRICITY',
  wardCode: 'NW405-W07',
  description: 'Mrs Dlamini at 14 Church St, 0824497310, no power for 3 days',
  reporterName: 'Mrs Dlamini',
};
const TO = '+27821112222';

function setup(over: Partial<DispatchDeps> = {}, delivered = true) {
  const sent: string[] = [];
  let reserved = 0;
  const channel: DispatchChannel = {
    send: async (_to, text) => {
      sent.push(text);
      return { delivered, providerMessageId: 'm1' };
    },
  };
  const deps: DispatchDeps = {
    enabled: true,
    channel,
    reserve: async () => void reserved++,
    ledger: new Map(),
    ...over,
  };
  return { deps, sent, reserved: () => reserved };
}

describe('incident dispatch', () => {
  it('sends only category, ward and case reference, never the complainant or description', () => {
    const m = buildMessage(incident);
    expect(m).toContain('ELECTRICITY');
    expect(m).toContain('NW405-W07');
    expect(m).toContain('INC-7');
    for (const leak of ['Dlamini', 'Church', '0824497310', 'power']) expect(m).not.toContain(leak);
  });
  it('is off by default: disabled or with no channel it sends nothing and reserves no cost', async () => {
    const a = setup({ enabled: false });
    expect(await dispatchIncident(a.deps, incident, TO)).toEqual({ status: 'DISABLED' });
    const b = setup({ channel: null });
    expect((await dispatchIncident(b.deps, incident, TO)).status).toBe('DISABLED');
    expect(a.sent).toHaveLength(0);
    expect(a.reserved() + b.reserved()).toBe(0);
  });
  it('reserves cost before sending, and does not send if the reservation is refused', async () => {
    const order: string[] = [];
    const deps = setup({
      reserve: async () => void order.push('reserve'),
      channel: { send: async () => (order.push('send'), { delivered: true }) },
    }).deps;
    await dispatchIncident(deps, incident, TO);
    expect(order).toEqual(['reserve', 'send']);
    const refused = setup({ reserve: async () => Promise.reject(new Error('ceiling')) });
    await expect(dispatchIncident(refused.deps, incident, TO)).rejects.toThrow('ceiling');
    expect(refused.sent).toHaveLength(0);
  });
  it('sends once per incident and responder; a retry returns the first outcome without paying again', async () => {
    const s = setup();
    expect((await dispatchIncident(s.deps, incident, TO)).status).toBe('SENT');
    expect(await dispatchIncident(s.deps, incident, TO)).toEqual({
      status: 'DUPLICATE',
      previous: 'SENT',
    });
    expect(s.sent).toHaveLength(1);
    expect(s.reserved()).toBe(1);
    await dispatchIncident(s.deps, incident, '+27823334444'); // a different responder is a different dispatch
    expect(s.sent).toHaveLength(2);
  });
  it('reports a failed or throwing send as FAILED, never as sent', async () => {
    expect((await dispatchIncident(setup({}, false).deps, incident, TO)).status).toBe('FAILED');
    const throwing = setup({ channel: { send: async () => Promise.reject(new Error('net')) } });
    expect((await dispatchIncident(throwing.deps, incident, TO)).status).toBe('FAILED');
  });
});
