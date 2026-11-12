/**
 * Election Campaign OS — public site, how seats are calculated
 * (`/tools/how-seats-are-calculated`)
 *
 * Opens on the real 2021 JB Marks result, because a worked example that
 * can be checked against the Electoral Commission's own report teaches
 * more than an invented one, and because the page then has nothing
 * invented on it. The 2021 figures are history, on 2021 boundaries, and
 * are labelled that way; this is not a forecast and says nothing about
 * 2026.
 *
 * The arithmetic is the application's own `allocateSeats`, which
 * reproduces every figure on that report (see `seatCalculator.test.ts`).
 * It is a teaching tool. Results are declared by the Electoral
 * Commission.
 */
import { useMemo, useState } from 'react';
import { Eyebrow, SiteCard, SiteSection } from '../SiteChrome';
import { SiteVideo } from '../SiteVideo';
import { allocateSeats } from '@/modules/analytics/seatCalculator';
import { NW405_2021_EXAMPLE } from '@/modules/analytics/nw405Example';
import { IEC_LINK } from '../officialSources';

interface Row {
  id: string;
  name: string;
  votes: string;
  ward: string;
}

const EXAMPLE_ROWS: Row[] = NW405_2021_EXAMPLE.parties.map((p) => ({
  id: p.id,
  name: p.name,
  votes: String(p.votes),
  ward: String(p.wardSeatsWon),
}));

const nf = new Intl.NumberFormat('en-ZA');

function num(s: string): number {
  const n = Number(s.replace(/[\s,]/g, ''));
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

export function SiteSeatTool() {
  const [seats, setSeats] = useState(String(NW405_2021_EXAMPLE.totalSeats));
  const [rows, setRows] = useState<Row[]>(EXAMPLE_ROWS);
  const isExample = useMemo(
    () => seats === '67' && JSON.stringify(rows) === JSON.stringify(EXAMPLE_ROWS),
    [seats, rows],
  );

  const totalVotes = rows.reduce((n, r) => n + num(r.votes), 0);

  const out = useMemo(() => {
    try {
      const data = allocateSeats({
        totalSeats: num(seats),
        totalValidVotes: totalVotes,
        parties: rows.map((r) => ({
          id: r.id,
          name: r.name || r.id,
          votes: num(r.votes),
          wardSeatsWon: num(r.ward),
        })),
      });
      return { data, error: null as string | null };
    } catch (e) {
      return {
        data: null,
        error: e instanceof Error ? e.message : 'Check the numbers.',
      };
    }
  }, [seats, rows, totalVotes]);

  const update = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const d = out.data;

  return (
    <>
      <SiteSection className="pb-8 pt-[88px]">
        <div className="flex max-w-[760px] flex-col gap-4">
          <Eyebrow>Voter Tool</Eyebrow>
          <h1 className="m-0 font-site-display text-site-h3 md:text-site-h2">
            How Seats Are Calculated
          </h1>
          <p className="m-0 text-site-lead">
            In a council with wards, some councillors win a ward and the rest are filled from party
            lists so that the whole council reflects the vote. Change the numbers and watch each
            step.
          </p>
        </div>
      </SiteSection>

      <SiteSection className="pb-8">
        <div className="grid gap-6 ">
          <SiteVideo id="seats-won" className="max-w-[560px]" />
        </div>
      </SiteSection>

      <SiteSection labelledBy="how-h" className="pb-8">
        <div className="flex max-w-[760px] flex-col gap-4">
          <h2 id="how-h" className="m-0 font-site-display text-site-h4">
            The Steps
          </h2>
          <ol className="m-0 flex list-decimal flex-col gap-2 pl-5 text-site-base">
            <li>
              Work out a <strong>quota</strong>: the number of votes that earns one seat.
            </li>
            <li>
              Divide each party’s votes by the quota. The whole number is the seats it is{' '}
              <strong>entitled</strong> to.
            </li>
            <li>
              Take away the ward seats the party has already won. What is left is its{' '}
              <strong>PR seats</strong>.
            </li>
            <li>
              Seats still unfilled go to the parties with the largest leftover votes (the{' '}
              <strong>remainder</strong>).
            </li>
          </ol>
        </div>
      </SiteSection>

      <SiteSection labelledBy="calc-h" className="pb-8">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-6">
          <SiteCard className="flex min-w-0 flex-col gap-4 p-6">
            <h2 id="calc-h" className="m-0 font-site-display text-site-h5">
              {isExample ? 'Worked Example: JB Marks, 2021' : 'Your Numbers'}
            </h2>
            <p className="m-0 text-site-caption text-slate">
              {isExample
                ? 'The real 2021 result, on 2021 boundaries, from the Electoral Commission’s seat calculation report. It is history, not a forecast for 2026.'
                : 'Your own figures. Nothing here is a real result.'}
            </p>
            <label htmlFor="seats" className="font-semibold">
              Seats in the Council
            </label>
            <input
              id="seats"
              inputMode="numeric"
              className="site-field"
              value={seats}
              onChange={(e) => setSeats(e.target.value)}
            />
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse text-site-sm">
                <thead>
                  <tr className="border-b border-line text-left">
                    <th scope="col" className="py-2 pr-2">
                      Party
                    </th>
                    <th scope="col" className="py-2 pr-2">
                      Votes
                    </th>
                    <th scope="col" className="py-2">
                      Ward Seats Won
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.id} className="border-b border-line">
                      <th scope="row" className="py-1.5 pr-2 text-left font-normal">
                        <label htmlFor={`name-${i}`} className="sr-only">
                          Party {i + 1} Name
                        </label>
                        <input
                          id={`name-${i}`}
                          className="site-field min-h-[44px]"
                          value={r.name}
                          onChange={(e) => update(i, { name: e.target.value })}
                        />
                      </th>
                      <td className="py-1.5 pr-2">
                        <label htmlFor={`votes-${i}`} className="sr-only">
                          {r.name} Votes
                        </label>
                        <input
                          id={`votes-${i}`}
                          inputMode="numeric"
                          className="site-field min-h-[44px] text-right font-mono"
                          value={r.votes}
                          onChange={(e) => update(i, { votes: e.target.value })}
                        />
                      </td>
                      <td className="py-1.5">
                        <label htmlFor={`ward-${i}`} className="sr-only">
                          {r.name} Ward Seats Won
                        </label>
                        <input
                          id={`ward-${i}`}
                          inputMode="numeric"
                          className="site-field min-h-[44px] !w-24 text-right font-mono"
                          value={r.ward}
                          onChange={(e) => update(i, { ward: e.target.value })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="site-btn-outline-ink"
                onClick={() =>
                  setRows((rs) => [
                    ...rs,
                    {
                      id: `P${rs.length + 1}-${Date.now()}`,
                      name: `Party ${rs.length + 1}`,
                      votes: '0',
                      ward: '0',
                    },
                  ])
                }
              >
                Add a Party
              </button>
              <button
                type="button"
                className="site-btn-outline-ink"
                onClick={() => {
                  setSeats('67');
                  setRows(EXAMPLE_ROWS);
                }}
              >
                Reset to the 2021 Example
              </button>
            </div>
          </SiteCard>

          <SiteCard className="flex min-w-0 flex-col gap-4 p-6">
            <h2 className="m-0 font-site-display text-site-h5">The Result</h2>
            <div role="status" aria-live="polite" className="flex flex-col gap-3">
              {out.error && <p className="m-0 text-site-sm">{out.error}</p>}
              {d && (
                <>
                  <p className="m-0 text-site-sm">
                    <strong>Quota</strong> = ({nf.format(totalVotes)} votes ÷ {num(seats)} seats),
                    rounded down, plus 1 ={' '}
                    <span className="font-mono font-medium">{nf.format(d.quota)}</span> votes a
                    seat.
                  </p>
                  <div className="relative overflow-x-auto">
                    <table className="w-full min-w-[420px] border-collapse text-site-sm">
                      <caption className="sr-only">Seats by Party</caption>
                      <thead>
                        <tr className="border-b border-line text-left">
                          <th scope="col" className="py-2 pr-2">
                            Party
                          </th>
                          <th scope="col" className="py-2 pr-2 text-right">
                            Entitled
                          </th>
                          <th scope="col" className="py-2 pr-2 text-right">
                            Ward
                          </th>
                          <th scope="col" className="py-2 pr-2 text-right">
                            PR
                          </th>
                          <th scope="col" className="py-2 text-right">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.parties.map((p) => (
                          <tr key={p.id} className="border-b border-line">
                            <th scope="row" className="py-1.5 pr-2 text-left font-normal">
                              {p.name}
                            </th>
                            <td className="py-1.5 pr-2 text-right font-mono">
                              {p.quotaEntitlement}
                            </td>
                            <td className="py-1.5 pr-2 text-right font-mono">{p.wardSeatsWon}</td>
                            <td className="py-1.5 pr-2 text-right font-mono">{p.prSeats}</td>
                            <td className="py-1.5 text-right font-mono font-semibold">
                              {p.totalSeats}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {d.excessiveParties.length > 0 && (
                    <p className="m-0 text-site-sm">
                      A party won as many ward seats as its votes entitle it to, or more. It keeps
                      every ward seat and takes no list seats, and the other parties are counted
                      again with a new quota of {d.newQuota ?? 'not set'} (Schedule 1, item 16).
                    </p>
                  )}
                  {d.councilSizeFinal > num(seats) && (
                    <p className="m-0 text-site-sm">
                      After that recalculation the council is shown as {d.councilSizeFinal} seats,
                      more than its proclaimed {num(seats)}. The Act does not say what follows.
                    </p>
                  )}
                  {d.pendingSeats > 0 && (
                    <p className="m-0 text-site-sm">
                      {d.pendingSeats} seat{d.pendingSeats === 1 ? '' : 's'} could not be awarded
                      because parties are level on both the remainder and the votes. The Act breaks
                      a tie on the remainder by votes and is silent on a tie on both, so this tool
                      leaves the seat open.
                    </p>
                  )}
                </>
              )}
            </div>
          </SiteCard>
        </div>
      </SiteSection>

      <SiteSection className="pb-[88px]">
        <p className="m-0 max-w-[48em] text-site-caption text-slate">
          This is a teaching tool. It follows the quota printed on the Electoral Commission’s seat
          calculation report for JB Marks in 2021, Q = (A ÷ (B − C − D)) + 1, with no independent or
          list-less ward winners. Official results are declared by the Electoral Commission, and
          this tool does not predict any election. The Commission’s own explainer:{' '}
          <a href={IEC_LINK.seatsExplainer} className="font-semibold text-teal">
            how council seats are calculated
          </a>
          .
        </p>
      </SiteSection>
    </>
  );
}
