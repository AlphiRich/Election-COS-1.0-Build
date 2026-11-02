import { describe, expect, it } from 'vitest';
import {
  handleAnswer,
  handleGetPoll,
  hashToken,
  tallyKey,
  type PollDeps,
  type StoredPoll,
} from './pollSubmit';

const poll: StoredPoll = {
  tenantId: 't1',
  pollId: 'p1',
  publicId: 'abcd1234ef',
  question: 'Which party do you support?',
  options: ['Party A', 'Party B'],
  status: 'OPEN',
  tokenMode: 'open',
  organiser: 'Ward 7 office',
};

function deps(over: Partial<StoredPoll> = {}, d: Partial<PollDeps> = {}) {
  const p = { ...poll, ...over };
  const counts = new Map<string, number>();
  const tokens = new Set<string>();
  const dd: PollDeps = {
    store: {
      findByPublicId: async (id) => (id === p.publicId ? p : null),
      record: async (_p, key, tokenHash) => {
        if (tokenHash) {
          if (tokens.has(tokenHash)) return false;
          tokens.add(tokenHash);
        }
        counts.set(key, (counts.get(key) ?? 0) + 1);
        return true;
      },
    },
    verificationConfigured: true,
    verifyTurnstile: async (t) => t === 'good',
    now: () => new Date('2026-11-02T10:00:00Z'),
    ...d,
  };
  return { dd, counts, tokens };
}
const answer = (over: Record<string, unknown> = {}) => ({
  pollId: poll.publicId,
  option: 'Party A',
  channel: 'whatsapp',
  ward: 'NW405-W07',
  consent: true,
  turnstileToken: 'good',
  ...over,
});

describe('GET definition', () => {
  it('returns the question and options, and nothing about the tenant', async () => {
    const r = await handleGetPoll(poll.publicId, deps().dd);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ question: poll.question, options: poll.options, open: true });
    expect(JSON.stringify(r.body)).not.toContain('t1');
    expect(r.body).not.toHaveProperty('tenantId');
  });
  it('404s for an unknown or malformed id, and reports closed polls as not open', async () => {
    expect((await handleGetPoll('nope', deps().dd)).status).toBe(404);
    expect((await handleGetPoll('zzzzzzzz9', deps().dd)).status).toBe(404);
    expect((await handleGetPoll(poll.publicId, deps({ status: 'CLOSED' }).dd)).body.open).toBe(
      false,
    );
  });
});

describe('answering', () => {
  it('counts one answer under channel|ward|option and stores nothing else', async () => {
    const { dd, counts } = deps();
    const r = await handleAnswer(answer(), dd);
    expect(r.status).toBe(200);
    expect([...counts.keys()]).toEqual([tallyKey('whatsapp', 'NW405-W07', 'Party A')]);
  });
  it('accepts the neutral options and refuses anything not on the poll', async () => {
    const { dd, counts } = deps();
    expect((await handleAnswer(answer({ option: 'UNDECIDED' }), dd)).status).toBe(200);
    expect((await handleAnswer(answer({ option: 'PREFER_NOT_TO_SAY' }), dd)).status).toBe(200);
    expect((await handleAnswer(answer({ option: 'Party Z' }), dd)).status).toBe(400);
    expect((await handleAnswer(answer({ option: 'Party A|x' }), dd)).status).toBe(400);
    expect(counts.size).toBe(2);
  });
  it('ignores unknown and identifying fields: they never reach the store', async () => {
    const { dd, counts } = deps();
    await handleAnswer(
      answer({ name: 'Thandi', phone: '0824497310', idNumber: '8001015009087', note: 'hi' }),
      dd,
    );
    expect(JSON.stringify([...counts.keys()])).not.toMatch(/Thandi|0824|8001/);
  });
  it('maps an unknown channel to other and drops a malformed ward', async () => {
    const { dd, counts } = deps();
    await handleAnswer(answer({ channel: 'carrier-pigeon', ward: 'bad ward!' }), dd);
    expect([...counts.keys()]).toEqual([tallyKey('other', undefined, 'Party A')]);
  });
  it('refuses without consent, with a failed check, or when switched off, and counts nothing', async () => {
    const a = deps();
    expect((await handleAnswer(answer({ consent: false }), a.dd)).status).toBe(400);
    expect((await handleAnswer(answer({ turnstileToken: 'bad' }), a.dd)).status).toBe(400);
    const off = deps({}, { verificationConfigured: false });
    expect((await handleAnswer(answer(), off.dd)).status).toBe(503);
    expect(a.counts.size + off.counts.size).toBe(0);
  });
  it('treats a honeypot hit as success but stores nothing', async () => {
    const { dd, counts } = deps();
    expect((await handleAnswer(answer({ website: 'x' }), dd)).status).toBe(200);
    expect(counts.size).toBe(0);
  });
  it('refuses a closed poll, a poll past its closing time, and a draft', async () => {
    for (const over of [
      { status: 'CLOSED' as const },
      { status: 'DRAFT' as const },
      { closesAt: '2026-11-01T00:00:00Z' },
    ]) {
      expect((await handleAnswer(answer(), deps(over).dd)).status).toBe(409);
    }
  });
});

describe('single-use links', () => {
  const token = 'abcDEF1234567890abcd';
  it('count once per link, refuse a reused link, and need a valid token at all', async () => {
    const { dd, counts, tokens } = deps({ tokenMode: 'single' });
    expect((await handleAnswer(answer({ token }), dd)).status).toBe(200);
    expect((await handleAnswer(answer({ token }), dd)).status).toBe(409);
    expect((await handleAnswer(answer(), dd)).status).toBe(400);
    expect((await handleAnswer(answer({ token: 'short' }), dd)).status).toBe(400);
    expect([...counts.values()]).toEqual([1]);
    expect([...tokens]).toEqual([hashToken(token)]);
  });
  it('stores the token only as a hash', () => {
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).not.toContain(token);
  });
});
