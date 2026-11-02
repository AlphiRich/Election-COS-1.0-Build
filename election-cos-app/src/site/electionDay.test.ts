import { describe, expect, it } from 'vitest';
import {
  SPECIAL_VOTES_END,
  SPECIAL_VOTES_START,
  VOTING_CLOSES,
  VOTING_OPENS,
  formatCountdown,
  specialVotesNotice,
  specialVotesPhase,
  votingClock,
} from './electionDay';

describe('election-day clock', () => {
  it('opens at 07:00 and closes at 21:00 South African time, whatever the visitor’s zone', () => {
    // 07:00 SAST is 05:00 UTC; South Africa has no daylight saving.
    expect(new Date(VOTING_OPENS).toISOString()).toBe('2026-11-04T05:00:00.000Z');
    expect(new Date(VOTING_CLOSES).toISOString()).toBe('2026-11-04T19:00:00.000Z');
    expect(VOTING_CLOSES - VOTING_OPENS).toBe(14 * 3600 * 1000);
  });

  it('is before, open or closed at the exact edges', () => {
    expect(votingClock(VOTING_OPENS - 1).phase).toBe('before');
    expect(votingClock(VOTING_OPENS).phase).toBe('open');
    expect(votingClock(VOTING_CLOSES - 1).phase).toBe('open');
    expect(votingClock(VOTING_CLOSES).phase).toBe('closed');
  });

  it('counts down to opening before, to closing during, and stops after', () => {
    expect(votingClock(VOTING_OPENS - 5000).msToNext).toBe(5000);
    expect(votingClock(VOTING_OPENS + 1000).msToNext).toBe(VOTING_CLOSES - VOTING_OPENS - 1000);
    expect(votingClock(VOTING_CLOSES + 1).msToNext).toBe(0);
  });

  it('formats days, hours, minutes and seconds', () => {
    expect(formatCountdown(0)).toBe('00:00:00');
    expect(formatCountdown(3 * 3600e3 + 12 * 60e3 + 44e3)).toBe('03:12:44');
    expect(formatCountdown(86400e3 + 3600e3)).toBe('1 day 01:00:00');
    expect(formatCountdown(2 * 86400e3 + 5 * 3600e3)).toBe('2 days 05:00:00');
    expect(formatCountdown(-5)).toBe('00:00:00');
  });
});

describe('special votes notice', () => {
  it('starts and ends at midnight South African time', () => {
    expect(new Date(SPECIAL_VOTES_START).toISOString()).toBe('2026-11-01T22:00:00.000Z');
    expect(new Date(SPECIAL_VOTES_END).toISOString()).toBe('2026-11-03T22:00:00.000Z');
  });

  it('says “tomorrow” on 1 November, “today” on 2 and 3 November, and nothing after', () => {
    const at = (iso: string) => Date.parse(iso);
    expect(specialVotesPhase(at('2026-11-01T14:00:00+02:00'))).toBe('tomorrow');
    expect(specialVotesNotice(at('2026-11-01T14:00:00+02:00'))).toMatch(/start tomorrow, 2 November/);
    expect(specialVotesPhase(at('2026-10-30T09:00:00+02:00'))).toBe('upcoming');
    expect(specialVotesPhase(at('2026-11-02T00:00:00+02:00'))).toBe('today');
    expect(specialVotesNotice(at('2026-11-02T10:00:00+02:00'))).toMatch(/under way today/);
    expect(specialVotesPhase(at('2026-11-03T12:00:00+02:00'))).toBe('last-day');
    expect(specialVotesNotice(at('2026-11-03T23:59:59+02:00'))).toMatch(/Last day/);
    expect(specialVotesNotice(at('2026-11-04T00:00:00+02:00'))).toBeNull();
  });

  it('never states special-vote hours, which no Commission source in this build gives', () => {
    for (const iso of ['2026-10-30', '2026-11-01', '2026-11-02', '2026-11-03']) {
      expect(specialVotesNotice(Date.parse(`${iso}T12:00:00+02:00`)) ?? '').not.toMatch(/\d{1,2}:\d{2}|h00/);
    }
  });
});
