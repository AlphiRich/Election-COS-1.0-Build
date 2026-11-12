import { describe, expect, it } from 'vitest';
import {
  SECOND_FACTOR_CODE_TTL_MS,
  SECOND_FACTOR_SESSION_SECONDS,
  SmsNotConfigured,
  requestSecondFactor,
  requiresSecondFactor,
  verifySecondFactor,
  type Deps,
  type SecondFactorChallenge,
  type SecondFactorStore,
} from './secondFactor';

function memory(phone: string | null = '082 123 4567') {
  const rows = new Map<string, SecondFactorChallenge>();
  const store: SecondFactorStore = {
    staffPhone: async () => phone,
    latest: async (_t, uid) =>
      [...rows.values()].filter((r) => r.uid === uid).sort((a, b) => b.createdAt - a.createdAt)[0] ?? null,
    create: async (_t, c) => {
      const id = `c${rows.size + 1}`;
      rows.set(id, c);
      return id;
    },
    get: async (_t, id) => rows.get(id) ?? null,
    update: async (_t, id, patch) => void rows.set(id, { ...rows.get(id)!, ...patch }),
  };
  return { rows, store };
}
const who = { tenantId: 't1', uid: 'u1', roleId: 'ward-lead' };

function harness(opts: { phone?: string | null; send?: Deps['send']; now?: number } = {}) {
  const m = memory(opts.phone === undefined ? '082 123 4567' : opts.phone);
  const sent: Array<{ to: string; message: string }> = [];
  let now = opts.now ?? 1_700_000_000_000;
  const deps: Deps = {
    store: m.store,
    send: opts.send ?? (async (to, message) => (sent.push({ to, message }), true)),
    now: () => now,
  };
  return { ...m, deps, sent, advance: (ms: number) => (now += ms) };
}
const codeOf = (message: string) => /code: (\d{6})/.exec(message)![1];

describe('who needs a second factor', () => {
  it('everyone except the canvasser, and anything unknown', () => {
    for (const r of ['party-hq-admin', 'municipal-team-lead', 'ward-lead', 'vd-captain', 'compliance-officer', 'finance-officer']) {
      expect(requiresSecondFactor(r)).toBe(true);
    }
    expect(requiresSecondFactor('canvasser')).toBe(false);
    expect(requiresSecondFactor(undefined)).toBe(true);
    expect(requiresSecondFactor('some-new-role')).toBe(true);
  });
});

describe('request', () => {
  it('canvasser: nothing is sent', async () => {
    const h = harness();
    expect(await requestSecondFactor(h.deps, { ...who, roleId: 'canvasser' })).toEqual({ kind: 'NOT_REQUIRED' });
    expect(h.sent).toEqual([]);
  });
  it('sends to the number on the profile, in E.164, and stores only a mask', async () => {
    const h = harness();
    const r = await requestSecondFactor(h.deps, who);
    expect(r.kind).toBe('SENT');
    expect(h.sent[0].to).toBe('+27821234567');
    const stored = JSON.stringify([...h.rows.values()]);
    expect(stored).not.toContain('821234567');
    expect(stored).not.toContain(codeOf(h.sent[0].message));
  });
  it('no number on file, or an invalid one: refused, nothing sent', async () => {
    for (const phone of [null, '12345']) {
      const h = harness({ phone });
      expect(await requestSecondFactor(h.deps, who)).toEqual({ kind: 'NO_PHONE' });
      expect(h.sent).toEqual([]);
    }
  });
  it('a second request inside the cooldown is refused', async () => {
    const h = harness();
    await requestSecondFactor(h.deps, who);
    expect(await requestSecondFactor(h.deps, who)).toEqual({ kind: 'COOLDOWN' });
    h.advance(61_000);
    expect((await requestSecondFactor(h.deps, who)).kind).toBe('SENT');
  });
  it('no SMS provider: reports NOT_CONFIGURED and never claims it sent', async () => {
    const h = harness({ send: async () => { throw new SmsNotConfigured(); } });
    expect(await requestSecondFactor(h.deps, who)).toEqual({ kind: 'NOT_CONFIGURED' });
    expect([...h.rows.values()][0].status).toBe('DELIVERY_FAILED');
  });
});

describe('verify', () => {
  async function sentChallenge(h: ReturnType<typeof harness>) {
    const r = await requestSecondFactor(h.deps, who);
    if (r.kind !== 'SENT') throw new Error('not sent');
    return { id: r.challengeId, code: codeOf(h.sent[0].message) };
  }
  it('the right code verifies and grants a 12 hour window', async () => {
    const h = harness();
    const { id, code } = await sentChallenge(h);
    const r = await verifySecondFactor(h.deps, who, id, code);
    expect(r).toEqual({ kind: 'VERIFIED', mfaUntil: Math.floor(1_700_000_000_000 / 1000) + SECOND_FACTOR_SESSION_SECONDS });
  });
  it('a wrong guess spends an attempt and the right code still works after', async () => {
    const h = harness();
    const { id, code } = await sentChallenge(h);
    const wrong = code === '000000' ? '000001' : '000000';
    expect(await verifySecondFactor(h.deps, who, id, wrong)).toEqual({ kind: 'WRONG', attemptsRemaining: 4 });
    expect((await verifySecondFactor(h.deps, who, id, code)).kind).toBe('VERIFIED');
  });
  it('five wrong guesses lock the challenge, even against the right code', async () => {
    const h = harness();
    const { id, code } = await sentChallenge(h);
    const wrong = code === '000000' ? '000001' : '000000';
    for (let i = 0; i < 5; i++) await verifySecondFactor(h.deps, who, id, wrong);
    expect((await verifySecondFactor(h.deps, who, id, code)).kind).toBe('LOCKED');
  });
  it('an expired code is refused', async () => {
    const h = harness();
    const { id, code } = await sentChallenge(h);
    h.advance(SECOND_FACTOR_CODE_TTL_MS + 1);
    expect((await verifySecondFactor(h.deps, who, id, code)).kind).toBe('EXPIRED');
  });
  it("another account cannot use someone else's challenge", async () => {
    const h = harness();
    const { id, code } = await sentChallenge(h);
    expect(await verifySecondFactor(h.deps, { ...who, uid: 'someone-else' }, id, code)).toEqual({ kind: 'NOT_FOUND' });
    expect(await verifySecondFactor(h.deps, { ...who, tenantId: 't2' }, id, code)).toEqual({ kind: 'NOT_FOUND' });
  });
  it('a code cannot be used twice', async () => {
    const h = harness();
    const { id, code } = await sentChallenge(h);
    await verifySecondFactor(h.deps, who, id, code);
    expect((await verifySecondFactor(h.deps, who, id, code)).kind).toBe('ALREADY_VERIFIED');
  });
});
