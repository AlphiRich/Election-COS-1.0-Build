/**
 * Election Campaign OS — public site, seat allocation model
 * (`/for-campaigns/seat-model`)
 *
 * A mobile-first what-if model for campaign teams, in four tabs: Setup,
 * Parties, Results, Charts. The arithmetic is `tools/seatModel.ts`, which
 * sits on the regression-tested allocator; this file is only the surface.
 * It opens on the real 2021 JB Marks result, labelled as history, and
 * says what it is and is not in plain words: a what-if, not a forecast,
 * and not an official result.
 *
 * Charts are plain bars in HTML rather than a charting library: they scale
 * to a phone, read with a screen reader, and carry their numbers as text.
 */
import { useMemo, useRef, useState } from 'react';
import { SiteCard, SiteSection } from '../SiteChrome';
import { SiteVideo } from '../SiteVideo';
import { PageIntro, SourceNote } from './pageParts';
import { IEC_LINK } from '../officialSources';
import { searchCouncils } from '../tools/councilFinder';
import { NW405_2021_EXAMPLE } from '@/modules/analytics/nw405Example';
import { CSV_MAX_BYTES, parseCsv, runModel } from '../tools/seatModel';

interface Row {
  id: string;
  name: string;
  pr: string;
  ward: string;
}

const EXAMPLE_ROWS: Row[] = NW405_2021_EXAMPLE.parties.map((p) => ({
  id: p.id,
  name: p.name,
  pr: String(p.votes),
  ward: String(p.wardSeatsWon),
}));

const nf = new Intl.NumberFormat('en-ZA');
const num = (s: string) => {
  const n = Number(s.replace(/[\s,]/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

const TABS = [
  { id: 'setup', label: 'Setup' },
  { id: 'parties', label: 'Parties' },
  { id: 'results', label: 'Results' },
  { id: 'charts', label: 'Charts' },
] as const;
type TabId = (typeof TABS)[number]['id'];

const SEVERITY = {
  blocking: 'border-maroon',
  warning: 'border-gold',
  info: 'border-teal',
} as const;

export function SiteSeatModel() {
  const [tab, setTab] = useState<TabId>('results');
  const [code, setCode] = useState('NW405');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<Row[]>(EXAMPLE_ROWS);
  const [indep, setIndep] = useState('0');
  const [noList, setNoList] = useState('0');
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => searchCouncils(query).filter((c) => c.wards !== null), [query]);
  const isExample =
    code === 'NW405' &&
    indep === '0' &&
    noList === '0' &&
    JSON.stringify(rows) === JSON.stringify(EXAMPLE_ROWS);

  const model = useMemo(
    () =>
      runModel({
        municipalityCode: code,
        independentWardSeats: num(indep),
        noPRListWardSeats: num(noList),
        parties: rows.map((r) => ({
          id: r.id,
          name: r.name,
          prVotes: num(r.pr),
          wardSeatsWon: num(r.ward),
        })),
      }),
    [code, rows, indep, noList],
  );

  const update = (id: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > CSV_MAX_BYTES) return setCsvErrors(['The file is too large for this tool.']);
    const reader = new FileReader();
    reader.onload = () => {
      const r = parseCsv(String(reader.result ?? ''));
      setCsvErrors(r.errors);
      if (r.errors.length === 0) {
        setRows(
          r.parties.map((p) => ({
            id: p.id,
            name: p.name,
            pr: String(p.prVotes),
            ward: String(p.wardSeatsWon),
          })),
        );
        setTab('parties');
      }
    };
    reader.readAsText(file);
  }

  const out = model.ok ? model.output : null;
  const seatsMax = out ? Math.max(out.result.councilSizeFinal, out.majority) : 0;
  const ranked = out
    ? [...out.result.parties].sort((a, b) => b.totalSeats - a.totalSeats || b.votes - a.votes)
    : [];

  return (
    <>
      <PageIntro
        eyebrow="For Parties and Campaign Teams"
        title="Seat Allocation Model"
        lead="Enter proportional-ballot votes and ward wins for a municipality and see how the seats fall. Council size and wards come from the proclaimed delimitation, not from a guess."
      />

      <SiteSection className="pb-4">
        <div
          role="tablist"
          aria-label="Model Sections"
          className="flex max-w-[760px] gap-1 rounded-[10px] border border-line bg-white p-1"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              onClick={() => setTab(t.id)}
              className={`min-h-[48px] min-w-0 flex-1 rounded-md px-1 text-site-sm font-semibold ${tab === t.id ? 'bg-ink text-paper' : 'text-ink'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </SiteSection>

      <SiteSection className="pb-8">
        <div className="grid gap-6 ">
          <SiteVideo id="scenario-runner" className="max-w-[560px]" />
        </div>
      </SiteSection>

      <SiteSection className="pb-10">
        <div className="flex max-w-[900px] flex-col gap-5">
          <p className="m-0 text-site-caption text-slate">
            {isExample
              ? 'Showing the real 2021 JB Marks result, on 2021 boundaries, from the Electoral Commission’s seat calculation report. It is history, not a forecast for 2026.'
              : 'Showing your own figures. Nothing here is a real result and nothing is a forecast.'}
          </p>

          {/* ------------------------------------------------ setup */}
          <div
            role="tabpanel"
            id="panel-setup"
            aria-labelledby="tab-setup"
            hidden={tab !== 'setup'}
            className="flex flex-col gap-5"
          >
            <SiteCard className="flex flex-col gap-3 p-6">
              <h2 className="m-0 font-site-display text-site-h5">Municipality</h2>
              <label htmlFor="sm-search" className="font-semibold">
                Search Municipalities
              </label>
              <input
                id="sm-search"
                type="search"
                className="site-field"
                value={query}
                autoComplete="off"
                placeholder="Name or province"
                onChange={(e) => {
                  const next = e.target.value;
                  setQuery(next);
                  const found = searchCouncils(next).filter((c) => c.wards !== null);
                  if (found.length > 0 && !found.some((m) => m.code === code))
                    setCode(found[0].code);
                }}
              />
              <label htmlFor="sm-pick" className="font-semibold">
                Municipality ({matches.length} With Wards)
              </label>
              <select
                id="sm-pick"
                className="site-field"
                value={matches.some((m) => m.code === code) ? code : ''}
                onChange={(e) => setCode(e.target.value)}
              >
                {matches.map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.name} · {m.province}
                  </option>
                ))}
              </select>
              {out && (
                <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(min(100%,120px),1fr))] gap-3">
                  <div>
                    <dt className="text-site-caption text-slate">Councillors</dt>
                    <dd className="m-0 font-mono text-site-h5 font-medium">
                      {out.council.councillors}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-site-caption text-slate">Wards</dt>
                    <dd className="m-0 font-mono text-site-h5 font-medium">{out.council.wards}</dd>
                  </div>
                  <div>
                    <dt className="text-site-caption text-slate">PR seats</dt>
                    <dd className="m-0 font-mono text-site-h5 font-medium">
                      {out.council.prSeats}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-site-caption text-slate">Voters on the roll</dt>
                    <dd className="m-0 font-mono text-site-h5 font-medium">
                      {nf.format(out.council.registeredVoters)}
                    </dd>
                  </div>
                </dl>
              )}
              <p className="m-0 text-site-caption text-slate">
                Council size is fixed for this cycle by the delimitation (Annexure A to IEC Circular
                1 of 2025), so it cannot be overridden here.
              </p>
            </SiteCard>

            <SiteCard className="flex flex-col gap-3 p-6">
              <h2 className="m-0 font-site-display text-site-h5">
                Wards Not Won by a Listed Party
              </h2>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-4">
                <div className="flex flex-col gap-1">
                  <label htmlFor="sm-c" className="font-semibold">
                    Independent Ward Seats
                  </label>
                  <input
                    id="sm-c"
                    inputMode="numeric"
                    className="site-field font-mono"
                    value={indep}
                    onChange={(e) => setIndep(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="sm-d" className="font-semibold">
                    Ward Seats Won by Parties With No PR List
                  </label>
                  <input
                    id="sm-d"
                    inputMode="numeric"
                    className="site-field font-mono"
                    value={noList}
                    onChange={(e) => setNoList(e.target.value)}
                  />
                </div>
              </div>
              <p className="m-0 text-site-caption text-slate">
                Both are taken out of the quota’s denominator, because those seats do not take part
                in the proportional allocation. Leave them at 0 if you are unsure.
              </p>
            </SiteCard>

            <SiteCard className="flex flex-col gap-3 p-6">
              <h2 className="m-0 font-site-display text-site-h5">Import a CSV</h2>
              <p className="m-0 text-site-sm">
                A header row, then <span className="font-mono">Name,PRVotes,WardSeats</span> for
                each party. Whole numbers with no spaces or commas.
              </p>
              <div className="flex flex-wrap gap-3">
                <label htmlFor="sm-file" className="site-btn-outline-ink cursor-pointer">
                  Choose a CSV File
                </label>
                <input
                  id="sm-file"
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  onChange={(e) => {
                    onFile(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  className="site-btn-outline-ink"
                  onClick={() => {
                    setCode('NW405');
                    setRows(EXAMPLE_ROWS);
                    setIndep('0');
                    setNoList('0');
                    setCsvErrors([]);
                  }}
                >
                  Load the 2021 JB Marks Example
                </button>
              </div>
              <div role="status" aria-live="polite">
                {csvErrors.length > 0 && (
                  <ul className="m-0 list-disc pl-5 text-site-sm">
                    {csvErrors.slice(0, 6).map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                )}
              </div>
            </SiteCard>
          </div>

          {/* ---------------------------------------------- parties */}
          <div
            role="tabpanel"
            id="panel-parties"
            aria-labelledby="tab-parties"
            hidden={tab !== 'parties'}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="m-0 font-site-display text-site-h5">Contesting Parties</h2>
              <button
                type="button"
                className="site-btn-primary"
                onClick={() =>
                  setRows((rs) => [
                    ...rs,
                    { id: `p-${Date.now()}`, name: `Party ${rs.length + 1}`, pr: '0', ward: '0' },
                  ])
                }
              >
                Add a Party
              </button>
            </div>
            {rows.map((r, i) => (
              <SiteCard key={r.id} className="flex flex-col gap-3 border-l-[6px] border-l-ink p-4">
                <div className="flex items-center gap-2">
                  <label htmlFor={`sm-n-${i}`} className="sr-only">
                    Party {i + 1} Name
                  </label>
                  <input
                    id={`sm-n-${i}`}
                    className="site-field min-w-0 flex-1 font-semibold"
                    value={r.name}
                    onChange={(e) => update(r.id, { name: e.target.value })}
                  />
                  <button
                    type="button"
                    className="min-h-[48px] rounded-md border border-line px-3 font-semibold text-maroon"
                    onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}
                    aria-label={`Remove ${r.name}`}
                  >
                    Remove
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor={`sm-pr-${i}`}
                      className="text-site-caption font-semibold text-slate"
                    >
                      PR Ballot Votes
                    </label>
                    <input
                      id={`sm-pr-${i}`}
                      inputMode="numeric"
                      className="site-field text-right font-mono"
                      value={r.pr}
                      onChange={(e) => update(r.id, { pr: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor={`sm-w-${i}`}
                      className="text-site-caption font-semibold text-slate"
                    >
                      Ward Seats Won
                    </label>
                    <input
                      id={`sm-w-${i}`}
                      inputMode="numeric"
                      className="site-field text-right font-mono"
                      value={r.ward}
                      onChange={(e) => update(r.id, { ward: e.target.value })}
                    />
                  </div>
                </div>
              </SiteCard>
            ))}
            <p className="m-0 text-site-caption text-slate">
              Only PR-ballot votes set the quota. Who wins a ward is entered as ward seats won;
              ward-ballot vote totals are not needed.
            </p>
          </div>

          {/* ---------------------------------------------- results */}
          <div
            role="tabpanel"
            id="panel-results"
            aria-labelledby="tab-results"
            hidden={tab !== 'results'}
            className="flex flex-col gap-4"
          >
            <div role="status" aria-live="polite" className="flex flex-col gap-4">
              {!model.ok && (
                <SiteCard className="border-l-[6px] border-l-maroon p-5">
                  <p className="m-0 font-semibold">The model cannot run</p>
                  <p className="mb-0 mt-1 text-site-sm">{model.reason}</p>
                </SiteCard>
              )}
              {out && (
                <>
                  <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(min(100%,150px),1fr))] gap-3">
                    <Metric label="Council Seats" value={String(out.result.councilSizeFinal)} />
                    <Metric label="Quota (Votes a Seat)" value={nf.format(out.result.quota)} />
                    <Metric
                      label="Ward / PR"
                      value={`${out.council.wards} / ${out.council.prSeats}`}
                    />
                    <Metric label="PR Votes ÷ Roll" value={`${out.turnoutPercent}%`} />
                    <Metric label="More Than Half" value={`${out.majority} seats`} />
                  </dl>
                  {out.findings.map((f) => (
                    <p
                      key={f.text}
                      className={`m-0 rounded-md border-l-[6px] bg-white p-3 text-site-sm ${SEVERITY[f.severity]}`}
                    >
                      {f.text}
                    </p>
                  ))}
                  <div className="relative overflow-x-auto rounded-[10px] border border-line bg-white">
                    <table className="w-full min-w-[520px] border-collapse text-site-sm">
                      <caption className="sr-only">Seats by Party</caption>
                      <thead>
                        <tr className="border-b border-line text-left">
                          <th scope="col" className="px-3 py-2">
                            Party
                          </th>
                          <th scope="col" className="px-3 py-2 text-right">
                            PR Votes
                          </th>
                          <th scope="col" className="px-3 py-2 text-right">
                            Entitled
                          </th>
                          <th scope="col" className="px-3 py-2 text-right">
                            Ward
                          </th>
                          <th scope="col" className="px-3 py-2 text-right">
                            PR
                          </th>
                          <th scope="col" className="px-3 py-2 text-right">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {ranked.map((p) => (
                          <tr key={p.id} className="border-b border-line">
                            <th scope="row" className="px-3 py-1.5 text-left font-semibold">
                              {p.name}
                              {p.excessive && (
                                <span className="block text-site-caption font-normal text-slate">
                                  Excessive seats: keeps its ward seats, takes no list seats
                                </span>
                              )}
                            </th>
                            <td className="px-3 py-1.5 text-right font-mono">
                              {nf.format(p.votes)}
                            </td>
                            <td className="px-3 py-1.5 text-right font-mono">
                              {p.quotaEntitlement}
                            </td>
                            <td className="px-3 py-1.5 text-right font-mono">{p.wardSeatsWon}</td>
                            <td className="px-3 py-1.5 text-right font-mono">{p.prSeats}</td>
                            <td className="px-3 py-1.5 text-right font-mono font-semibold">
                              {p.totalSeats}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ---------------------------------------------- charts */}
          <div
            role="tabpanel"
            id="panel-charts"
            aria-labelledby="tab-charts"
            hidden={tab !== 'charts'}
            className="flex flex-col gap-5"
          >
            {!out && (
              <p className="m-0 text-site-sm">Fix the issue on the Results tab to see charts.</p>
            )}
            {out && (
              <>
                <SiteCard className="flex flex-col gap-3 p-6">
                  <h2 className="m-0 font-site-display text-site-h5">Seats by Party</h2>
                  <p className="m-0 flex flex-wrap gap-x-5 gap-y-1 text-site-caption text-slate">
                    <span>
                      <span
                        className="mr-1.5 inline-block h-3 w-3 bg-ink align-middle"
                        aria-hidden="true"
                      />
                      Ward seats
                    </span>
                    <span>
                      <span
                        className="mr-1.5 inline-block h-3 w-3 bg-gold align-middle"
                        aria-hidden="true"
                      />
                      PR seats
                    </span>
                    <span>
                      <span
                        className="mr-1.5 inline-block h-3 w-0.5 bg-maroon align-middle"
                        aria-hidden="true"
                      />
                      More than half ({out.majority})
                    </span>
                  </p>
                  <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {ranked
                      .filter((p) => p.totalSeats > 0)
                      .map((p) => (
                        <li
                          key={p.id}
                          className="grid grid-cols-[minmax(5rem,9rem)_1fr_2.5rem] items-center gap-2 text-site-sm"
                        >
                          <span className="min-w-0 truncate">{p.name}</span>
                          <span className="relative block h-5 bg-paper">
                            <span
                              className="absolute inset-y-0 left-0 bg-ink"
                              style={{ width: `${(p.wardSeatsWon / seatsMax) * 100}%` }}
                            />
                            <span
                              className="absolute inset-y-0 bg-gold"
                              style={{
                                left: `${(p.wardSeatsWon / seatsMax) * 100}%`,
                                width: `${(p.prSeats / seatsMax) * 100}%`,
                              }}
                            />
                            <span
                              className="absolute inset-y-[-3px] w-0.5 bg-maroon"
                              style={{ left: `${(out.majority / seatsMax) * 100}%` }}
                              aria-hidden="true"
                            />
                          </span>
                          <span className="text-right font-mono font-semibold">{p.totalSeats}</span>
                        </li>
                      ))}
                  </ul>
                  <p className="m-0 text-site-caption text-slate">
                    A bar that reaches the red line holds more than half the council on its own.
                  </p>
                </SiteCard>

                <SiteCard className="flex flex-col gap-3 p-6">
                  <h2 className="m-0 font-site-display text-site-h5">
                    Share of Votes and Share of Seats
                  </h2>
                  <p className="m-0 flex flex-wrap gap-x-5 gap-y-1 text-site-caption text-slate">
                    <span>
                      <span
                        className="mr-1.5 inline-block h-3 w-3 bg-slate align-middle"
                        aria-hidden="true"
                      />
                      Share of PR votes
                    </span>
                    <span>
                      <span
                        className="mr-1.5 inline-block h-3 w-3 bg-teal align-middle"
                        aria-hidden="true"
                      />
                      Share of seats
                    </span>
                  </p>
                  <ul className="m-0 flex list-none flex-col gap-3 p-0">
                    {ranked
                      .filter((p) => p.totalSeats > 0 || p.votes > 0)
                      .map((p) => {
                        const v = (p.votes / out.totalValidVotes) * 100;
                        const s = (p.totalSeats / out.result.councilSizeFinal) * 100;
                        return (
                          <li key={p.id} className="text-site-sm">
                            <div className="mb-1 flex flex-wrap justify-between gap-x-3">
                              <span className="min-w-0 font-semibold">{p.name}</span>
                              <span className="font-mono text-site-caption text-slate">
                                {v.toFixed(1)}% of votes · {s.toFixed(1)}% of seats
                              </span>
                            </div>
                            <span className="block h-2 bg-paper">
                              <span
                                className="block h-2 bg-slate"
                                style={{ width: `${Math.min(100, v)}%` }}
                              />
                            </span>
                            <span className="mt-1 block h-2 bg-paper">
                              <span
                                className="block h-2 bg-teal"
                                style={{ width: `${Math.min(100, s)}%` }}
                              />
                            </span>
                          </li>
                        );
                      })}
                  </ul>
                  <p className="m-0 text-site-caption text-slate">
                    The gap between the two bars is the effect of winning wards on top of
                    proportional seats.
                  </p>
                </SiteCard>
              </>
            )}
          </div>
        </div>
      </SiteSection>

      <SourceNote>
        What-if model, not a forecast and not an official result: the Electoral Commission declares
        results. It uses the quota on the Commission’s own 2021 JB Marks seat calculation report, Q
        = (A ÷ (B − C − D)) + 1, with A the PR-ballot votes, B the council size, C independent ward
        seats and D ward seats won by parties with no PR list. Council size and ward counts:
        Annexure A to IEC Circular 1 of 2025. The model applies no minimum vote threshold. The
        Commission’s own explainer:{' '}
        <a href={IEC_LINK.seatsExplainer} className="font-semibold text-teal">
          how council seats are calculated
        </a>
        .
      </SourceNote>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-line bg-white p-4">
      <dt className="text-site-caption text-slate">{label}</dt>
      <dd className="m-0 font-mono text-site-h5 font-medium">{value}</dd>
    </div>
  );
}
