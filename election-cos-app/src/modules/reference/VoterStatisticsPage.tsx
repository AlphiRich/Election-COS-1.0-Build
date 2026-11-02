/**
 * Election Campaign OS — Voter statistics (/analytics/voter-statistics)
 *
 * Counts from the certified roll for JB Marks, by ward and age band. Read vdReference.ts first: no person is in
 * this data, sex cannot be derived, small cells are hidden, and the roll count and the gazette-based seed
 * figure are two different numbers that are both shown.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BasisNote,
  Card,
  Field,
  PageHeader,
  SectionLabel,
  StatTile,
  Table,
  Td,
  Th,
} from '@/components/ui';
import { BarChart, type Bar } from './BarChart';
import { AGE_BANDS, REGISTERED_TOTAL, VD_REFERENCE, VD_ROWS, WARD_ROWS, type AgeMix } from './vdReference';

const n = (v: number) => v.toLocaleString('en-ZA');
const mixBars = (m: AgeMix | null): Bar[] =>
  AGE_BANDS.map((b) => {
    const v = m?.[b] ?? null;
    return { label: b, value: v, shown: v === null ? '' : `${v.toFixed(0)}%` };
  });

export function VoterStatisticsPage() {
  const [ward, setWard] = useState<number>(WARD_ROWS[0]?.wardNumber ?? 1);
  const rank = useMemo(
    () =>
      WARD_ROWS.map((w) => ({ w, s: w.ageMix?.['18-29'] ?? null }))
        .sort((a, b) => (b.s ?? -1) - (a.s ?? -1))
        .map<Bar>(({ w, s }) => ({
          label: `Ward ${w.wardNumber}`,
          value: s,
          shown: s === null ? '' : `${s.toFixed(0)}%`,
          detail: `${n(w.registered)} registered voters`,
        })),
    [],
  );
  const sel = WARD_ROWS.find((w) => w.wardNumber === ward)!;
  const vds = VD_ROWS.filter((r) => r.wardNumber === ward);

  return (
    <div className="space-y-6">
      <PageHeader slug="/analytics/voter-statistics" title="Voter statistics" />
      <BasisNote>
        Registered voters are the gazetted baseline for JB Marks: {n(REGISTERED_TOTAL)} (Electoral
        Commission Circular 1 of 2025), split by ward and voting district in the delimitation
        seed. The age mix is a percentage read from the certified roll (edition{' '}
        {VD_REFERENCE.rollEdition}) on {VD_REFERENCE.ageAt}. {VD_REFERENCE.ageBandsNote} No name,
        address or ID number is held here. See{' '}
        <Link to="/analytics/vd-locator">the voting-district locator</Link>.
      </BasisNote>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Registered voters"
          value={n(REGISTERED_TOTAL)}
          sub="gazetted baseline"
          emphasis
        />
        <StatTile label="Wards" value={WARD_ROWS.length} sub="proclaimed 7 Aug 2026" />
        <StatTile
          label="Voting districts"
          value={new Set(VD_ROWS.map((r) => r.vdCode)).size}
          sub={`${VD_ROWS.length} rows, one per ward a district serves`}
        />
      </div>

      <Card>
        <SectionLabel as="h2">Age profile, whole municipality</SectionLabel>
        <BarChart
          title="Age mix, whole municipality"
          bars={mixBars(VD_REFERENCE.municipalityAgeMix)}
          orientation="column"
          valueLabel="Share of voters (%)"
          caption="Percent of voters whose age could be read from the roll, by age band on polling day."
        />
      </Card>

      <Card>
        <SectionLabel as="h2">Which wards are youngest</SectionLabel>
        <p className="text-body-md font-body text-slate mt-1">
          Share of each ward&rsquo;s voters aged 18 to 29, highest first.
        </p>
        <BarChart
          title="Share aged 18 to 29, by ward"
          bars={rank}
          orientation="row"
          valueLabel="Share aged 18 to 29 (%)"
          caption="Percent of voters aged 18 to 29, by ward."
        />
      </Card>

      <Card>
        <SectionLabel as="h2">One ward</SectionLabel>
        <Field label="Ward">
          {(props) => (
            <select {...props} value={ward} onChange={(e) => setWard(Number(e.target.value))}>
              {WARD_ROWS.map((w) => (
                <option key={w.wardNumber} value={w.wardNumber}>
                  Ward {w.wardNumber}
                </option>
              ))}
            </select>
          )}
        </Field>
        <p className="text-body-md font-body mt-2">{n(sel.registered)} registered voters.</p>
        <BarChart
          title={`Ward ${ward}: age mix`}
          bars={mixBars(sel.ageMix)}
          orientation="column"
          valueLabel="Share of voters (%)"
          caption={`Percent of voters by age band, ward ${ward}.`}
        />
        <Table caption={`Voting districts in ward ${ward}.`}>
          <thead>
            <tr>
              <Th>Station</Th>
              <Th>VD</Th>
              <Th numeric>Registered voters</Th>
            </tr>
          </thead>
          <tbody>
            {vds.map((r) => (
              <tr key={r.vdCode}>
                <Td>{r.station}</Td>
                <Td numeric>{r.vdCode}</Td>
                <Td numeric>{n(r.registered)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
