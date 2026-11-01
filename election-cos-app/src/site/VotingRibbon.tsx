/**
 * Election Campaign OS — the voting-hours ribbon
 *
 * One line across the top of every page: how long until voting stations
 * open on 4 November, then how long until they close, then a plain
 * statement that voting has closed. The text is visible; it is not a live
 * region, because a screen reader announcing every second would make the
 * page unusable, and the accessible name carries the fixed facts instead.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ELECTION_DAY_LABEL, formatCountdown, votingClock } from './electionDay';

export function VotingRibbon() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const c = votingClock(now);

  return (
    <div
      className="bg-gold text-ink"
      role="region"
      aria-label={`Voting hours on ${ELECTION_DAY_LABEL}: 07:00 to 21:00 unless the Electoral Commission announces otherwise`}
    >
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-x-6 gap-y-1 px-6 py-2 text-site-sm">
        <p className="m-0 min-w-0">
          {c.phase === 'before' && (
            <>
              <strong>Voting opens in</strong>{' '}
              <span className="font-mono font-medium">{formatCountdown(c.msToNext)}</span>
              <span className="hidden sm:inline"> · {ELECTION_DAY_LABEL}, 07:00</span>
            </>
          )}
          {c.phase === 'open' && (
            <>
              <strong>Voting is open. Stations close in</strong>{' '}
              <span className="font-mono font-medium">{formatCountdown(c.msToNext)}</span>
              <span className="hidden sm:inline">
                {' '}
                · 21:00. Anyone in the queue by then may vote.
              </span>
            </>
          )}
          {c.phase === 'closed' && (
            <strong>Voting has closed. Results are declared by the Electoral Commission.</strong>
          )}
        </p>
        <p className="m-0 flex flex-wrap gap-x-4">
          <Link to="/election-day" className="font-semibold text-ink underline">
            Election day guide
          </Link>
          <Link to="/results" className="font-semibold text-ink underline">
            Results
          </Link>
        </p>
      </div>
    </div>
  );
}
