/**
 * Election Campaign OS — LGE 2026 results, North West (/analytics/lge-2026-results)
 *
 * The Electoral Commission's published results for the 18 local municipalities and, for each district, the sum of its
 * members' "DC 40%" ballot. Read lge2026Results.ts first: every figure is derived from the Commission's files, the seat
 * table is Schedule 1 reconciled with the Commission's own seat calculation, and nothing here is a forecast.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BasisNote, Card, Field, PageHeader, Pill, SectionLabel, StatTile, Table, Td, Th } from '@/components/ui';
import { delimitationFor } from '@/modules/reference/municipalRegister';
import {
  LGE2026,
  LGE2026_MANIFEST,
  MUNICIPALITY_CODES,
  district,
  municipality,
  partyLabel,
  seatAllocation2026,
  seatInput,
  turnout,
  wardOutcomes,
} from './lge2026Results';

const n = (v: number) => v.toLocaleString('en-ZA');
const p1 = (v: number) => v.toFixed(1);

export function Lge2026ResultsPage() {
  const [code, setCode] = useState('NW405');
  const [ward, setWard] = useState<number | null>(null);
  const m = municipality(code);
  const alloc = useMemo(() => seatAllocation2026(code), [code]);
  const input = useMemo(() => seatInput(code), [code]);
  const outcomes = useMemo(() => wardOutcomes(code).sort((a, b) => a.margin - b.margin), [code]);
  const dc = district(`DC${code.slice(2, 4)}`);
  const pr = turnout(code, 'pr');
  const wardT = turnout(code, 'ward');
  const dcT = turnout(code, 'dc40');
  const prVotes = new Map(m.parties.pr);
  const wardVotes = new Map(m.parties.ward);
  const gaz = delimitationFor(code)!;
  const file = LGE2026_MANIFEST.files.find((f) => f.code === code)!;
  const vdRows = ward === null ? [] : (m.votingDistrictDetail ?? []).filter((v) => Number(v.wardId.slice(-3)) === ward);

  return (
    <div className="space-y-6">
      <PageHeader slug="/analytics/lge-2026-results" title="LGE 2026 results, North West" />
      <BasisNote>
        The Electoral Commission&rsquo;s published results for 4 November 2026 (event {LGE2026.source.eventId}), read from its
        downloadable party-results files. File for {code} generated up to {file.generatedTo.replace('T', ' ')}. Seats are
        Schedule 1 applied to those results and agree with the Commission&rsquo;s own Seat Calculation Detail report for every
        one of the 18 municipalities. See <Link to="/analytics/scenario-runner">the scenario runner</Link> to start a
        scenario from this result.
      </BasisNote>

      <Card>
        <Field label="Municipality">
          {(props) => (
            <select
              {...props}
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setWard(null);
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
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Council seats" value={n(alloc.councilSizeFinal)} sub={`${gaz.wardSeats} ward + ${gaz.prSeats} list`} emphasis />
        <StatTile label="Turnout, PR ballot" value={`${p1(pr.pct)}%`} sub={`${n(pr.cast)} cast of ${n(pr.registered)}`} />
        <StatTile label="Turnout, ward ballot" value={`${p1(wardT.pct)}%`} sub={`${n(wardT.cast)} cast`} />
        <StatTile label="Turnout, district 40% ballot" value={`${p1(dcT.pct)}%`} sub={`${n(dcT.cast)} cast`} />
      </div>
      <p className="text-body-md font-body text-slate">
        Turnout is cast votes (valid plus spoilt) divided by the voters the Commission lists as registered on that ballot, taken
        separately for each ballot; ballots are never added together. The Commission&rsquo;s registered figure for {m.name} is{' '}
        {n(m.registered)} (the roll the election was held on); the gazetted baseline of {n(gaz.registeredVoters)} (IEC Circular 1
        of 2025) is older, and dividing by it would overstate turnout.
      </p>

      <p className="text-body-md font-body text-slate">
        Candidates and results together, by party: <Link to="/analytics/lge-2026-party">party candidates and result</Link>.
      </p>

      <Card>
        <SectionLabel as="h2">Council seats</SectionLabel>
        <Table caption={`Seats after Schedule 1: quota ${n(alloc.quota)}${alloc.newQuota ? `, recalculated to ${n(alloc.newQuota)} under Item 16 because a party won more ward seats than its entitlement` : ''}.`}>
          <thead>
            <tr>
              <Th>Party</Th>
              <Th numeric>PR votes</Th>
              <Th numeric>Ward votes</Th>
              <Th numeric>Ward seats</Th>
              <Th numeric>List seats</Th>
              <Th numeric>Seats</Th>
            </tr>
          </thead>
          <tbody>
            {[...alloc.parties]
              .filter((p) => p.totalSeats > 0 || p.votes >= 1000)
              .sort((a, b) => b.totalSeats - a.totalSeats || b.votes - a.votes)
              .map((p) => {
                const full = [...prVotes.keys()].find((k) => partyLabel(k) === p.name) ?? p.name;
                return (
                  <tr key={p.id}>
                    <Td>{p.name}</Td>
                    <Td numeric>{n(prVotes.get(full) ?? 0)}</Td>
                    <Td numeric>{n(wardVotes.get(full) ?? 0)}</Td>
                    <Td numeric>{p.wardSeatsWon}</Td>
                    <Td numeric>{p.prSeats}</Td>
                    <Td numeric>{p.totalSeats}</Td>
                  </tr>
                );
              })}
            {input.independentWardSeats > 0 && (
              <tr>
                <Td>Independent ward councillors</Td>
                <Td numeric>none</Td>
                <Td numeric>{n(wardVotes.get('INDEPENDENT') ?? 0)}</Td>
                <Td numeric>{input.independentWardSeats}</Td>
                <Td numeric>0</Td>
                <Td numeric>{input.independentWardSeats}</Td>
              </tr>
            )}
          </tbody>
        </Table>
        <p className="text-body-md font-body text-slate mt-2">
          A party&rsquo;s votes for the quota are its PR votes plus its ward votes. Parties with fewer than 1,000 votes and no seat
          are not listed.
          {input.independentLeadWards.length > 0 &&
            ` The Commission publishes all independents on a ward ballot as one row; where that row leads (ward ${input.independentLeadWards.join(', ')}) it is counted as one independent win.`}
        </p>
      </Card>

      <Card>
        <SectionLabel as="h2">Wards, closest first</SectionLabel>
        <Table caption="Ward ballot result by ward: winner, runner-up and the gap in points of the ward's valid vote.">
          <thead>
            <tr>
              <Th>Ward</Th>
              <Th>Won by</Th>
              <Th numeric>Votes</Th>
              <Th>Runner-up</Th>
              <Th numeric>Votes</Th>
              <Th numeric>Margin (pts)</Th>
              <Th numeric>Registered</Th>
              {m.votingDistrictDetail && (
                <Th>
                  <span className="sr-only">Open</span>
                </Th>
              )}
            </tr>
          </thead>
          <tbody>
            {outcomes.map((w) => (
              <tr key={w.wardId}>
                <Td numeric>{w.wardNumber}</Td>
                <Td>
                  {partyLabel(w.winner)}
                  {w.independentLeads && <Pill className="ml-2">independents merged</Pill>}
                </Td>
                <Td numeric>{n(w.winnerVotes)}</Td>
                <Td>{w.runnerUp ? partyLabel(w.runnerUp) : 'none'}</Td>
                <Td numeric>{n(w.runnerUpVotes)}</Td>
                <Td numeric>{p1(w.margin)}</Td>
                <Td numeric>{n(w.registered)}</Td>
                {m.votingDistrictDetail && (
                  <Td>
                    <button type="button" className="min-h-11 underline" aria-label={`Voting districts of ward ${w.wardNumber}`} onClick={() => setWard(w.wardNumber)}>
                      Voting districts
                    </button>
                  </Td>
                )}
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {ward !== null && (
        <Card>
          <SectionLabel as="h2">Ward {ward}: voting districts</SectionLabel>
          <Table caption={`Voting districts in ward ${ward}, with the leading party on the ward and PR ballots.`}>
            <thead>
              <tr>
                <Th>Station</Th>
                <Th>VD</Th>
                <Th numeric>Registered</Th>
                <Th>Ward ballot leader</Th>
                <Th>PR ballot leader</Th>
              </tr>
            </thead>
            <tbody>
              {vdRows.map((v) => (
                <tr key={v.vd}>
                  <Td>{v.station}</Td>
                  <Td numeric>{v.vd}</Td>
                  <Td numeric>{n(v.registered)}</Td>
                  <Td>{v.ballots.ward?.parties[0] ? `${partyLabel(v.ballots.ward.parties[0][0])} (${n(v.ballots.ward.parties[0][1])})` : 'none'}</Td>
                  <Td>{v.ballots.pr?.parties[0] ? `${partyLabel(v.ballots.pr.parties[0][0])} (${n(v.ballots.pr.parties[0][1])})` : 'none'}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      <Card>
        <SectionLabel as="h2">District council: {`DC${code.slice(2, 4)}`}</SectionLabel>
        <p className="text-body-md font-body mt-1">
          The district council&rsquo;s directly elected seats are voted on through the 40% ballot in each local municipality.
          Across its {dc.members.length} local municipalities ({dc.members.join(', ')}), {n(dc.dc40.valid)} valid votes and{' '}
          {n(dc.dc40.spoilt)} spoilt were cast. Leading parties:{' '}
          {dc.parties
            .slice(0, 4)
            .map(([name, v]) => `${partyLabel(name)} ${n(v)} (${p1((v / dc.dc40.valid) * 100)}%)`)
            .join('; ')}
          .
        </p>
        <p className="text-body-md font-body text-slate mt-2">
          District seats are allocated under Schedule 2 of the Municipal Structures Act, which this build does not implement, so
          no seat count is shown for the district. Only votes are.
        </p>
      </Card>
    </div>
  );
}
