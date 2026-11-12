/**
 * Election Campaign OS — Voting-district locator (/analytics/vd-locator)
 *
 * Find a voting district by station name, VD code or ward. Registered voters are the gazetted baseline (122,059 in
 * total); the age mix is a percentage from the certified roll. No voter is ever shown here.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BasisNote, Card, Field, PageHeader, SectionLabel, Table, Td, Th } from '@/components/ui';
import { BarChart } from './BarChart';
import { AGE_BANDS, REGISTERED_TOTAL, VD_REFERENCE, VD_ROWS, searchVds, type VdRow } from './vdReference';

const n = (v: number) => v.toLocaleString('en-ZA');
const SHOW = 40;

export function VdLocatorPage() {
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<VdRow | null>(null);
  const hits = searchVds(q);

  return (
    <div className="space-y-6">
      <PageHeader slug="/analytics/vd-locator" title="Voting-District Locator" />
      <BasisNote>
        {VD_ROWS.length} voting-district rows in JB Marks, {n(REGISTERED_TOTAL)} registered voters
        in all (the gazetted baseline). Station names are as the Commission prints them. A district
        shared between wards is listed once per ward, with that ward&rsquo;s portion. For the age
        profile see <Link to="/analytics/voter-statistics">voter statistics</Link>.
      </BasisNote>

      <Card>
        <Field
          label="Search by Station, VD Code or Ward"
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
              <Th numeric>Registered voters</Th>
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
                <Td numeric>{n(r.registered)}</Td>
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
            {n(picked.registered)} registered voters
            {picked.split ? ' (this ward’s portion of a shared district)' : ''}.
          </p>
          {picked.ageMix ? (
            <BarChart
              title="Age Mix"
              bars={AGE_BANDS.map((b) => {
                const v = picked.ageMix?.[b] ?? null;
                return { label: b, value: v, shown: v === null ? '' : `${v.toFixed(0)}%` };
              })}
              orientation="column"
              valueLabel="Share of voters (%)"
              caption={`Age mix at ${picked.station}, percent of voters whose age could be read from the roll (${VD_REFERENCE.ageAt}).`}
            />
          ) : (
            <p className="text-body-md font-body text-slate mt-2">
              Age mix not available for this district: it has no matching entry in the certified
              roll, or too few people to show.
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
