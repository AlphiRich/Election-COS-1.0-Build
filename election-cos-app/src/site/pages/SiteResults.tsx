/**
 * Election Campaign OS — public site, results (`/results`)
 *
 * The certified 2026 local government election results, on this site: how many councils in each province have a
 * majority, the metros, and the way into every council and ward. Read from the certified seat table
 * (src/data/lge2026/national/seats-2026.json), built from the Electoral Commission's own result files and checked against
 * its seat calculations. The Commission is cited as the source, not sent to as the destination.
 *
 * Results night (4-7 November) used a live feed board fed by scripts/results-bot.ts; with the results certified, the
 * board has nothing left to show and this page reads the certified figures instead. The bot and its feed validator are
 * kept for by-elections.
 */
import { Link } from 'react-router-dom';
import { SiteSection } from '../SiteChrome';
import { PageIntro, SourceNote } from './pageParts';
import { SeatBar, StatTile, StatusPill } from './resultsParts';
import { nf, provinceName } from '../tools/resultsFormat';
import { councilPath, MY_WARD_PATH, TRACKER_PATH } from '../resultsPaths';
import { COUNCIL_CODES, NATIONAL_SEATS, PROVINCE_CODES, council, nationalPartyTotals, nationalSummary } from '@/modules/lge2026/nationalResults';
import { BarList, StatusSplit } from '../charts/Charts';

export function SiteResults() {
  const s = nationalSummary();
  const all = COUNCIL_CODES.map(council);
  const metros = all.filter((c) => c.category === 'A');
  const registered = all.reduce((n, c) => n + c.registered, 0);
  return (
    <>
      <PageIntro
        eyebrow="Local government elections 2026"
        title="Certified results"
        lead={`Every metro and local council elected on 4 November 2026: ${s.councils} councils, ${nf.format(all.reduce((n, c) => n + c.councillors, 0))} seats and ${nf.format(all.reduce((n, c) => n + c.wards, 0))} wards. ${s.hung} councils have no party with a majority.`}
      >
        <p className="m-0 flex flex-wrap gap-3">
          <Link to={TRACKER_PATH} className="site-btn-primary">Coalition Tracker</Link>
          <Link to={MY_WARD_PATH} className="site-btn-outline-ink">Your ward councillor</Link>
        </p>
      </PageIntro>

      <SiteSection labelledBy="nat-h" className="pb-8">
        <h2 id="nat-h" className="sr-only">National figures</h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-4">
          <StatTile value={s.councils} label="Metro and local councils" />
          <StatTile value={s.hung} label="With no majority" />
          <StatTile value={s.majority} label="With a majority" />
          <StatTile value={nf.format(registered)} label="Registered voters">in the councils’ voting districts</StatTile>
        </div>
      </SiteSection>

      <SiteSection labelledBy="charts-h" className="pb-8">
        <h2 id="charts-h" className="sr-only">Charts</h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,360px),1fr))] gap-5">
          <div className="rounded-[10px] border border-line bg-white p-5">
            <StatusSplit
              title="Councils with and without a majority, by province"
              rows={PROVINCE_CODES.map((p) => ({ id: p, name: provinceName(p), hung: s.byProvince[p].hung, majority: s.byProvince[p].councils - s.byProvince[p].hung }))}
            />
          </div>
          <div className="rounded-[10px] border border-line bg-white p-5">
            <BarList
              title="Council seats won across the country"
              unit="Party"
              series={['Seats']}
              format={(v) => nf.format(v)}
              rows={nationalPartyTotals().slice(0, 10).map((t) => ({ id: t.id, name: t.name, values: [t.seats], emblem: true }))}
            />
          </div>
        </div>
      </SiteSection>

      <SiteSection labelledBy="prov-h" className="pb-8">
        <h2 id="prov-h" className="m-0 mb-4 font-site-display text-site-h4">By province</h2>
        <div className="overflow-x-auto rounded-[10px] border border-line bg-white">
          <table className="w-full min-w-[520px] border-collapse text-left text-site-sm">
            <thead>
              <tr className="border-b border-line bg-paper text-site-caption text-slate">
                <th scope="col" className="px-4 py-3 font-semibold">Province</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Councils</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">No majority</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Majority</th>
              </tr>
            </thead>
            <tbody>
              {PROVINCE_CODES.map((p) => {
                const b = s.byProvince[p];
                return (
                  <tr key={p} className="border-b border-line last:border-b-0">
                    <th scope="row" className="px-4 py-3 font-normal">{provinceName(p)}</th>
                    <td className="px-4 py-3 text-right font-mono">{b.councils}</td>
                    <td className="px-4 py-3 text-right font-mono">{b.hung}</td>
                    <td className="px-4 py-3 text-right font-mono">{b.councils - b.hung}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SiteSection>

      <SiteSection labelledBy="metro-h" className="pb-8">
        <h2 id="metro-h" className="m-0 mb-4 font-site-display text-site-h4">Metros</h2>
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-4 p-0">
          {metros.map((m) => (
            <li key={m.code} className="flex flex-col gap-2 rounded-[10px] border border-line bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <Link to={councilPath(m.code)} className="font-site-display text-site-h5 text-ink">{m.name}</Link>
                <StatusPill hung={m.hung} />
              </div>
              <SeatBar holders={m.holders} councillors={m.councillors} label={m.name} />
            </li>
          ))}
        </ul>
      </SiteSection>

      <SourceNote>
        Source: the Electoral Commission of South Africa, certified results of the 2026 local government elections (event
        EEID1887), one file per council, and its Seat Calculation Detail reports; retrieved {NATIONAL_SEATS.retrieved}.
        Seats are calculated under Schedule 1 of the Municipal Structures Act and match the Commission’s reports for{' '}
        {all.filter((c) => c.iec === 'reconciled').length} of {all.length} councils; each council’s page says how its figure is
        confirmed. District councils are elected under Schedule 2 and are not shown here.
      </SourceNote>
    </>
  );
}
