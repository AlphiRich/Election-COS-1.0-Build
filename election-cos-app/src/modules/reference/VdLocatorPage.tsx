/**
 * Election Campaign OS — Voting-district locator (/analytics/vd-locator)
 *
 * Find a voting district by station name, VD code or ward. Counts only; the voters on the roll are never shown here.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BasisNote, Card, Field, PageHeader, SectionLabel, Table, Td, Th } from '@/components/ui';
import { BarChart } from './BarChart';
import { AGE_BANDS, VD_REFERENCE, VD_ROWS, searchVds, seedGap, type VdRow } from './vdReference';

const n = (v: number) => v.toLocaleString('en-ZA');
const SHOW = 40;

export function VdLocatorPage() {
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<VdRow | null>(null);
  const hits = searchVds(q);

  return (
    <div className="space-y-6">
      <PageHeader slug="/analytics/vd-locator" title="Voting-district locator" />
      <BasisNote>
        {VD_ROWS.length} voting districts in JB Marks from the certified roll (edition{' '}
        {VD_REFERENCE.rollEdition}). Station names are as the Commission prints them. For the age
        profile of the whole municipality see{' '}
        <Link to="/analytics/voter-statistics">voter statistics</Link>.
      </BasisNote>

      <Card>
        <Field
          label="Search by station, VD code or ward"
          hint="For example: church, 86821094, ward 7."
        >
          {(props) => (
            <input {...props} type="search" value={q} onChange={(e) => setQ(e.target.value)} />
          )}
        </Field>
        <p className="text-body-md font-body mt-2" role="status">
          {hits.length === 0
            ? 'No voting district matches.'
            : `${hits.length} match${hits.length === 1 ? '' : 'es'}${hits.length > SHOW ? `, showing ${SHOW}` : ''}.`}
        </p>
        <Table caption="Voting districts matching the search.">
          <thead>
            <tr>
              <Th>Station</Th>
              <Th>Ward</Th>
              <Th>VD</Th>
              <Th numeric>Verified (roll)</Th>
              <Th numeric>Registered (seed)</Th>
              <Th>
                <span className="sr-only">Open</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {hits.slice(0, SHOW).map((r) => (
              <tr key={`${r.wardCode}-${r.vdCode}`}>
                <Td>{r.station}</Td>
                <Td>{r.wardNumber}</Td>
                <Td numeric>{r.vdCode}</Td>
                <Td numeric>{n(r.verified)}</Td>
                <Td numeric>{r.registeredSeed === null ? 'none' : n(r.registeredSeed)}</Td>
                <Td>
                  <button
                    type="button"
                    className="min-h-11 underline"
                    onClick={() => setPicked(r)}
                    aria-label={`Show detail for ${r.station}`}
                  >
                    Detail
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {picked && (
        <Card>
          <SectionLabel as="h2">{picked.station}</SectionLabel>
          <p className="text-body-md font-body mt-1">
            Ward {picked.wardNumber} · VD <span className="font-mono">{picked.vdCode}</span> ·{' '}
            {n(picked.verified)} verified voters, {n(picked.rejected)} rejected entries.
            {picked.registeredSeed !== null && seedGap(picked) !== 0 && (
              <>
                {' '}
                The seed lists {n(picked.registeredSeed)} registered here,{' '}
                {n(Math.abs(seedGap(picked) as number))}{' '}
                {(seedGap(picked) as number) > 0 ? 'more' : 'fewer'} than the roll. They are
                different documents.
              </>
            )}
          </p>
          <BarChart
            title="Verified voters by age band"
            bars={AGE_BANDS.map((b) => ({
              label: b,
              value: picked.ageBands[b],
              shown: picked.ageBands[b] === null ? '' : n(picked.ageBands[b] as number),
            }))}
            orientation="column"
            valueLabel="Verified voters"
            caption={`Verified voters by age band at ${picked.station}.`}
          />
        </Card>
      )}
    </div>
  );
}
