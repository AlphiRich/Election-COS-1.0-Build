import { describe, expect, it } from 'vitest';
import { loadPoll, pollConfig, sendAnswer } from './pollClient';

const cfg = { url: 'https://x.example/poll', siteKey: 'k' };
const reply = (status: number, body: unknown) =>
  (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe('pollConfig', () => {
  it('needs both settings and an https address', () => {
    expect(pollConfig({})).toBeNull();
    expect(pollConfig({ VITE_POLL_URL: 'https://a.b/poll' })).toBeNull();
    expect(
      pollConfig({ VITE_POLL_URL: 'http://a.b/poll', VITE_TURNSTILE_SITE_KEY: 'k' }),
    ).toBeNull();
    expect(pollConfig({ VITE_POLL_URL: 'https://a.b/poll', VITE_TURNSTILE_SITE_KEY: 'k' })).toEqual(
      {
        url: 'https://a.b/poll',
        siteKey: 'k',
      },
    );
  });
});

describe('loadPoll', () => {
  it('returns the definition', async () => {
    const r = await loadPoll(
      cfg,
      'abc12345',
      reply(200, {
        ok: true,
        open: true,
        question: 'Q?',
        options: ['A', 'B'],
        organiser: 'O',
        tokenMode: 'open',
      }),
    );
    expect(r).toMatchObject({
      ok: true,
      poll: { question: 'Q?', options: ['A', 'B'], open: true },
    });
  });
  it('reports not found and network failure in plain words', async () => {
    expect(await loadPoll(cfg, 'x', reply(404, { ok: false, message: 'No such poll.' }))).toEqual({
      ok: false,
      message: 'No such poll.',
    });
    const down = (async () => Promise.reject(new Error('net'))) as unknown as typeof fetch;
    expect((await loadPoll(cfg, 'x', down)).ok).toBe(false);
  });
});

describe('sendAnswer', () => {
  const base = {
    pollId: 'abc12345',
    option: 'A',
    channel: 'website',
    consent: true,
    turnstileToken: 't',
  };
  it('is ok only when the server says ok', async () => {
    expect(await sendAnswer(cfg, base, reply(200, { ok: true }))).toEqual({ ok: true });
    expect(
      await sendAnswer(cfg, base, reply(409, { ok: false, message: 'This poll has closed.' })),
    ).toEqual({
      ok: false,
      message: 'This poll has closed.',
    });
  });
  it('never claims success when the request fails', async () => {
    const down = (async () => Promise.reject(new Error('net'))) as unknown as typeof fetch;
    expect((await sendAnswer(cfg, base, down)).ok).toBe(false);
  });
  it('sends nothing but the poll answer fields', async () => {
    let body = '';
    const spy = (async (_u: string, init: RequestInit) => {
      body = String(init.body);
      return new Response('{"ok":true}');
    }) as unknown as typeof fetch;
    await sendAnswer(cfg, base, spy);
    expect(Object.keys(JSON.parse(body)).sort()).toEqual(
      ['channel', 'consent', 'option', 'pollId', 'turnstileToken'].sort(),
    );
  });
});
