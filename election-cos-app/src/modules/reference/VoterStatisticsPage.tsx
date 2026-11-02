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
import {
  AGE_BANDS,
  VD_REFERENCE,
  VD_ROWS,
  WARD_ROWS,
  bandShare,
  seedGap,
  sumBand,
} from './vdReference';

const n = (v: number) => v.toLocaleString('en-ZA');
const pct = (f: number) => `${(f * 100).toFixed(0)}%`;

export function VoterStatisticsPage() {
  const [ward, setWard] = useState<number>(WARD_ROWS[0]?.wardNumber ?? 1);
  const rank = useMemo(
    () =>
      WARD_ROWS.map((w) => ({ w, s: bandShare(w, '18-29') }))
        .sort((a, b) => (b.s ?? -1) - (a.s ?? -1))
        .map<Bar>(({ w, s }) => ({
          label: `Ward ${w.wardNumber}`,
          value: s === null ? null : Math.round(s * 1000) / 10,
          shown: s === null ? '' : pct(s),
          detail: `${n(w.verified)} verified voters`,
        })),
    [],
  );
  const municipality: Bar[] = AGE_BANDS.map((b) => {
    const v = sumBand(WARD_ROWS, b);
    return { label: b, value: v, shown: v === null ? '' : n(v) };
  });
  const sel = WARD_ROWS.find((w) => w.wardNumber === ward)!;
  const wardBars: Bar[] = AGE_BANDS.map((b) => ({
    label: b,
    value: sel.ageBands[b],
    shown: sel.ageBands[b] === null ? '' : n(sel.ageBands[b] as number),
  }));
  const vds = VD_ROWS.filter((r) => r.wardNumber === ward);
  const seedTotal = VD_ROWS.reduce((s, r) => s + (r.registeredSeed ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader slug="/analytics/voter-statistics" title="Voter statistics" />
      <BasisNote>
        Counts from the Electoral Commission&rsquo;s certified voters&rsquo; roll for JB Marks
        (edition {VD_REFERENCE.rollEdition}), by ward and age on {VD_REFERENCE.ageAt}.{' '}
        {VD_REFERENCE.ageBandsNote} No name, address or ID number is held here. See{' '}
        <Link to="/analytics/vd-locator">the voting-district locator</Link>.
      </BasisNote>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Verified voters (roll)"
          value={n(VD_REFERENCE.totals.verified)}
          sub="certified roll"
          emphasis
        />
        <StatTile
          label="Rejected entries"
          value={n(VD_REFERENCE.totals.rejected)}
          sub="on the roll's rejected list"
        />
        <StatTile label="Wards" value={WARD_ROWS.length} sub="proclaimed 7 Aug 2026" />
        <StatTile
          label="Voting districts"
          value={new Set(VD_ROWS.map((r) => r.vdCode)).size}
          sub={`${VD_REFERENCE.reconciliation.vdsNotMatchingCommissionTotals} differ from the Commission's printed totals`}
        />
      </div>

      <Card>
        <SectionLabel as="h2">Two numbers for registered voters</SectionLabel>
        <p className="text-body-md font-body mt-1">
          The certified roll holds <strong>{n(VD_REFERENCE.totals.verified)}</strong> verified
          voters. The seed built from the delimitation gazette holds <strong>{n(seedTotal)}</strong>{' '}
          registered voters for the same districts. They are different documents and are not
          reconciled here; quote whichever you can cite, and say which (SOP-14).
        </p>
      </Card>

      <Card>
        <SectionLabel as="h2">Age profile, whole municipality</SectionLabel>
        <BarChart
          title="Verified voters by age band"
          bars={municipality}
          orientation="column"
          valueLabel="Verified voters"
          caption="Verified voters by age band on polling day, whole municipality."
        />
      </Card>

      <Card>
        <SectionLabel as="h2">Which wards are youngest</SectionLabel>
        <p className="text-body-md font-body text-slate mt-1">
          Share of each ward&rsquo;s verified voters aged 18 to 29, highest first.
        </p>
        <BarChart
          title="Share aged 18 to 29, by ward"
          bars={rank}
          orientation="row"
          valueLabel="Share aged 18 to 29 (%)"
          caption="Share of verified voters aged 18 to 29, by ward."
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
        <p className="text-body-md font-body mt-2">
          {n(sel.verified)} verified voters, {n(sel.rejected)} rejected entries.
        </p>
        <BarChart
          title={`Ward ${ward}: verified voters by age band`}
          bars={wardBars}
          orientation="column"
          valueLabel="Verified voters"
          caption={`Verified voters by age band, ward ${ward}.`}
        />
        <Table caption={`Voting districts in ward ${ward}.`}>
          <thead>
            <tr>
              <Th>Station</Th>
              <Th>VD</Th>
              <Th numeric>Verified (roll)</Th>
              <Th numeric>Registered (seed)</Th>
              <Th numeric>Seed minus roll</Th>
            </tr>
          </thead>
          <tbody>
            {vds.map((r) => (
              <tr key={r.vdCode}>
                <Td>{r.station}</Td>
                <Td numeric>{r.vdCode}</Td>
                <Td numeric>{n(r.verified)}</Td>
                <Td numeric>{r.registeredSeed === null ? 'none' : n(r.registeredSeed)}</Td>
                <Td numeric>{seedGap(r) === null ? '' : n(seedGap(r) as number)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
