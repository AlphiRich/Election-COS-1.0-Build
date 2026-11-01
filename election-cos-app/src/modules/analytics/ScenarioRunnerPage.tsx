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
import { NW405_2021_EXAMPLE } from './nw405Example';
import {
  MAX_DRAWS,
  MIN_DRAWS,
  RUNNER_CAVEAT,
  runScenarios,
  sensitivity,
  type RunnerResult,
  type RunnerSpec,
} from './scenarioRunner';

const PARTIES = NW405_2021_EXAMPLE.parties.filter((p) => p.votes >= 2_000);
const pct = (f: number) => `${(f * 100).toFixed(1)}%`;

export function ScenarioRunnerPage() {
  const [mean, setMean] = useState<Record<string, number>>({});
  const [sd, setSd] = useState<Record<string, number>>({});
  const [turnoutMean, setTurnoutMean] = useState<number>(NW405_2021_EXAMPLE.totalValidVotes);
  const [turnoutSd, setTurnoutSd] = useState(0);
  const [zeroSum, setZeroSum] = useState(true);
  const [draws, setDraws] = useState(2000);
  const [seed, setSeed] = useState(1);
  const [target, setTarget] = useState(PARTIES[0]?.id ?? '');
  const [result, setResult] = useState<RunnerResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const spec: RunnerSpec = useMemo(
    () => ({ swingMean: mean, swingSd: sd, turnoutMean, turnoutSd, zeroSum, draws, seed }),
    [mean, sd, turnoutMean, turnoutSd, zeroSum, draws, seed],
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
        <SectionLabel as="h2">Your assumptions</SectionLabel>
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
          <Field label="Valid votes (mean)" mono>
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
          <Field label="Valid votes (spread)" mono>
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
          <Button onClick={run}>Run scenarios</Button>
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
              Seats across {result.draws.toLocaleString('en-ZA')} draws
            </SectionLabel>
            <p className="text-caption font-body text-slate mt-1">{result.caveat}</p>
            <Table caption="Council seats per party across the draws, against the certified 2021 council.">
              <thead>
                <tr>
                  <Th>Party</Th>
                  <Th numeric>2021</Th>
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
            <SectionLabel as="h2">Outright majority, within these assumptions</SectionLabel>
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
            <SectionLabel as="h2">Which assumption matters most</SectionLabel>
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
            <SectionLabel as="h2">Wards that change hands most often</SectionLabel>
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
