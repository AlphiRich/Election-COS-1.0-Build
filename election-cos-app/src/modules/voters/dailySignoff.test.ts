import { describe, expect, it } from 'vitest';
import {
  SIGNOFF_SCHEMA,
  buildSignoff,
  sastDay,
  signoffHtml,
  type SignoffInput,
} from './dailySignoff';

const base = (over: Partial<SignoffInput> = {}): SignoffInput => ({
  day: '2026-11-04',
  wardCode: 'NW405-W31',
  vdCode: '86999001',
  households: [],
  voters: [],
  incidents: [],
  pendingSync: 0,
  now: new Date('2026-11-04T16:00:00Z'),
  ...over,
});
const hh = (status: string, at: string, over = {}) =>
  ({
    wardCode: 'NW405-W31',
    vdCode: '86999001',
    contactStatus: status,
    lastContactedAt: at,
    ...over,
  }) as never;
const voter = (sentiment: string, at: string, over = {}) =>
  ({
    wardCode: 'NW405-W31',
    vdCode: '86999001',
    createdAt: at,
    sentiment,
    popiaConsentGiven: true,
    deletedAt: null,
    ...over,
  }) as never;
const DAY = '2026-11-04T08:00:00Z';

describe('VD daily sign-off', () => {
  const s = buildSignoff(
    base({
      households: [
        hh('CONTACTED', DAY),
        hh('CONTACTED', DAY),
        hh('NO_ANSWER', DAY),
        hh('INACCESSIBLE', DAY),
        hh('REFUSED_RECONTACT', DAY),
        hh('CONTACTED', '2026-11-03T08:00:00Z'), // yesterday
        hh('CONTACTED', DAY, { vdCode: '86999002' }), // another station
      ],
      voters: [
        voter('STRONG_SUPPORT', DAY),
        voter('UNDECIDED', DAY),
        voter('LEAN_SUPPORT', DAY),
        voter('STRONG_SUPPORT', DAY, { popiaConsentGiven: false }),
        voter('STRONG_SUPPORT', DAY, { deletedAt: '2026-11-04' }),
        voter('STRONG_SUPPORT', '2026-11-03T08:00:00Z'),
      ],
      incidents: [
        { wardCode: 'NW405-W31', category: 'ELECTRICITY', createdAt: DAY },
        { wardCode: 'NW405-W99', category: 'ELECTRICITY', createdAt: DAY },
      ] as never,
    }),
  );
  it('counts the day’s doors for this station only, by the state they were left in', () => {
    expect(s.doors).toEqual({
      contacted: 2,
      noAnswer: 1,
      inaccessible: 1,
      askedNotToBeContacted: 1,
      total: 5,
    });
  });
  it('counts only consented, undeleted captures from the day, and the supportive ones among them', () => {
    expect(s.capturedWithConsent).toBe(3);
    expect(s.supportiveResponses).toBe(2);
    expect(s.capturesPerContact).toBe(1.5);
  });
  it('counts this ward’s incidents by category', () => {
    expect(s.incidentsByCategory).toEqual({ ELECTRICITY: 1 });
  });
  it('uses the SAST day, so 23:30 on polling day is still polling day', () => {
    expect(sastDay('2026-11-04T21:30:00Z')).toBe('2026-11-04');
    expect(sastDay('2026-11-04T22:00:00Z')).toBe('2026-11-05');
  });
  it('raises no capture-rate alert unless the campaign set a level, and never invents one', () => {
    expect(buildSignoff(base({ households: [hh('CONTACTED', DAY)] })).alert).toBe('OK');
    expect(
      buildSignoff(base({ households: [hh('CONTACTED', DAY)], reviewBelowCapturesPerContact: 0.5 }))
        .alert,
    ).toBe('REVIEW_CAPTURE_RATE');
  });
  it('puts unsynced work first: a sign-off with work still on a phone is not a sign-off', () => {
    expect(
      buildSignoff(
        base({
          pendingSync: 3,
          households: [hh('CONTACTED', DAY)],
          reviewBelowCapturesPerContact: 0.5,
        }),
      ).alert,
    ).toBe('SYNC_PENDING');
    expect(buildSignoff(base({ pendingSync: null })).alert).toBe('OK');
  });
  it('is counts only: no name, no id, no per-canvasser breakdown, and no pledge', () => {
    const text = JSON.stringify(s) + signoffHtml(s);
    expect(Object.keys(s)).not.toContain('byCanvasser');
    expect(text).not.toMatch(/uid|lastContactedBy|firstName|lastName|idNumber/i);
    expect(JSON.stringify(Object.keys(s))).not.toMatch(/pledge/i);
    expect(s.schema).toBe(SIGNOFF_SCHEMA);
  });
  it('is stand-alone and says supportive responses are not pledges or predictions', () => {
    const html = signoffHtml(s);
    expect(html).not.toMatch(/<script|src=|href=|@import|url\(/i);
    expect(html).toMatch(/not pledges and not a prediction/);
    expect(html).toContain('VD Captain');
  });
});
