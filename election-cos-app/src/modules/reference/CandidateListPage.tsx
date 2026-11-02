/**
 * Election Campaign OS — JB Marks candidates (/analytics/candidate-list)
 *
 * The Commission's list of candidates for the 4 November 2026 election, as supplemented on 23 October 2026. Names,
 * party and ward or list position. See candidateReference.ts for what is and is not in it.
 */
import { useMemo, useState } from 'react';
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
import {
  CANDIDATES,
  displayName,
  filterCandidates,
  isDual,
  partySummaries,
  type Filter,
} from './candidateReference';

const SHOW = 100;
const titleCase = (s: string) =>
  s
    .toLowerCase()
    .replace(/(^|[\s|(-])(\p{L})/gu, (_m, a: string, b: string) => a + b.toUpperCase());

export function CandidateListPage() {
  const [f, setF] = useState<Filter>({ kind: 'ALL', ward: null, party: '', query: '' });
  const [more, setMore] = useState(false);
  const parties = useMemo(() => partySummaries(), []);
  const hits = useMemo(() => filterCandidates(f), [f]);
  const shown = more ? hits : hits.slice(0, SHOW);
  const set = (p: Partial<Filter>) => {
    setMore(false);
    setF((x) => ({ ...x, ...p }));
  };
  const p = CANDIDATES.provenance;

  return (
    <div className="space-y-6">
      <PageHeader slug="/analytics/candidate-list" title="Candidates, JB Marks" />
      <BasisNote>
        The Electoral Commission&rsquo;s certified list of candidates for North West, as
        supplemented on 23 October 2026 (fetched {p.fetchedOn}). Published to this application on
        the owner&rsquo;s instruction ({p.confirmedBy}, {p.confirmedOn}); the owner is verifying it
        against the Commission&rsquo;s own. Names are as the Commission prints them. A person can be
        on a ward ballot and a party list at once.
      </BasisNote>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Candidates"
          value={CANDIDATES.counts.total}
          sub="ward and party list"
          emphasis
        />
        <StatTile label="Ward candidates" value={CANDIDATES.counts.ward} sub="34 wards" />
        <StatTile
          label="Party-list candidates"
          value={CANDIDATES.counts.pr}
          sub="proportional lists"
        />
        <StatTile label="Parties" value={parties.length} sub="contesting" />
      </div>

      <Card>
        <SectionLabel as="h2">Parties contesting</SectionLabel>
        <Table caption="Parties on the 2026 candidate list for JB Marks, with how many ward and party-list candidates each fielded.">
          <thead>
            <tr>
              <Th>Party</Th>
              <Th numeric>Ward candidates</Th>
              <Th numeric>Party list</Th>
            </tr>
          </thead>
          <tbody>
            {parties.map((s) => (
              <tr key={s.party}>
                <Td>{titleCase(s.party)}</Td>
                <Td numeric>{s.ward}</Td>
                <Td numeric>{s.pr}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Card>
        <SectionLabel as="h2">Find a candidate</SectionLabel>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mt-3">
          <Field label="Ballot">
            {(props) => (
              <select
                {...props}
                value={f.kind}
                onChange={(e) => set({ kind: e.target.value as Filter['kind'] })}
              >
                <option value="ALL">Ward and party list</option>
                <option value="WARD">Ward only</option>
                <option value="PR">Party list only</option>
              </select>
            )}
          </Field>
          <Field label="Ward">
            {(props) => (
              <select
                {...props}
                value={f.ward ?? ''}
                onChange={(e) => set({ ward: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">All wards</option>
                {Array.from({ length: 34 }, (_, i) => i + 1).map((w) => (
                  <option key={w} value={w}>
                    Ward {w}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Party">
            {(props) => (
              <select {...props} value={f.party} onChange={(e) => set({ party: e.target.value })}>
                <option value="">All parties</option>
                {parties.map((s) => (
                  <option key={s.party} value={s.party}>
                    {titleCase(s.party)}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Name contains">
            {(props) => (
              <input
                {...props}
                type="search"
                value={f.query}
                onChange={(e) => set({ query: e.target.value })}
              />
            )}
          </Field>
        </div>
        <p className="text-body-md font-body mt-3" role="status">
          {hits.length} candidate{hits.length === 1 ? '' : 's'}
          {hits.length > shown.length ? `, showing ${shown.length}` : ''}.
        </p>
        <Table caption="Candidates matching the filters.">
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Party</Th>
              <Th>Ballot</Th>
              <Th numeric>Ward or list place</Th>
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => (
              <tr key={`${c.kind}-${c.party}-${c.ward ?? c.rank}-${c.surname}-${c.fullName}`}>
                <Td>
                  {titleCase(displayName(c))}
                  {isDual(c) && <span className="text-slate"> · also on the other ballot</span>}
                </Td>
                <Td>{titleCase(c.party)}</Td>
                <Td>{c.kind === 'WARD' ? 'Ward' : 'Party list'}</Td>
                <Td numeric>{c.kind === 'WARD' ? `Ward ${c.ward}` : `No. ${c.rank}`}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
        {hits.length > SHOW && !more && (
          <button type="button" className="mt-3 min-h-11 underline" onClick={() => setMore(true)}>
            Show all {hits.length}
          </button>
        )}
      </Card>
    </div>
  );
}
