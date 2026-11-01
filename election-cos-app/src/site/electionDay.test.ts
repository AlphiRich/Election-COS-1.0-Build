import { describe, expect, it } from 'vitest';
import { VOTING_CLOSES, VOTING_OPENS, formatCountdown, votingClock } from './electionDay';

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
