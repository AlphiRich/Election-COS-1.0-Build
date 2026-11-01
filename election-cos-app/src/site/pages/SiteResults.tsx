/**
 * Election Campaign OS — public site, results (`/results`)
 *
 * The Electoral Commission declares results. This page links to it first,
 * and below that shows a figures board that reads `/results/feed.json`,
 * written by `scripts/results-bot.ts` only when the feed validates. The
 * page rechecks the file every 30 minutes while it is open.
 *
 * With no feed it says so and shows no numbers. It never fills the board
 * with anything it computed, projected or remembered, and it labels
 * everything on the board unofficial.
 */
import { useCallback, useEffect, useState } from 'react';
import { SiteCard, SiteSection } from '../SiteChrome';
import { PageIntro, SourceNote } from './pageParts';
import { lookupMunicipality } from '@/modules/reference/municipalRegister';
import { shares, validateFeed, type ResultsFeed } from '../tools/resultsFeed';

const IEC = 'https://www.elections.org.za';
const EVERY_MS = 30 * 60 * 1000;
const nf = new Intl.NumberFormat('en-ZA');
const BALLOT: Record<string, string> = {
  PR: 'Proportional ballot',
  WARD: 'Ward ballot',
  DISTRICT: 'District ballot',
};

type Load =
  | { state: 'loading' }
  | { state: 'none' }
  | { state: 'invalid' }
  | { state: 'ok'; feed: ResultsFeed; checkedAt: number };

export function SiteResults() {
  const [load, setLoad] = useState<Load>({ state: 'loading' });

  const check = useCallback(async () => {
    try {
      const res = await fetch('/results/feed.json', { cache: 'no-store' });
      if (!res.ok) return setLoad({ state: 'none' });
      const check = validateFeed(await res.json());
      setLoad(
        check.ok ? { state: 'ok', feed: check.feed, checkedAt: Date.now() } : { state: 'invalid' },
      );
    } catch {
      setLoad({ state: 'none' });
    }
  }, []);

  useEffect(() => {
    void check();
    const id = window.setInterval(() => void check(), EVERY_MS);
    return () => window.clearInterval(id);
  }, [check]);

  return (
    <>
      <PageIntro
        eyebrow="Results"
        title="Election results"
        lead="Official results are declared by the Electoral Commission. Start there. The board below shows figures only when a checked feed is available."
      >
        <p className="m-0">
          <a href={IEC} className="site-btn-primary">
            Go to the Electoral Commission’s results
          </a>
        </p>
      </PageIntro>

      <SiteSection labelledBy="board-h" className="pb-10">
        <div className="flex max-w-[900px] flex-col gap-5">
          <h2 id="board-h" className="m-0 font-site-display text-site-h4">
            Figures board (unofficial)
          </h2>
          <div role="status" aria-live="polite" className="flex flex-col gap-4">
            {load.state === 'loading' && <p className="m-0 text-site-sm">Checking for figures…</p>}
            {load.state === 'none' && (
              <SiteCard className="p-6">
                <p className="m-0 font-semibold">No figures yet</p>
                <p className="mb-0 mt-1 text-site-sm">
                  Nothing is shown because no checked feed has been published. This page makes no
                  estimates. Use the Electoral Commission’s results above.
                </p>
              </SiteCard>
            )}
            {load.state === 'invalid' && (
              <SiteCard className="p-6">
                <p className="m-0 font-semibold">The latest feed failed its checks</p>
                <p className="mb-0 mt-1 text-site-sm">
                  The file did not pass validation, so none of it is shown. Use the Electoral
                  Commission’s results above.
                </p>
              </SiteCard>
            )}
            {load.state === 'ok' && (
              <>
                <p className="m-0 text-site-sm text-slate">
                  Figures from {load.feed.source}, produced{' '}
                  {new Date(load.feed.generatedAt).toLocaleString('en-ZA')}. This page rechecks
                  every 30 minutes. Unofficial.
                </p>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-5">
                  {load.feed.municipalities.map((m) => (
                    <SiteCard
                      key={`${m.code}/${m.ballot}`}
                      className="flex min-w-0 flex-col gap-3 p-6"
                    >
                      <h3 className="m-0 font-site-display text-site-h5">
                        {lookupMunicipality(m.code)?.name} · {BALLOT[m.ballot]}
                      </h3>
                      <p className="m-0 text-site-caption text-slate">
                        {m.votingDistrictsReported} of {m.votingDistrictsTotal} voting districts
                        counted
                      </p>
                      <ul className="m-0 flex list-none flex-col gap-2 p-0">
                        {shares(m.parties).map((p) => (
                          <li key={p.name}>
                            <div className="flex justify-between gap-3 text-site-sm">
                              <span className="min-w-0 truncate">{p.name}</span>
                              <span className="font-mono">
                                {nf.format(p.votes)} · {p.percent}%
                              </span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-paper">
                              <div
                                className="h-2 rounded-full bg-ink"
                                style={{ width: `${p.percent}%` }}
                              />
                            </div>
                          </li>
                        ))}
                      </ul>
                    </SiteCard>
                  ))}
                </div>
              </>
            )}
          </div>
          <button
            type="button"
            className="site-btn-outline-ink self-start"
            onClick={() => void check()}
          >
            Check again now
          </button>
        </div>
      </SiteSection>

      <SourceNote>
        Percentages are each party’s share of the votes counted so far on that ballot. They are not
        seats and not a forecast. A party’s share can change a lot as more districts report.
      </SourceNote>
    </>
  );
}
