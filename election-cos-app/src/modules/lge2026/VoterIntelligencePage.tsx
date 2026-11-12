/**
 * Election Campaign OS — Voter Intelligence, any council (/analytics/voter-intelligence)
 *
 * The supplied JB Marks instrument, computed from the certified results for any of the 213 councils. Read
 * voterIntelligence.ts first: it says what is computed and what is deliberately absent (demographics, "psychographic"
 * segments, special votes, trends before 2021), and the page repeats that to the reader.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BasisNote, Card, Field, PageHeader, Pill, SectionLabel, StatTile, Table, Td, Th } from '@/components/ui';
import { COUNCIL_CODES, NATIONAL_SEATS, PROVINCES } from './nationalResults';
import { partyLabel } from './councilResults';
import { voterIntelligence, partyName, type VoterIntelligence, type WardTier } from './voterIntelligence';

const n = (v: number) => v.toLocaleString('en-ZA');
const p1 = (v: number) => v.toFixed(1);
const TIER_NOTE: Record<WardTier, string> = { Safe: 'leader above 60%', Comfortable: '50 to 60%', Marginal: '40 to 50%', Contested: 'leader below 40%' };

export function VoterIntelligencePage() {
  const [code, setCode] = useState('NW405');
  const [vi, setVi] = useState<VoterIntelligence | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setVi(null);
    setError(null);
    voterIntelligence(code).then((v) => live && setVi(v), (e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [code]);
  const options = useMemo(
    () => COUNCIL_CODES.map((c) => NATIONAL_SEATS.councils[c]).sort((a, b) => a.province.localeCompare(b.province) || a.name.localeCompare(b.name)),
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader slug="/analytics/voter-intelligence" title="Voter Intelligence" />
      <Card>
        <Field label="Council">
          {(props) => (
            <select {...props} value={code} onChange={(e) => setCode(e.target.value)}>
              {options.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name} ({c.code}), {PROVINCES[c.province]}
                </option>
              ))}
            </select>
          )}
        </Field>
        <BasisNote>Any of the 213 metro and local councils, computed from the Electoral Commission&rsquo;s certified LGE 2026 results.</BasisNote>
      </Card>

      {error && <p role="alert" className="text-body-md font-body text-maroon">{error}</p>}
      {!vi && !error && <p role="status" className="text-body-md font-body text-slate">Reading the results…</p>}

      {vi && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Council seats" value={n(vi.seats.councillors)} sub={`${vi.seats.wards} ward · ${vi.seats.councillors - vi.seats.wards} list`} emphasis />
            <StatTile label="Majority needs" value={n(vi.majority)} sub={vi.seats.hung ? 'no party holds it' : `${vi.topHolder?.name} holds it`} />
            <StatTile label="Registered voters" value={n(vi.seats.registered)} sub={`turnout ${p1(vi.seats.turnoutPr)}% on the PR ballot`} />
            <StatTile label="Largest party" value={`${vi.topHolder?.seats ?? 0} seats`} sub={vi.shortOfMajority ? `${vi.shortOfMajority} short of a majority` : (vi.topHolder?.name ?? '')} />
          </div>

          <Card tone={vi.seats.hung ? 'accent' : 'default'}>
            <SectionLabel as="h2">{vi.seats.hung ? 'Hung council: a coalition is required' : 'One party holds a majority'}</SectionLabel>
            <p className="mt-2 text-body-md font-body text-ink">
              {vi.name} has {vi.seats.councillors} seats; {vi.majority} are needed to govern alone.{' '}
              {vi.seats.hung ? `The largest party, ${vi.topHolder?.name}, holds ${vi.topHolder?.seats}.` : `${vi.topHolder?.name} holds ${vi.topHolder?.seats}.`}
            </p>
            {vi.iecStatus !== 'reconciled' && (
              <p role="status" className="mt-2 text-body-md font-body text-maroon">
                The Commission&rsquo;s own seat report for this council is &ldquo;{vi.iecStatus}&rdquo;, so these seats are not fully confirmed by it.
              </p>
            )}
          </Card>

          <Card>
            <SectionLabel as="h2">Who holds the seats</SectionLabel>
            <Table caption={`Seats in ${vi.name} after Schedule 1.`}>
              <thead><tr><Th>Party</Th><Th numeric>Seats</Th><Th numeric>Of which ward</Th></tr></thead>
              <tbody>
                {[...vi.seats.holders].sort((a, b) => b.seats - a.seats).map((h) => (
                  <tr key={h.id}><Td>{h.name}</Td><Td numeric>{h.seats}</Td><Td numeric>{h.wardSeats}</Td></tr>
                ))}
              </tbody>
            </Table>
          </Card>

          {vi.coalitions.length > 0 && (
            <Card>
              <SectionLabel as="h2">Coalition arithmetic</SectionLabel>
              <Table caption="Smallest combinations of parties that reach a majority, where no member could leave and still leave one.">
                <thead><tr><Th>Parties</Th><Th numeric>Seats</Th><Th numeric>Over the line</Th></tr></thead>
                <tbody>
                  {vi.coalitions.map((c) => (
                    <tr key={c.parties.join('+')}><Td>{c.parties.join(' + ')}</Td><Td numeric>{c.seats}</Td><Td numeric>+{c.surplus}</Td></tr>
                  ))}
                </tbody>
              </Table>
              <BasisNote>What-if arithmetic on seats, not a forecast, and not a statement of what any party will do. Independents are left out because they do not act as a bloc.</BasisNote>
            </Card>
          )}

          <Card>
            <SectionLabel as="h2">The ward map in numbers</SectionLabel>
            <div className="mt-2 flex flex-wrap gap-2">
              {(Object.keys(vi.tierCounts) as WardTier[]).map((t) => (
                <Pill key={t} className="bg-ink/5 text-ink">{t}: {vi.tierCounts[t]} <span className="normal-case">({TIER_NOTE[t]})</span></Pill>
              ))}
            </div>
            <p className="mt-2 text-body-md font-body text-ink">
              {vi.wardsLedBy.slice(0, 4).map((w) => `${partyName(w.party)} led ${w.wards}`).join('; ')}.{' '}
              {vi.competitive.wards.length > 0
                ? `${vi.competitive.wards.length} ward${vi.competitive.wards.length === 1 ? ' is' : 's are'} within 10 points (${vi.competitive.wards.join(', ')}), holding ${p1(vi.competitive.electorateShare)}% of the registered voters.`
                : 'No ward was decided by under 10 points.'}
            </p>
            <Table caption={`Ward leaders in ${vi.name}, by ward number.`}>
              <thead><tr><Th numeric>Ward</Th><Th>Leader</Th><Th numeric>Share</Th><Th numeric>Margin</Th><Th>Tier</Th><Th>Runner-up</Th></tr></thead>
              <tbody>
                {vi.wards.map((w) => (
                  <tr key={w.ward}>
                    <Td numeric mono>{w.ward}</Td><Td>{partyName(w.leader)}</Td><Td numeric>{p1(w.leaderShare)}%</Td>
                    <Td numeric>{p1(w.margin)} pts</Td><Td>{w.tier}</Td><Td>{w.runnerUp ? partyLabel(w.runnerUp) : '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>

          <Card>
            <SectionLabel as="h2">What this instrument does not have</SectionLabel>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-body-md font-body text-ink">
              <li>Demographics (race, age, gender): not in this build. The earlier JB Marks sheet&rsquo;s figures had no stated source.</li>
              <li>&ldquo;Psychographic&rdquo; voter segments: they cannot be derived from results, and race-linked profiling of voters is a POPIA special-personal-information question. Left out, not guessed.</li>
              <li>Special-vote counts, and any trend before 2021: not ingested.</li>
            </ul>
            <BasisNote>
              Source: {vi.source}. For one party&rsquo;s candidates against this result see <Link to="/analytics/lge-2026-party">party candidates and result</Link>;
              for the full tables, <Link to="/analytics/lge-2026-results">LGE 2026 results</Link>.
            </BasisNote>
          </Card>
        </>
      )}
    </div>
  );
}
