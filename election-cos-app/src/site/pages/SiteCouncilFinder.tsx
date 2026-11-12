/**
 * Election Campaign OS — public site, council and ballot finder
 * (`/tools/your-council`)
 *
 * Pick a municipality and see how its council is made up, from the
 * proclaimed delimitation. Candidate names are not held here and the page
 * says so: the Electoral Commission publishes the certified lists, and
 * putting up anything else would be inventing people.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eyebrow, SiteCard, SiteSection } from '../SiteChrome';
import { PromoPlayer } from '../PromoPlayer';
import { ballotsFor, findCouncil, searchCouncils } from '../tools/councilFinder';
import { BASELINE_AUTHORITY, ROLL_BASIS } from '@/modules/reference/municipalRegister';
import { DETAILS_PATH, SEATS_PATH } from './SiteVoterTools';

const IEC = 'https://www.elections.org.za';
const nf = new Intl.NumberFormat('en-ZA');

export function SiteCouncilFinder() {
  const [query, setQuery] = useState('');
  const [code, setCode] = useState('NW405');
  const matches = useMemo(() => searchCouncils(query), [query]);
  const council = findCouncil(code);

  return (
    <>
      <SiteSection className="pb-8 pt-[88px]">
        <div className="flex max-w-[760px] flex-col gap-4">
          <Eyebrow>Voter Tool</Eyebrow>
          <h1 className="m-0 font-site-display text-site-h3 md:text-site-h2">
            Your Council and Your Ballot
          </h1>
          <p className="m-0 text-site-lead">
            Find your municipality to see how many councillors it has, how many of them come from
            wards, and what you will be asked to vote on.
          </p>
        </div>
      </SiteSection>

      <SiteSection className="pb-8">
        <PromoPlayer id="who-governs-your-council" className="max-w-[420px]" />
      </SiteSection>

      <SiteSection className="pb-10">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-6">
          <SiteCard className="flex min-w-0 flex-col gap-3 p-6">
            <label htmlFor="council-search" className="font-semibold">
              Search Municipalities
            </label>
            <input
              id="council-search"
              type="search"
              className="site-field"
              placeholder="Name, province or code, for example JB Marks"
              value={query}
              onChange={(e) => {
                const next = e.target.value;
                setQuery(next);
                // Land on the first match so the result follows what was typed.
                const found = searchCouncils(next);
                if (found.length > 0 && !found.some((m) => m.code === code)) setCode(found[0].code);
              }}
              autoComplete="off"
            />
            <label htmlFor="council-pick" className="font-semibold">
              Municipality ({matches.length} Shown)
            </label>
            <select
              id="council-pick"
              className="site-field"
              value={matches.some((m) => m.code === code) ? code : ''}
              onChange={(e) => setCode(e.target.value)}
            >
              {!matches.some((m) => m.code === code) && (
                <option value="">
                  {matches.length === 0 ? 'No Match' : 'Choose a Municipality'}
                </option>
              )}
              {matches.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.name} · {m.province}
                </option>
              ))}
            </select>
          </SiteCard>

          {council && matches.some((m) => m.code === council.code) && (
            <SiteCard className="flex min-w-0 flex-col gap-4 p-6">
              <div role="status" aria-live="polite" className="flex flex-col gap-1">
                <h2 className="m-0 font-site-display text-site-h4">{council.name}</h2>
                <p className="m-0 text-site-sm text-slate">
                  {council.categoryLabel} · {council.province}
                </p>
              </div>
              <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(min(100%,120px),1fr))] gap-4">
                <div>
                  <dt className="text-site-caption text-slate">Councillors</dt>
                  <dd className="m-0 font-mono text-site-h3 font-medium">{council.councillors}</dd>
                </div>
                <div>
                  <dt className="text-site-caption text-slate">Wards</dt>
                  <dd className="m-0 font-mono text-site-h3 font-medium">
                    {council.wards ?? 'None'}
                  </dd>
                </div>
                <div>
                  <dt className="text-site-caption text-slate">PR seats</dt>
                  <dd className="m-0 font-mono text-site-h3 font-medium">
                    {council.prCouncillors ?? 'n/a'}
                  </dd>
                </div>
              </dl>
              {council.wards !== null && council.prCouncillors !== null ? (
                <p className="m-0 text-site-sm">
                  {council.councillors} councillors − {council.wards} ward councillors ={' '}
                  {council.prCouncillors} elected by proportional representation. Each ward elects
                  one councillor; the rest of the council is filled from party lists.
                </p>
              ) : (
                <p className="m-0 text-site-sm">
                  A district council has no wards. Its seats are allocated differently from a local
                  or metropolitan council, and this site does not explain that method.
                </p>
              )}
              <p className="m-0 text-site-caption text-slate">
                Registered voters when the delimitation was drawn:{' '}
                {nf.format(council.registeredVoters)}
                {council.averageVotersPerWard !== null &&
                  `, about ${nf.format(council.averageVotersPerWard)} per ward`}
                . {ROLL_BASIS}
              </p>
            </SiteCard>
          )}
        </div>
      </SiteSection>

      {council && matches.some((m) => m.code === council.code) && (
        <SiteSection labelledBy="ballot-h" className="pb-10">
          <div className="flex flex-col gap-4">
            <h2 id="ballot-h" className="m-0 font-site-display text-site-h4">
              What You Will Vote On
            </h2>
            <ol className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-4 p-0">
              {ballotsFor(council).map((b) => (
                <li
                  key={b.title}
                  className="min-w-0 rounded-[10px] border border-line bg-white p-5"
                >
                  <p className="m-0 font-semibold">{b.title}</p>
                  <p className="mb-0 mt-1 text-site-sm text-slate">{b.detail}</p>
                </li>
              ))}
            </ol>
            <p className="m-0 text-site-caption text-slate">
              This describes the usual arrangement. Confirm the ballots for your area with the
              Electoral Commission.
            </p>
          </div>
        </SiteSection>
      )}

      <SiteSection labelledBy="cand-h" className="pb-10">
        <SiteCard className="flex flex-col gap-3 p-8">
          <h2 id="cand-h" className="m-0 font-site-display text-site-h4">
            Who Is Standing in Your Ward
          </h2>
          <p className="m-0 text-site-base">
            This site does not hold candidate names. Putting a name here that the Electoral
            Commission has not certified would be guessing, so the lists are left to the people who
            publish them.
          </p>
          <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 text-site-base">
            <li>
              Ward and party candidate lists come from the Electoral Commission:{' '}
              <a href={IEC} className="font-semibold text-teal">
                elections.org.za
              </a>
              .
            </li>
            <li>
              To know which ward you are in, use the{' '}
              <Link to={DETAILS_PATH} className="font-semibold text-teal">
                voter details checklist
              </Link>
              .
            </li>
            <li>
              To see how votes turn into seats once the lists are known, try{' '}
              <Link to={SEATS_PATH} className="font-semibold text-teal">
                how seats are calculated
              </Link>
              .
            </li>
          </ul>
        </SiteCard>
      </SiteSection>

      <SiteSection className="pb-[88px]">
        <p className="m-0 max-w-[48em] text-site-caption text-slate">
          Source: Annexure A to IEC Circular 1 of 2025, the delimitation for the 4 November 2026
          election. {BASELINE_AUTHORITY}
        </p>
      </SiteSection>
    </>
  );
}
