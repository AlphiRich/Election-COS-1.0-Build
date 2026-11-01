/**
 * Election Campaign OS — public site, election-day clock
 *
 * Voting hours come from section 45(1) of the Local Government: Municipal
 * Electoral Act 27 of 2000: unless the Commission determines other voting
 * hours for an election in general or for a particular voting station, a
 * voting station opens at 07:00 and stays open until 21:00. The Commission
 * can change that (section 45(2)), and this build has not seen a notice
 * that does, so the ribbon says "unless the Commission announces otherwise"
 * rather than stating the hours as settled for every station.
 *
 * South Africa Standard Time is UTC+2 all year, with no daylight saving,
 * so the instants are fixed UTC values and the clock does not depend on the
 * visitor's own time zone.
 */
export const ELECTION_DAY_LABEL = 'Wednesday 4 November 2026';

/** 07:00 SAST. */
export const VOTING_OPENS = Date.UTC(2026, 10, 4, 5, 0, 0);
/** 21:00 SAST. */
export const VOTING_CLOSES = Date.UTC(2026, 10, 4, 19, 0, 0);

export const HOURS_BASIS =
  'Municipal Electoral Act 27 of 2000, section 45(1): a voting station opens at 07:00 and stays open until 21:00 unless the Commission determines other hours.';

export type ClockPhase = 'before' | 'open' | 'closed';

export interface VotingClock {
  phase: ClockPhase;
  /** Milliseconds to the next event; 0 once voting has closed. */
  msToNext: number;
}

export function votingClock(nowMs: number): VotingClock {
  if (nowMs < VOTING_OPENS) return { phase: 'before', msToNext: VOTING_OPENS - nowMs };
  if (nowMs < VOTING_CLOSES) return { phase: 'open', msToNext: VOTING_CLOSES - nowMs };
  return { phase: 'closed', msToNext: 0 };
}

/** "2 days 05:41:09" or "03:12:44". Whole seconds, rounded down. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const hms = [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
  return days > 0 ? `${days} ${days === 1 ? 'day' : 'days'} ${hms}` : hms;
}

/**
 * Special votes, 2 and 3 November 2026, for voters who applied (applications
 * closed on 12 October). Dates are from the Electoral Commission's 2026
 * election timetable as summarised in `docs/iec-election-timetable-2026.md`.
 *
 * Special-vote HOURS are deliberately not stated: the only source this
 * build has seen for them is a local news report, not the Commission.
 *
 * Day boundaries are midnight South African time, which is 22:00 UTC the
 * evening before.
 */
export const SPECIAL_VOTES_START = Date.UTC(2026, 10, 1, 22, 0, 0); // 00:00 on 2 Nov SAST
export const SPECIAL_VOTES_END = Date.UTC(2026, 10, 3, 22, 0, 0); // 00:00 on 4 Nov SAST
const DAY_MS = 24 * 3600 * 1000;
const SPECIAL_LAST_DAY_START = SPECIAL_VOTES_END - DAY_MS;

export type SpecialVotesPhase = 'upcoming' | 'tomorrow' | 'today' | 'last-day' | 'over';

export function specialVotesPhase(nowMs: number): SpecialVotesPhase {
  if (nowMs >= SPECIAL_VOTES_END) return 'over';
  if (nowMs >= SPECIAL_LAST_DAY_START) return 'last-day';
  if (nowMs >= SPECIAL_VOTES_START) return 'today';
  if (nowMs >= SPECIAL_VOTES_START - DAY_MS) return 'tomorrow';
  return 'upcoming';
}

/** The ribbon sentence, or null once special votes are over. */
export function specialVotesNotice(nowMs: number): string | null {
  switch (specialVotesPhase(nowMs)) {
    case 'upcoming':
      return 'Special votes: 2 and 3 November, for voters who applied.';
    case 'tomorrow':
      return 'Special votes start tomorrow, 2 November, and run 2 and 3 November, for voters who applied.';
    case 'today':
      return 'Special votes are under way today, 2 November, and continue on 3 November, for voters who applied.';
    case 'last-day':
      return 'Last day of special votes today, 3 November, for voters who applied.';
    case 'over':
      return null;
  }
}
