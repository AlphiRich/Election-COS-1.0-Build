/**
 * Election Campaign OS — public site, voters registered in your area
 * (`/for-campaigns/voters-in-your-area`)
 *
 * For parties planning a campaign: how many voters were registered in a
 * municipality when the delimitation was drawn, how many wards and
 * councillors, and for JB Marks the ward-by-ward split. No age cohorts,
 * and the page says why (see `tools/areaStats.ts`).
 */
import { useMemo, useState } from 'react';
import { SiteCard, SiteSection } from '../SiteChrome';
import { PageIntro, SourceNote } from './pageParts';
import { findCouncil, searchCouncils } from '../tools/councilFinder';
import { bandPosition, nationalVoters, provinceTotals } from '../tools/areaStats';
import { lookupMunicipality } from '@/modules/reference/municipalRegister';
import seed from '../../../seed-data/jb-marks-nw405-wards-vds.json';

const nf = new Intl.NumberFormat('en-ZA');
interface SeedWard {
  ward: { wardCode: string; registeredVoters: number };
  votingDistricts: unknown[];
}
const JB: Array<{ n: number; voters: number; vds: number }> = (seed as SeedWard[])
  .map((w) => ({
    n: Number(/W(\d+)$/.exec(w.ward.wardCode)?.[1]),
    voters: w.ward.registeredVoters,
    vds: w.votingDistricts.length,
  }))
  .sort((a, b) => a.n - b.n);

const POSITION = {
  below: 'Below the band',
  within: 'Within the band',
  above: 'Above the band',
} as const;

export function SiteAreaStats() {
  const [query, setQuery] = useState('');
  const [code, setCode] = useState('NW405');
  const matches = useMemo(() => searchCouncils(query), [query]);
  const council = findCouncil(code);
  const reg = lookupMunicipality(code);
  const provinces = useMemo(() => provinceTotals(), []);

  return (
    <>
      <PageIntro
        eyebrow="For Parties and Campaign Teams"
        title="Registered Voters in Your Area"
        lead="How many voters the delimitation counted in a municipality, how many wards and councillors it has, and how those voters are spread across wards."
      />
      <SiteSection className="pb-8">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-6">
          <SiteCard className="flex min-w-0 flex-col gap-3 p-6">
            <label htmlFor="as-search" className="font-semibold">
              Search Municipalities
            </label>
            <input
              id="as-search"
              type="search"
              className="site-field"
              value={query}
              onChange={(e) => {
                const next = e.target.value;
                setQuery(next);
                const found = searchCouncils(next);
                if (found.length > 0 && !found.some((m) => m.code === code)) setCode(found[0].code);
              }}
              autoComplete="off"
              placeholder="Name, province or code"
            />
            <label htmlFor="as-pick" className="font-semibold">
              Municipality ({matches.length} Shown)
            </label>
            <select
              id="as-pick"
              className="site-field"
              value={matches.some((m) => m.code === code) ? code : ''}
              onChange={(e) => setCode(e.target.value)}
            >
              {matches.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.name} · {m.province}
                </option>
              ))}
            </select>
          </SiteCard>
          {council && matches.some((m) => m.code === council.code) && (
            <SiteCard className="flex min-w-0 flex-col gap-3 p-6">
              <div role="status" aria-live="polite">
                <h2 className="m-0 font-site-display text-site-h4">{council.name}</h2>
                <p className="m-0 text-site-sm text-slate">
                  {council.categoryLabel} · {council.province}
                </p>
              </div>
              <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(min(100%,130px),1fr))] gap-4">
                <div>
                  <dt className="text-site-caption text-slate">Registered voters</dt>
                  <dd className="m-0 font-mono text-site-h4 font-medium">
                    {nf.format(council.registeredVoters)}
                  </dd>
                </div>
                <div>
                  <dt className="text-site-caption text-slate">Councillors</dt>
                  <dd className="m-0 font-mono text-site-h4 font-medium">{council.councillors}</dd>
                </div>
                <div>
                  <dt className="text-site-caption text-slate">Voters per councillor</dt>
                  <dd className="m-0 font-mono text-site-h4 font-medium">
                    {nf.format(Math.round(council.registeredVoters / council.councillors))}
                  </dd>
                </div>
                {council.wards !== null && (
                  <div>
                    <dt className="text-site-caption text-slate">Wards</dt>
                    <dd className="m-0 font-mono text-site-h4 font-medium">{council.wards}</dd>
                  </div>
                )}
                {council.averageVotersPerWard !== null && (
                  <div>
                    <dt className="text-site-caption text-slate">Average per ward</dt>
                    <dd className="m-0 font-mono text-site-h4 font-medium">
                      {nf.format(council.averageVotersPerWard)}
                    </dd>
                  </div>
                )}
              </dl>
              {council.category === 'C' && (
                <p className="m-0 text-site-caption text-slate">
                  A district’s voters are the same people counted in its local municipalities, so
                  they are not added to the national total.
                </p>
              )}
            </SiteCard>
          )}
        </div>
      </SiteSection>

      {council?.code === 'NW405' && reg && (
        <SiteSection labelledBy="ward-h" className="pb-8">
          <SiteCard className="flex flex-col gap-3 p-6">
            <h2 id="ward-h" className="m-0 font-site-display text-site-h4">
              JB Marks, Ward by Ward
            </h2>
            <p className="m-0 text-site-sm text-slate">
              Wards are drawn to stay within 15% of the average ({nf.format(reg.minNorm ?? 0)} to{' '}
              {nf.format(reg.maxNorm ?? 0)} voters here).
            </p>
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[480px] border-collapse text-site-sm">
                <thead>
                  <tr className="border-b border-line text-left">
                    <th scope="col" className="py-2 pr-4">
                      Ward
                    </th>
                    <th scope="col" className="py-2 pr-4 text-right">
                      Voters
                    </th>
                    <th scope="col" className="py-2 pr-4 text-right">
                      Voting Districts
                    </th>
                    <th scope="col" className="py-2">
                      Against the Band
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {JB.map((w) => (
                    <tr key={w.n} className="border-b border-line">
                      <th scope="row" className="py-1.5 pr-4 text-left font-semibold">
                        Ward {w.n}
                      </th>
                      <td className="py-1.5 pr-4 text-right font-mono">{nf.format(w.voters)}</td>
                      <td className="py-1.5 pr-4 text-right font-mono">{w.vds}</td>
                      <td className="py-1.5">
                        {
                          POSITION[
                            bandPosition(w.voters, reg.minNorm ?? 0, reg.maxNorm ?? Infinity)
                          ]
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SiteCard>
        </SiteSection>
      )}

      <SiteSection labelledBy="prov-h" className="pb-8">
        <SiteCard className="flex flex-col gap-3 p-6">
          <h2 id="prov-h" className="m-0 font-site-display text-site-h4">
            By Province
          </h2>
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-site-sm">
              <caption className="pb-2 text-left text-site-caption text-slate">
                National Total: {nf.format(nationalVoters())} Registered Voters (Local and
                Metropolitan Municipalities)
              </caption>
              <thead>
                <tr className="border-b border-line text-left">
                  <th scope="col" className="py-2 pr-4">
                    Province
                  </th>
                  <th scope="col" className="py-2 pr-4 text-right">
                    Municipalities
                  </th>
                  <th scope="col" className="py-2 pr-4 text-right">
                    Wards
                  </th>
                  <th scope="col" className="py-2 pr-4 text-right">
                    Councillors
                  </th>
                  <th scope="col" className="py-2 text-right">
                    Registered Voters
                  </th>
                </tr>
              </thead>
              <tbody>
                {provinces.map((p) => (
                  <tr key={p.province} className="border-b border-line">
                    <th scope="row" className="py-1.5 pr-4 text-left font-semibold">
                      {p.province}
                    </th>
                    <td className="py-1.5 pr-4 text-right font-mono">{p.municipalities}</td>
                    <td className="py-1.5 pr-4 text-right font-mono">{nf.format(p.wards)}</td>
                    <td className="py-1.5 pr-4 text-right font-mono">{nf.format(p.councillors)}</td>
                    <td className="py-1.5 text-right font-mono">{nf.format(p.registeredVoters)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SiteCard>
      </SiteSection>

      <SiteSection labelledBy="age-h" className="pb-8">
        <SiteCard className="flex max-w-[760px] flex-col gap-2 p-6">
          <h2 id="age-h" className="m-0 font-site-display text-site-h5">
            Age Groups: Not Shown, and Why
          </h2>
          <p className="m-0 text-site-base">
            The delimitation gives a voter total per municipality and nothing about age, and this
            site holds no voting-district file for the rest of the country. An age model built from
            those totals would be an invented statistic, so none is shown. The Electoral Commission
            publishes age breakdowns of the voters’ roll. Once one is loaded, this page can show age
            groups by municipality.
          </p>
        </SiteCard>
      </SiteSection>

      <SourceNote>
        Source: Annexure A to IEC Circular 1 of 2025, the delimitation for the 4 November 2026
        election. These are the voters registered when it was drawn. The roll has grown since, so a
        municipality with more voters today than shown here is normal. JB Marks wards: North West
        Provincial Gazette 8929, 18 November 2025, Provincial Notice 1300 of 2025.
      </SourceNote>
    </>
  );
}
