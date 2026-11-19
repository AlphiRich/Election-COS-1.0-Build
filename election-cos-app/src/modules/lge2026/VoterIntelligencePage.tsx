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
import { fetchCouncil } from '@/dal/adapters/firestore/electionData';
import { voterIntelligence, partyName, type VoterIntelligence, type CouncilSource, type WardTier } from './voterIntelligence';
import { WardMap } from './WardMap';
import { HISTORY_YEARS, NW405_2016, seatHistoryNW405 } from '@/modules/analytics/seatHistory';

/** JB Marks only: the council at the last three elections, from the Commission's results for each. */
export function SeatHistoryCard() {
  const h = useMemo(() => seatHistoryNW405(), []);
  const change = (v: number) => (v > 0 ? `+${v}` : v === 0 ? '0' : `${v}`);
  return (
    <Card>
      <SectionLabel as="h2">Three councils: 2016, 2021, 2026</SectionLabel>
      <p className="mt-1 text-body-md font-body text-slate">
        {HISTORY_YEARS.map((y) => `${y}: largest party ${h.largest[y].seats} of ${h.totalSeats}`).join(' · ')}. A majority is{' '}
        {h.majority} seats.
      </p>
      <Table caption={`Seats on the JB Marks council (${h.totalSeats} seats, 34 wards) after each election, and the change from 2021 to 2026.`}>
        <thead>
          <tr>
            <Th>Party</Th>
            {HISTORY_YEARS.map((y) => (
              <Th key={y} numeric>{y}</Th>
            ))}
            <Th numeric>2021 to 2026</Th>
          </tr>
        </thead>
        <tbody>
          {h.rows.map((r) => (
            <tr key={r.id}>
              <Td>{r.name}</Td>
              {HISTORY_YEARS.map((y) => (
                <Td key={y} numeric>{r.seats[y]}</Td>
              ))}
              <Td numeric>{change(r.seats[2026] - r.seats[2021])}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <BasisNote>
        2016: the Commission&rsquo;s 2016 North West party results (SHA-256 {NW405_2016.sha256.slice(0, 12)}…), seats by Schedule 1;
        &ldquo;Independent Councillors&rdquo; is a registered party, not independent candidates. 2021: the published seat
        calculation. 2026: the certified result. Wards were redrawn between elections, so seats compare but ward numbers do not.
      </BasisNote>
    </Card>
  );
}

const n = (v: number) => v.toLocaleString('en-ZA');
const p1 = (v: number) => v.toFixed(1);
const TIER_NOTE: Record<WardTier, string> = { Safe: 'leader above 60%', Comfortable: '50 to 60%', Marginal: '40 to 50%', Contested: 'leader below 40%' };

/** The council from the election database when it answers; the bundled results otherwise. */
const databaseCouncil: CouncilSource = async (c) => {
  const d = await fetchCouncil(c);
  if (!d) return null;
  return {
    wards: d.wards.map((w) => ({ wardId: w.wardId, wardNumber: w.wardNumber, registered: w.registered, valid: w.valid, spoilt: w.spoilt, parties: w.parties.map((x) => [x.party, x.votes] as const) })),
    pr: d.pr.map((x) => [x.party, x.votes] as const),
  };
};

export function VoterIntelligencePage() {
  const [code, setCode] = useState('NW405');
  const [vi, setVi] = useState<VoterIntelligence | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setVi(null);
    setError(null);
    voterIntelligence(code, databaseCouncil).then((v) => live && setVi(v), (e: Error) => live && setError(e.message));
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

          {vi.code === 'NW405' && <SeatHistoryCard />}

          <Card>
            <SectionLabel as="h2">Proportional ballot</SectionLabel>
            <Table caption={`Votes on the proportional (party) ballot in ${vi.name}, with the seats each party holds.`}>
              <thead><tr><Th>Party</Th><Th numeric>Votes</Th><Th numeric>Share</Th><Th numeric>Seats held</Th></tr></thead>
              <tbody>
                {vi.prShares.slice(0, 12).map((r) => (
                  <tr key={r.party}><Td>{partyName(r.party)}</Td><Td numeric>{n(r.votes)}</Td><Td numeric>{p1(r.share)}%</Td><Td numeric>{r.seats}</Td></tr>
                ))}
              </tbody>
            </Table>
            <BasisNote>{vi.prShares.length > 12 ? `The ${vi.prShares.length - 12} smallest parties are left out of this table. ` : ''}Seats held include ward seats, so a party can hold seats beyond its share of this ballot.</BasisNote>
          </Card>

          <WardMap vi={vi} />

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
            <SectionLabel as="h2">Turnout by ward</SectionLabel>
            <div className="grid gap-4 sm:grid-cols-2">
              {([['Highest', vi.turnoutWards.highest], ['Lowest', vi.turnoutWards.lowest]] as const).map(([label, rows]) => (
                <Table key={label} caption={`${label} ward-ballot turnout, ${vi.name}.`}>
                  <thead><tr><Th numeric>Ward</Th><Th numeric>{label} turnout</Th></tr></thead>
                  <tbody>{rows.map((r) => <tr key={r.ward}><Td numeric mono>{r.ward}</Td><Td numeric>{p1(r.turnout)}%</Td></tr>)}</tbody>
                </Table>
              ))}
            </div>
            <BasisNote>Ballots cast (valid and spoilt) on the ward ballot, over the ward&rsquo;s registered voters. Turnout is measured on one ballot, never on the two added together.</BasisNote>
          </Card>

          <Card>
            <SectionLabel as="h2">What this instrument does not have</SectionLabel>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-body-md font-body text-ink">
              <li>Demographics (race, age, gender): not in this build. The earlier JB Marks sheet&rsquo;s figures had no stated source.</li>
              <li>&ldquo;Psychographic&rdquo; voter segments: they cannot be derived from results, and race-linked profiling of voters is a POPIA special-personal-information question. Left out, not guessed.</li>
              <li>
                Special-vote counts: not ingested. Results before 2021:{' '}
                {vi.code === 'NW405' ? 'the 2016 council only (above); no 2016 votes by ward.' : 'not ingested for this council.'}
              </li>
            </ul>
            <BasisNote>
              Source: {vi.source}. Ward figures read from the {vi.wardData === 'database' ? 'election database' : 'results bundled with the app'}. For one party&rsquo;s candidates against this result see <Link to="/analytics/lge-2026-party">party candidates and result</Link>;
              for the full tables, <Link to="/analytics/lge-2026-results">LGE 2026 results</Link>.
            </BasisNote>
          </Card>
        </>
      )}
    </div>
  );
}
