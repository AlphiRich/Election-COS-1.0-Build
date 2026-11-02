/**
 * Election Campaign OS — Drill-down (/analytics/drill-down): municipality, ward, voting district.
 *
 * Read drillDown.ts first. The result is 2021 and the registered voters are the 2026 baseline; the page says so.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { WARD_CORRESPONDENCE_CAVEAT } from '@/modules/analytics/wardResults2021';
import {
  BasisNote,
  Card,
  Field,
  PageHeader,
  Pill,
  SectionLabel,
  StatTile,
  Table,
  Td,
  Th,
} from '@/components/ui';
import { BarChart } from '@/modules/reference/BarChart';
import { AGE_BANDS, REGISTERED_TOTAL, WARD_ROWS } from '@/modules/reference/vdReference';
import { drillRows, seatsWon2021, votingDistrictsOf, type SortKey } from './drillDown';

const n = (v: number) => v.toLocaleString('en-ZA');
const p1 = (v: number) => v.toFixed(1);

const SORTS: Array<[SortKey, string]> = [
  ['margin', 'Closest 2021 margin first'],
  ['swing', 'Smallest swing to flip first'],
  ['registered', 'Most registered voters first'],
  ['ward', 'Ward number'],
];

export function DrillDownPage() {
  const [threshold, setThreshold] = useState(5);
  const [sort, setSort] = useState<SortKey>('margin');
  const [ward, setWard] = useState<number | null>(null);
  const rows = drillRows(threshold, sort);
  const close = rows.filter((r) => r.close).length;
  const sel = ward === null ? null : rows.find((r) => r.wardNumber === ward) ?? null;
  const selMix = ward === null ? null : (WARD_ROWS.find((w) => w.wardNumber === ward)?.ageMix ?? null);
  const vds = ward === null ? [] : votingDistrictsOf(ward);

  return (
    <div className="space-y-6">
      <PageHeader slug="/analytics/drill-down" title="Drill-down: municipality, ward, voting district" />
      <BasisNote>
        JB Marks (NW405). Results are the <strong>2021</strong> ward ballot on the 2021 wards; registered voters are the{' '}
        <strong>2026</strong> baseline. {WARD_CORRESPONDENCE_CAVEAT} 2021 only records the winner and the runner-up in
        each ward, so a ward is shown as that two-party contest. For seats see the{' '}
        <Link to="/analytics/scenario-runner">scenario runner</Link>.
      </BasisNote>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Registered voters" value={n(REGISTERED_TOTAL)} sub="gazetted baseline" emphasis />
        <StatTile label="Wards" value={rows.length} sub="34 ward seats" />
        <StatTile label="Close wards" value={close} sub={`2021 margin under ${threshold} points`} />
      </div>

      <Card>
        <SectionLabel as="h2">Ward seats won in 2021</SectionLabel>
        <ul className="mt-2 flex flex-wrap gap-2">
          {seatsWon2021().map(([name, seats]) => (
            <li key={name}>
              <Pill>
                {name}: {seats}
              </Pill>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <SectionLabel as="h2">Wards</SectionLabel>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Sort" >
            {(props) => (
              <select {...props} value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                {SORTS.map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Call a ward close if the 2021 margin is under (points)" hint="A display filter you set. It is not a forecast.">
            {(props) => (
              <input {...props} type="number" min={0} max={100} step={0.5} value={threshold} onChange={(e) => setThreshold(Math.max(0, Number(e.target.value) || 0))} />
            )}
          </Field>
        </div>
        <Table caption="Wards, 2021 ward-ballot result and 2026 registered voters.">
          <thead>
            <tr>
              <Th>Ward</Th>
              <Th>Won by</Th>
              <Th numeric>Share %</Th>
              <Th>Runner-up</Th>
              <Th numeric>Share %</Th>
              <Th numeric>Margin (pts)</Th>
              <Th numeric>Swing to flip (pts)</Th>
              <Th numeric>Registered</Th>
              <Th>
                <span className="sr-only">Open</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.wardNumber}>
                <Td numeric>{r.wardNumber}</Td>
                <Td>{r.winner}</Td>
                <Td numeric>{p1(r.winnerPct)}</Td>
                <Td>{r.runnerUp}</Td>
                <Td numeric>{p1(r.runnerUpPct)}</Td>
                <Td numeric>
                  {p1(r.margin)}
                  {r.close ? ' · close' : ''}
                </Td>
                <Td numeric>{p1(r.swing)}</Td>
                <Td numeric>{n(r.registered)}</Td>
                <Td>
                  <button type="button" className="min-h-11 underline" aria-label={`Open ward ${r.wardNumber}`} onClick={() => setWard(r.wardNumber)}>
                    Open
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {sel && (
        <Card>
          <SectionLabel as="h2">Ward {sel.wardNumber}</SectionLabel>
          <p className="text-body-md font-body mt-1">
            2021: {sel.winner} {p1(sel.winnerPct)}%, {sel.runnerUp} {p1(sel.runnerUpPct)}%, a margin of {p1(sel.margin)}{' '}
            points; a {p1(sel.swing)}-point two-party swing would have changed it. {n(sel.registered)} registered voters
            in the 2026 baseline.
          </p>
          {selMix ? (
            <BarChart
              title={`Ward ${sel.wardNumber}: age mix`}
              bars={AGE_BANDS.map((b) => ({ label: b, value: selMix[b], shown: selMix[b] === null ? '' : `${selMix[b]!.toFixed(0)}%` }))}
              orientation="column"
              valueLabel="Share of voters (%)"
              caption={`Percent of voters by age band, ward ${sel.wardNumber}.`}
            />
          ) : (
            <p className="text-body-md font-body text-slate mt-2">Age mix not available for this ward.</p>
          )}
          <Table caption={`Voting districts in ward ${sel.wardNumber}.`}>
            <thead>
              <tr>
                <Th>Station</Th>
                <Th>VD</Th>
                <Th numeric>Registered voters</Th>
              </tr>
            </thead>
            <tbody>
              {vds.map((v) => (
                <tr key={v.vdCode}>
                  <Td>{v.station}</Td>
                  <Td numeric>{v.vdCode}</Td>
                  <Td numeric>{n(v.registered)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <p className="text-body-md font-body text-slate mt-2">
            2021 results were not recorded per voting district in this build, so none are shown here.
          </p>
        </Card>
      )}
    </div>
  );
}
