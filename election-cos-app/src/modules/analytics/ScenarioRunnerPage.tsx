/**
 * Election Campaign OS — Scenario Runner (/analytics/scenario-runner)
 *
 * Repeats the Ward Comparison scenario many times with the swings and turnout drawn from the
 * means and spreads YOU set, and shows how the council varies. Read scenarioRunner.ts first: this
 * is a sensitivity instrument over stated assumptions, not a forecast, and the screen says so
 * above every table.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BasisNote,
  Button,
  Card,
  Field,
  PageHeader,
  SectionLabel,
  Table,
  Td,
  Th,
} from '@/components/ui';
import { baselineFor, type Baseline } from './baselines';
import { MUNICIPALITY_CODES, municipality } from '@/modules/lge2026/lge2026Results';
import { PartyListNotice } from './PartyListNotice';
import { SWING_CAVEAT, municipalSwing, wardSwing } from './swing2021to2026';
import {
  MAX_DRAWS,
  MIN_DRAWS,
  RUNNER_CAVEAT,
  runScenarios,
  sensitivity,
  type RunnerResult,
  type RunnerSpec,
} from './scenarioRunner';

/** The parties a swing can be set for: those with at least 2% of the baseline's party votes, largest first, at most ten. */
const modelled = (b: Baseline) =>
  [...b.parties]
    .filter((p) => p.votes / b.totalValidVotes >= 0.02)
    .sort((a, c) => c.votes - a.votes)
    .slice(0, 10);
const pct = (f: number) => `${(f * 100).toFixed(1)}%`;

export function ScenarioRunnerPage() {
  const [code, setCode] = useState('NW405');
  const [year, setYear] = useState<2021 | 2026>(2026);
  const baseline = useMemo(() => baselineFor(code, code === 'NW405' ? year : 2026), [code, year]);
  const PARTIES = useMemo(() => modelled(baseline), [baseline]);
  const [mean, setMean] = useState<Record<string, number>>({});
  const [sd, setSd] = useState<Record<string, number>>({});
  const [turnoutOverride, setTurnoutOverride] = useState<number | null>(null);
  const turnoutMean = turnoutOverride ?? baseline.totalValidVotes;
  const setTurnoutMean = (v: number) => setTurnoutOverride(v);
  const [turnoutSd, setTurnoutSd] = useState(0);
  const [zeroSum, setZeroSum] = useState(true);
  const [draws, setDraws] = useState(2000);
  const [seed, setSeed] = useState(1);
  const [targetPick, setTargetPick] = useState('');
  const target = PARTIES.some((p) => p.id === targetPick) ? targetPick : (PARTIES[0]?.id ?? '');
  const setTarget = setTargetPick;
  const [result, setResult] = useState<RunnerResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const spec: RunnerSpec = useMemo(
    () => ({ swingMean: mean, swingSd: sd, turnoutMean, turnoutSd, zeroSum, draws, seed, baseline }),
    [mean, sd, turnoutMean, turnoutSd, zeroSum, draws, seed, baseline],
  );
  const sens = useMemo(() => (result ? sensitivity(result.spec, target) : []), [result, target]);

  const run = () => {
    try {
      setError(null);
      setResult(runScenarios(spec));
    } catch (e) {
      setResult(null);
      setError((e as Error).message);
    }
  };
  const num =
    (set: (f: (p: Record<string, number>) => Record<string, number>) => void, id: string) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      set((p) => ({ ...p, [id]: Number(e.target.value) }));

  return (
    <div className="space-y-6">
      <PageHeader slug="/analytics/scenario-runner" title="Scenario Runner" />
      <BasisNote>
        {RUNNER_CAVEAT} Every draw goes through the same Schedule 1 calculation as{' '}
        <Link to="/analytics/ward-comparison">Ward Comparison</Link>. Same seed, same answer.
      </BasisNote>

      <Card>
        <SectionLabel as="h2">Starting Point</SectionLabel>
        <div className="grid gap-3 sm:grid-cols-2 mt-2">
          <Field label="Municipality">
            {(props) => (
              <select
                {...props}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setMean({});
                  setSd({});
                  setTurnoutOverride(null);
                  setResult(null);
                }}
              >
                {MUNICIPALITY_CODES.map((c) => (
                  <option key={c} value={c}>
                    {c} {municipality(c).name}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Certified Result to Start From" hint="Only JB Marks has a 2021 ward result in this build.">
            {(props) => (
              <select
                {...props}
                value={code === 'NW405' ? year : 2026}
                disabled={code !== 'NW405'}
                onChange={(e) => {
                  setYear(Number(e.target.value) as 2021 | 2026);
                  setMean({});
                  setSd({});
                  setTurnoutOverride(null);
                  setResult(null);
                }}
              >
                <option value={2026}>2026 (certified)</option>
                <option value={2021}>2021 (superseded delimitation)</option>
              </select>
            )}
          </Field>
        </div>
        <p className="text-body-md font-body text-slate mt-2">
          {baseline.label}: {baseline.totalSeats} council seats, {baseline.results.wards.length} wards,{' '}
          {baseline.totalValidVotes.toLocaleString('en-ZA')} valid votes on the Commission&rsquo;s own definition
          (PR plus ward votes for parties on the PR list).
        </p>
      </Card>

      <Card>
        {baseline.year === 2021 ? (
          <PartyListNotice />
        ) : (
          <p className="text-body-md font-body">
            Swings can be set for every party with at least 2% of the 2026 party votes in this municipality (largest first,
            at most ten). A swing here is a change from the certified 2026 result, for a later contest. Parties below 2%
            keep their 2026 votes and move only with the renormalisation. Where independents lead a ward, the Commission
            publishes them merged into one row, so the ward is modelled as that row against the runner-up.
          </p>
        )}
      </Card>

      {baseline.code === 'NW405' && baseline.year === 2026 && (
        <Card>
          <SectionLabel as="h2">What Moved Between 2021 and 2026 in JB Marks</SectionLabel>
          <Table caption="Share of the party votes (PR plus ward, parties on the PR list) in 2021 and 2026, and the change in points.">
            <thead>
              <tr>
                <Th>Party</Th>
                <Th numeric>2021 %</Th>
                <Th numeric>2026 %</Th>
                <Th numeric>Change (pts)</Th>
              </tr>
            </thead>
            <tbody>
              {municipalSwing()
                .slice(0, 8)
                .map((r) => (
                  <tr key={r.id}>
                    <Td>{r.name}</Td>
                    <Td numeric>{r.share2021.toFixed(1)}</Td>
                    <Td numeric>{r.share2026.toFixed(1)}</Td>
                    <Td numeric>{`${r.swing > 0 ? '+' : ''}${r.swing.toFixed(1)}`}</Td>
                  </tr>
                ))}
            </tbody>
          </Table>
          <p className="text-caption font-body text-slate mt-2">{SWING_CAVEAT}</p>
          <div className="mt-3 space-y-1 text-body-md font-body">
            {wardSwing(['ANC', 'DA', 'EFF', 'VFP']).map((w) => (
              <p key={w.id}>
                {w.id}: across the {w.wards} wards where it finished first or second in 2021, its ward share moved by{' '}
                {w.mean.toFixed(1)} points on average, with a spread of {w.sd.toFixed(1)} points between wards.
              </p>
            ))}
          </div>
          <Button
            variant="ghost"
            onClick={() =>
              setSd((p) => ({
                ...p,
                ...Object.fromEntries(
                  wardSwing(['ANC', 'DA', 'EFF', 'VFP'])
                    .filter((w) => PARTIES.some((x) => x.id === w.id))
                    .map((w) => [w.id, Math.round(w.sd * 2) / 2]),
                ),
              }))
            }
          >
            Use these spreads as my starting spreads
          </Button>
        </Card>
      )}

      <Card>
        <SectionLabel as="h2">Your Assumptions</SectionLabel>
        <p className="text-body-md font-body text-slate mt-1">
          For each party set the swing you expect (points of the valid vote) and how unsure you are
          (spread, in points). A spread of 0 holds that party fixed.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mt-4">
          {PARTIES.map((p) => (
            <div key={p.id} className="grid grid-cols-2 gap-2">
              <Field label={`${p.id} swing`} mono>
                {(props) => (
                  <input
                    {...props}
                    type="number"
                    step="0.5"
                    value={mean[p.id] ?? 0}
                    onChange={num(setMean, p.id)}
                  />
                )}
              </Field>
              <Field label={`${p.id} spread`} mono>
                {(props) => (
                  <input
                    {...props}
                    type="number"
                    step="0.5"
                    min="0"
                    value={sd[p.id] ?? 0}
                    onChange={num(setSd, p.id)}
                  />
                )}
              </Field>
            </div>
          ))}
          <Field label="Valid Votes (Mean)" mono>
            {(props) => (
              <input
                {...props}
                type="number"
                step="1000"
                value={turnoutMean}
                onChange={(e) => setTurnoutMean(Number(e.target.value))}
              />
            )}
          </Field>
          <Field label="Valid Votes (Spread)" mono>
            {(props) => (
              <input
                {...props}
                type="number"
                step="500"
                min="0"
                value={turnoutSd}
                onChange={(e) => setTurnoutSd(Number(e.target.value))}
              />
            )}
          </Field>
          <Field label={`Draws (${MIN_DRAWS} to ${MAX_DRAWS})`} mono>
            {(props) => (
              <input
                {...props}
                type="number"
                step="500"
                value={draws}
                onChange={(e) => setDraws(Number(e.target.value))}
              />
            )}
          </Field>
          <Field label="Seed" mono>
            {(props) => (
              <input
                {...props}
                type="number"
                step="1"
                value={seed}
                onChange={(e) => setSeed(Number(e.target.value))}
              />
            )}
          </Field>
        </div>
        <label className="mt-3 flex items-center gap-2 text-body-md font-body">
          <input type="checkbox" checked={zeroSum} onChange={(e) => setZeroSum(e.target.checked)} />
          Balance the swings (what one party gains, others lose)
        </label>
        <div className="mt-4 flex items-center gap-3">
          <Button onClick={run}>Run Scenarios</Button>
          {error && (
            <span role="alert" className="text-body-md text-maroon">
              {error}
            </span>
          )}
        </div>
      </Card>

      {result && (
        <>
          <Card>
            <SectionLabel as="h2">
              Seats Across {result.draws.toLocaleString('en-ZA')} draws
            </SectionLabel>
            <p className="text-caption font-body text-slate mt-1">{result.caveat}</p>
            <Table caption={`Council seats per party across the draws, against the certified ${baseline.year} council.`}>
              <thead>
                <tr>
                  <Th>Party</Th>
                  <Th numeric>{baseline.year}</Th>
                  <Th numeric>5th</Th>
                  <Th numeric>Median</Th>
                  <Th numeric>95th</Th>
                  <Th numeric>Mean</Th>
                </tr>
              </thead>
              <tbody>
                {result.parties.map((p) => (
                  <tr key={p.id}>
                    <Td>{p.id}</Td>
                    <Td numeric>{p.seats2021}</Td>
                    <Td numeric>{p.p5}</Td>
                    <Td numeric>{p.p50}</Td>
                    <Td numeric>{p.p95}</Td>
                    <Td numeric>{p.mean.toFixed(1)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>

          <Card>
            <SectionLabel as="h2">Outright Majority, Within These Assumptions</SectionLabel>
            <ul className="mt-2 space-y-1 text-body-md font-body">
              {Object.entries(result.majority.byParty).map(([id, f]) => (
                <li key={id}>
                  {id} holds a majority in {pct(f)} of draws
                </li>
              ))}
              <li>No party holds a majority in {pct(result.majority.none)} of draws</li>
            </ul>
            <p className="text-caption font-body text-slate mt-2">
              Sampling error on each figure is at most ±{pct(1.96 * result.majority.seMax)} (95%).
              That is the error from using {result.draws.toLocaleString('en-ZA')} draws, not the
              error in your assumptions.
              {result.tiePendingDraws > 0 &&
                ` In ${result.tiePendingDraws} draws the Act leaves a seat undecided.`}
            </p>
          </Card>

          <Card>
            <SectionLabel as="h2">Which Assumption Matters Most</SectionLabel>
            <Field label="Seats of">
              {(props) => (
                <select {...props} value={target} onChange={(e) => setTarget(e.target.value)}>
                  {PARTIES.map((p) => (
                    <option key={p.id}>{p.id}</option>
                  ))}
                </select>
              )}
            </Field>
            {sens.length === 0 ? (
              <p className="text-body-md text-slate mt-2">
                Give at least one party a spread above 0.
              </p>
            ) : (
              <Table
                caption={`${target} seats when one party's swing moves by minus and plus one spread, others held at their means.`}
              >
                <thead>
                  <tr>
                    <Th>Assumption moved</Th>
                    <Th numeric>Low</Th>
                    <Th numeric>High</Th>
                    <Th numeric>Range</Th>
                  </tr>
                </thead>
                <tbody>
                  {sens.map((r) => (
                    <tr key={r.party}>
                      <Td>{r.party} swing</Td>
                      <Td numeric>{r.low}</Td>
                      <Td numeric>{r.high}</Td>
                      <Td numeric>{r.range}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          <Card>
            <SectionLabel as="h2">Wards That Change Hands Most Often</SectionLabel>
            <ul className="mt-2 space-y-1 text-body-md font-body">
              {[...result.wardFlip]
                .filter((w) => w.frequency > 0)
                .sort((a, b) => b.frequency - a.frequency)
                .slice(0, 8)
                .map((w) => (
                  <li key={w.wardNumber}>
                    Ward {w.wardNumber}: {pct(w.frequency)} of draws
                  </li>
                ))}
              {result.wardFlip.every((w) => w.frequency === 0) && (
                <li>No ward changes hands in any draw.</li>
              )}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
