/**
 * Election Campaign OS — a party's candidates and result in one municipality (/analytics/lge-2026-party)
 *
 * The Commission's published candidate list laid against the Commission's results. Read partyProfile.ts for what is
 * joined and what is deliberately not claimed. Facts come first, then the reading of them.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BasisNote, Card, Field, PageHeader, Pill, SectionLabel, StatTile, Table, Td, Th } from '@/components/ui';
import { MUNICIPALITY_CODES, municipality, partyLabel } from './lge2026Results';
import { ListDepthChart, PositionChart, WardShareChart } from './PartyCharts';
import { LIST_PROVENANCE, partiesWithCandidates, partyProfile, profileFacts, profileInsights, reconcileAppCopies } from './partyProfile';

const n = (v: number) => v.toLocaleString('en-ZA');
const p1 = (v: number) => v.toFixed(1);
const ord = (k: number) => `${k}${['th', 'st', 'nd', 'rd'][k % 10 > 3 || Math.floor(k / 10) === 1 ? 0 : k % 10]}`;

export function PartyProfilePage() {
  const [code, setCode] = useState('NW405');
  const [party, setParty] = useState('ACTIONSA');
  const parties = useMemo(() => partiesWithCandidates(code).filter((p) => municipality(code).onPrList.includes(p)), [code]);
  const chosen = parties.includes(party) ? party : parties[0];
  const P = useMemo(() => partyProfile(code, chosen), [code, chosen]);
  const facts = useMemo(() => profileFacts(P), [P]);
  const insights = useMemo(() => profileInsights(P), [P]);
  const recon = code === 'NW405' ? reconcileAppCopies(chosen) : null;

  return (
    <div className="space-y-6">
      <PageHeader slug="/analytics/lge-2026-party" title="Party Candidates and Result" />

      <Card>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Municipality">
            {(props) => (
              <select {...props} value={code} onChange={(e) => setCode(e.target.value)}>
                {MUNICIPALITY_CODES.map((c) => (
                  <option key={c} value={c}>
                    {c} {municipality(c).name}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Party">
            {(props) => (
              <select {...props} value={chosen} onChange={(e) => setParty(e.target.value)}>
                {parties.map((p) => (
                  <option key={p} value={p}>
                    {partyLabel(p)}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
      </Card>

      <Card tone="accent">
        <SectionLabel as="h2">How This List Was Obtained and Checked</SectionLabel>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-body-md font-body text-ink">
          <li>The Commission publishes certified candidate lists as PDFs by province. This is the North West list of 23 Oct 2026, &ldquo;as supplemented&rdquo; after the Constitutional Court order in CCT 282/26 ({n(LIST_PROVENANCE.bytes)} bytes).</li>
          <li>It was fetched from the Commission&rsquo;s site on {LIST_PROVENANCE.fetchedOn} and again on 9 Nov 2026; both copies have the same SHA-256, <span className="font-mono text-data-mono">{LIST_PROVENANCE.sha256.slice(0, 16)}…</span></li>
          <li>The PDF groups rows by municipality: Dr Kenneth Kaunda (DC40) is the district; JB Marks is NW405 within it. Each row is one candidate, with a ward id or a list rank.</li>
          <li>Rows were re-read from the PDF text independently of the app&rsquo;s stored copy and compared row for row{recon ? `: ${recon.iec} in the ingest, ${recon.reference} in the reference file, ${recon.onlyIec.length + recon.onlyReference.length} differences` : ' (the reference-file comparison exists for NW405 only)'}.</li>
          <li>Candidates were then joined to the ward and list results for the same municipality.</li>
        </ol>
        <BasisNote>
          Names and places are as the Commission printed them. Identity numbers are never read. Repeat the check with{' '}
          <span className="font-mono text-data-mono">python3 -I tools/candidates/verify-party-list.py</span>.
        </BasisNote>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Candidate Entries" value={n(P.candidates)} sub={`${P.wardCandidates.length} ward · ${P.prList.length} list · ${P.distinctPeople} people`} emphasis />
        <StatTile label="Seats" value={n(P.seats.total)} sub={`${P.seats.ward} ward · ${P.seats.pr} list`} />
        <StatTile label="PR Ballot" value={`${p1(P.ballots.pr.sharePct)}%`} sub={`${n(P.ballots.pr.votes)} votes`} />
        <StatTile label="Ward Ballot" value={`${p1(P.ballots.ward.sharePct)}%`} sub={`${n(P.ballots.ward.votes)} votes`} />
      </div>

      <Card>
        <SectionLabel as="h2">Facts</SectionLabel>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-body-md font-body text-ink">
          {facts.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </Card>

      <Card>
        <SectionLabel as="h2">PR councillor candidate list, {P.municipality}</SectionLabel>
        <Table caption={`${P.label} PR list as published by the Commission for ${P.code}. Seats won: ${P.seats.pr}.`}>
          <thead>
            <tr>
              <Th numeric>Rank</Th>
              <Th>Candidate</Th>
              <Th>Also printed as</Th>
            </tr>
          </thead>
          <tbody>
            {P.prList.map((e) => (
              <tr key={e.rank}>
                <Td numeric mono>{e.rank}</Td>
                <Td>{e.name}</Td>
                <Td>{e.alsoWard.length ? e.alsoWard.map((w) => `Ward ${w}`).join(', ') : 'none'}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
        {P.listDepth.unfilled > 0 && (
          <p className="mt-3 text-body-md font-body text-maroon">
            {P.label} won {P.seats.pr} list seats. The published list has {P.listDepth.eligible} eligible name{P.listDepth.eligible === 1 ? '' : 's'}, so{' '}
            {P.listDepth.unfilled} seat{P.listDepth.unfilled === 1 ? '' : 's'} cannot be named from it. No names have been invented.
          </p>
        )}
        <BasisNote>
          District council ({P.districtList.code}, a separate ballot):{' '}
          {P.districtList.entries.map((e) => `${e.rank}. ${e.name}`).join('; ') || 'no list'}.
        </BasisNote>
      </Card>

      <Card>
        <SectionLabel as="h2">Ward Candidates and Ward Results</SectionLabel>
        <Table caption={`${P.label} ward candidates with the votes they polled and the ward leader.`}>
          <thead>
            <tr>
              <Th numeric>Ward</Th>
              <Th>Candidate</Th>
              <Th numeric>Votes</Th>
              <Th numeric>Share</Th>
              <Th>Finished</Th>
              <Th numeric>Behind leader</Th>
              <Th>Ward leader</Th>
            </tr>
          </thead>
          <tbody>
            {P.wardCandidates.map((c) => (
              <tr key={c.ward}>
                <Td numeric mono>{c.ward}</Td>
                <Td>
                  {c.name}
                  {c.alsoOn.length > 0 && <span className="text-slate"> (also {c.alsoOn.join(', ')})</span>}
                </Td>
                <Td numeric>{n(c.votes)}</Td>
                <Td numeric>{p1(c.share)}%</Td>
                <Td>{c.position === 1 ? <Pill className="bg-green/10 text-green">Led</Pill> : ord(c.position)}</Td>
                <Td numeric>{c.position === 1 ? '—' : n(c.gapToWinner)}</Td>
                <Td>{partyLabel(c.winner)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Card>
        <SectionLabel as="h2">Share of the Ward Vote, by Ward</SectionLabel>
        <WardShareChart wards={P.wardCandidates} title={`${P.label}: share of the valid ward vote in each ward, coloured by finishing position`} />
      </Card>
      <Card>
        <SectionLabel as="h2">Wards by Finishing Position</SectionLabel>
        <div className="max-w-md">
          <PositionChart positions={P.wardPositions} total={P.wardCandidates.length} />
        </div>
      </Card>
      <Card>
        <SectionLabel as="h2">List Seats Against Names on the List</SectionLabel>
        <ListDepthChart rows={P.peers} highlight={P.party} />
      </Card>

      <Card tone="accent">
        <SectionLabel as="h2">Analytical Insights</SectionLabel>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-body-md font-body text-ink">
          {insights.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        <BasisNote>
          Description, not prediction. Seat figures are Schedule 1 over the Commission&rsquo;s ballots, reconciled with its own seat
          calculation. See also <Link to="/analytics/lge-2026-results">the full results</Link>.
        </BasisNote>
      </Card>
    </div>
  );
}
