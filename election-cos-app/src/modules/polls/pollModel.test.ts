import { describe, expect, it } from 'vitest';
import {
  CHANNELS,
  NEUTRAL_OPTIONS,
  MIN_CELL,
  PollDefinitionError,
  SELF_SELECTED_CAVEAT,
  buildDashboard,
  parseTallyKey,
  pollUrl,
  shareLinks,
  tallyKey,
  validateDefinition,
} from './pollModel';

const def = {
  question: 'Which party do you support?',
  options: ['Party A', 'Party B'],
  organiser: 'Ward 7 office',
};

describe('definition validation', () => {
  it('accepts a normal poll', () => expect(() => validateDefinition(def)).not.toThrow());
  it('rejects short questions, too few or duplicate options, and the reserved neutral ones', () => {
    for (const bad of [
      { ...def, question: 'Why?' },
      { ...def, options: ['Only one'] },
      { ...def, options: ['A party', 'a PARTY'] },
      { ...def, options: ['Party A', 'Undecided'] },
      { ...def, options: ['Party A', 'prefer not to say'] },
      { ...def, options: ['Party A', 'B|C'] },
      { ...def, organiser: '  ' },
    ]) {
      expect(() => validateDefinition(bad)).toThrow(PollDefinitionError);
    }
  });
});

describe('tally keys', () => {
  it('round-trips, with a dash for no ward', () => {
    expect(tallyKey('whatsapp', undefined, 'Party A')).toBe('whatsapp|-|Party A');
    expect(parseTallyKey('whatsapp|-|Party A')).toEqual({
      channel: 'whatsapp',
      ward: null,
      option: 'Party A',
    });
    expect(parseTallyKey('a|b')).toBeNull();
  });
});

describe('the dashboard', () => {
  const counts = {
    [tallyKey('website', 'W1', 'A')]: 6,
    [tallyKey('website', 'W1', 'B')]: 4,
    [tallyKey('whatsapp', 'W2', 'A')]: 3,
    [tallyKey('whatsapp', 'W2', 'UNDECIDED')]: 1,
    [tallyKey('app', undefined, 'B')]: 7,
  };
  const d = buildDashboard(counts);
  it('adds up correctly, hand-worked: 6+4+3+1+7 = 21; A=9, B=11, undecided=1', () => {
    expect(d.total).toBe(21);
    expect(Object.fromEntries(d.overall.map((r) => [r.option, r.count]))).toEqual({
      A: 9,
      B: 11,
      UNDECIDED: 1,
    });
    expect(d.overall.reduce((s, r) => s + r.share, 0)).toBeCloseTo(1, 10);
  });
  it('hides any channel or ward with fewer than MIN_CELL responses, but still counts the people', () => {
    expect(MIN_CELL).toBe(5);
    const wa = d.byChannel.find((c) => c.channel === 'whatsapp')!;
    expect(wa.total).toBe(4);
    expect(wa.rows).toBeNull();
    const w2 = d.byWard.find((w) => w.ward === 'W2')!;
    expect(w2.rows).toBeNull();
    expect(d.byWard.find((w) => w.ward === 'W1')!.rows).not.toBeNull();
    expect(d.suppressedCells).toBe(2);
  });
  it('shows no overall figure at all when the whole sample is tiny', () => {
    expect(buildDashboard({ [tallyKey('app', undefined, 'A')]: 3 }).overall).toEqual([]);
  });
  it('carries the self-selected caveat and no margin of error', () => {
    expect(d.caveat).toBe(SELF_SELECTED_CAVEAT);
    expect(JSON.stringify(d)).not.toMatch(/margin|confidence|interval/i);
  });
  it('ignores malformed keys and non-positive counts', () => {
    expect(buildDashboard({ junk: 5, [tallyKey('app', undefined, 'A')]: 0 }).total).toBe(0);
  });
});

describe('share links', () => {
  const links = shareLinks('https://electioncos.co.za', 'abc123', 'Take our poll');
  it('tag each link with its channel and use only HTTPS or the platform scheme', () => {
    for (const l of links) {
      expect(l.href).toMatch(/^(https:\/\/|mailto:|sms:)/);
      expect(decodeURIComponent(l.href)).toContain(`c=${l.channel}`);
    }
    expect(links.map((l) => l.channel)).toEqual(
      expect.arrayContaining(['whatsapp', 'facebook', 'x', 'telegram', 'linkedin']),
    );
  });
  it('builds the poll url with the channel and an optional single-use token', () => {
    expect(pollUrl('https://electioncos.co.za', 'abc', 'whatsapp', 'tok')).toBe(
      'https://electioncos.co.za/poll/abc?c=whatsapp&t=tok',
    );
  });
  it('every channel the links use is one the server accepts', () => {
    for (const l of links) expect(CHANNELS).toContain(l.channel);
  });
});

describe('the server mirrors the model', () => {
  it('accepts exactly the channels the dashboard knows, and the same neutral options', async () => {
    const { readFileSync } = await import('node:fs');
    const path = await import('node:path');
    const src = readFileSync(
      path.resolve(__dirname, '../../../functions/src/pollSubmit.ts'),
      'utf-8',
    );
    const listed = (name: string) =>
      [
        ...(new RegExp(`${name} = \\[([^\\]]*)\\]`).exec(src)?.[1] ?? '').matchAll(/'([^']+)'/g),
      ].map((m) => m[1]);
    expect(listed('CHANNELS')).toEqual([...CHANNELS]);
    expect(listed('NEUTRAL_OPTIONS')).toEqual([...NEUTRAL_OPTIONS]);
  });
});
