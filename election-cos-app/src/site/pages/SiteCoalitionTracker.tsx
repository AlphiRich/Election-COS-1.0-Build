/**
 * Election Campaign OS — public site, Coalition Tracker (`/coalitions`)
 *
 * Every metro and local council elected on 4 November 2026: who holds its seats, whether any party has a majority, and
 * how few parties it takes to govern. Read from the certified seat table (seats-2026.json); nothing here is projected.
 * Each row opens the council's own page.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SiteCard, SiteSection } from '../SiteChrome';
import { PageIntro, SourceNote } from './pageParts';
import { SeatBar, StatTile, StatusPill } from './resultsParts';
import { kindOf, nf, provinceName } from '../tools/resultsFormat';
import { councilPath, MY_WARD_PATH } from '../resultsPaths';
import { fewestPartiesToGovern, seatsShort } from '../tools/tracker';
import { AdSlot } from '../ads/AdSlot';
import {
  COUNCIL_CODES,
  NATIONAL_SEATS,
  PROVINCE_CODES,
  council,
  loadCouncillors,
  nationalSummary,
  type CouncilSeats,
  type ProvinceCode,
} from '@/modules/lge2026/nationalResults';

type Filter = 'all' | 'hung' | 'majority';

export function SiteCoalitionTracker({ hasConsent }: { hasConsent: boolean }) {
  const summary = useMemo(nationalSummary, []);
  const [province, setProvince] = useState<ProvinceCode | 'all'>('all');
  const [filter, setFilter] = useState<Filter>('hung');
  const [q, setQ] = useState('');
  const [vacant, setVacant] = useState<{ seats: number; councils: number } | null>(null);

  useEffect(() => {
    let live = true;
    void loadCouncillors().then((f) => {
      if (!live) return;
      const all = Object.values(f.councils);
      setVacant({ seats: all.reduce((s, c) => s + c.vacant.reduce((a, v) => a + v.vacant, 0), 0), councils: all.filter((c) => c.vacant.length).length });
    });
    return () => {
      live = false;
    };
  }, []);

  const metros = COUNCIL_CODES.map(council).filter((c) => c.category === 'A');
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return COUNCIL_CODES.map(council)
      .filter((c) => province === 'all' || c.province === province)
      .filter((c) => filter === 'all' || (filter === 'hung' ? c.hung : !c.hung))
      .filter((c) => !needle || c.name.toLowerCase().includes(needle) || c.code.toLowerCase().includes(needle))
      .sort((a, b) => a.province.localeCompare(b.province) || a.name.localeCompare(b.name));
  }, [province, filter, q]);

  return (
    <>
      <PageIntro
        eyebrow="Local government elections 2026 · certified results"
        title="Who will run your council?"
        lead={`${summary.hung} of the ${summary.councils} metro and local councils elected on 4 November have no party with a majority of seats. Seven of the eight metros are among them. Their mayors and executives will be chosen by coalitions.`}
      >
        <p className="m-0 flex flex-wrap gap-3">
          <a href="#councils" className="site-btn-primary">Find a council</a>
          <Link to={MY_WARD_PATH} className="site-btn-outline-ink">Find your ward councillor</Link>
        </p>
      </PageIntro>

      <SiteSection labelledBy="summary-h" className="pb-8">
        <h2 id="summary-h" className="sr-only">The country at a glance</h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-4">
          <StatTile value={summary.hung} label="Councils with no majority">of {summary.councils} metros and local councils</StatTile>
          <StatTile value={summary.majority} label="Councils with a majority">one party holds more than half the seats</StatTile>
          <StatTile value={`${metros.filter((m) => m.hung).length} of ${metros.length}`} label="Metros with no majority" />
          <StatTile value={vacant ? nf.format(vacant.seats) : '…'} label="List seats a party cannot fill yet">
            {vacant ? `in ${vacant.councils} councils: the party won more seats than it has candidates` : 'counting'}
          </StatTile>
        </div>
      </SiteSection>

      <SiteSection labelledBy="metros-h" className="pb-8">
        <h2 id="metros-h" className="m-0 mb-4 font-site-display text-site-h4">The eight metros</h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] gap-4">
          {metros.map((m) => (
            <MetroCard key={m.code} c={m} />
          ))}
        </div>
      </SiteSection>

      <SiteSection id="councils" labelledBy="councils-h" className="pb-8">
        <div className="flex flex-col gap-4">
          <h2 id="councils-h" className="m-0 font-site-display text-site-h4">Every council</h2>
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1 text-site-caption text-slate" htmlFor="tr-province">
              Province
              <select id="tr-province" className="site-field min-h-[44px]" value={province} onChange={(e) => setProvince(e.target.value as ProvinceCode | 'all')}>
                <option value="all">All provinces</option>
                {PROVINCE_CODES.map((p) => (
                  <option key={p} value={p}>
                    {provinceName(p)} ({summary.byProvince[p].hung} of {summary.byProvince[p].councils} with no majority)
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="m-0 flex flex-wrap gap-2 border-0 p-0">
              <legend className="mb-1 text-site-caption text-slate">Show</legend>
              {(
                [
                  ['hung', 'No majority'],
                  ['majority', 'Majority'],
                  ['all', 'All'],
                ] as const
              ).map(([v, l]) => (
                <label key={v} className={`flex min-h-[44px] cursor-pointer items-center rounded-full border px-4 text-site-sm ${filter === v ? 'border-ink bg-ink text-paper' : 'border-line bg-white'}`}>
                  <input type="radio" name="tr-filter" value={v} checked={filter === v} onChange={() => setFilter(v)} className="sr-only" />
                  {l}
                </label>
              ))}
            </fieldset>
            <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-site-caption text-slate" htmlFor="tr-q">
              Search by name or code
              <input id="tr-q" className="site-field min-h-[44px]" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Rustenburg or NW373" />
            </label>
          </div>
          <p className="m-0 text-site-caption text-slate" role="status" aria-live="polite">
            {rows.length} {rows.length === 1 ? 'council' : 'councils'}
          </p>
          <div className="overflow-x-auto rounded-[10px] border border-line bg-white">
            <table className="w-full min-w-[720px] border-collapse text-left text-site-sm">
              <thead>
                <tr className="border-b border-line bg-paper text-site-caption text-slate">
                  <th scope="col" className="px-4 py-3 font-semibold">Council</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Seats</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Largest party</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Short of a majority</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Fewest parties to govern</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <CouncilRow key={c.code} c={c} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </SiteSection>

      <SiteSection className="pb-8">
        <AdSlot pathname="/coalitions" hasConsent={hasConsent} />
      </SiteSection>

      <SourceNote>
        Source: the Electoral Commission’s certified results for the 2026 local government elections (event EEID1887), one
        file per council, retrieved {NATIONAL_SEATS.retrieved}. Seats are calculated under Schedule 1 of the Municipal
        Structures Act and checked against the Commission’s own Seat Calculation Detail report for each council; a council
        where they differ, or where the Commission has not published one, says so on its page. “Fewest parties to govern”
        counts seats only: it does not say which parties will agree. District councils are elected differently and are not
        in this table.
      </SourceNote>
    </>
  );
}

function MetroCard({ c }: { c: CouncilSeats }) {
  const top = c.holders.slice(0, 3);
  return (
    <SiteCard className="flex min-w-0 flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="m-0 font-site-display text-site-h5">
          <Link to={councilPath(c.code)} className="text-ink">{c.name}</Link>
        </h3>
        <StatusPill hung={c.hung} />
      </div>
      <SeatBar holders={c.holders} councillors={c.councillors} label={c.name} />
      <ul className="m-0 flex list-none flex-col gap-1 p-0 text-site-sm">
        {top.map((h) => (
          <li key={h.id} className="flex justify-between gap-3">
            <span className="min-w-0 truncate">{h.name}</span>
            <span className="font-mono">{h.seats}</span>
          </li>
        ))}
      </ul>
      <p className="m-0 text-site-caption text-slate">
        {c.hung ? `Largest party ${seatsShort(c.holders, c.councillors)} short of ${c.majority}.` : `${c.holders[0].name} holds a majority.`}
      </p>
    </SiteCard>
  );
}

function CouncilRow({ c }: { c: CouncilSeats }) {
  const top = c.holders[0];
  const short = seatsShort(c.holders, c.councillors);
  const fewest = fewestPartiesToGovern(c.holders, c.councillors);
  return (
    <tr className="border-b border-line last:border-b-0">
      <th scope="row" className="px-4 py-3 font-normal">
        <Link to={councilPath(c.code)} className="font-semibold text-ink">{c.name}</Link>
        <span className="block text-site-caption text-slate">
          {kindOf(c)} · {provinceName(c.province)} · {c.code}
        </span>
      </th>
      <td className="px-4 py-3 font-mono">{c.councillors}</td>
      <td className="px-4 py-3">
        {top.name} <span className="font-mono text-slate">{top.seats}</span>
      </td>
      <td className="px-4 py-3 font-mono">{short === 0 ? '–' : short}</td>
      <td className="px-4 py-3 font-mono">{fewest ?? '5 or more'}</td>
      <td className="px-4 py-3">
        <StatusPill hung={c.hung} />
        {c.iec !== 'reconciled' && <span className="mt-1 block text-site-micro text-roadmap">See note on the council’s page</span>}
      </td>
    </tr>
  );
}
