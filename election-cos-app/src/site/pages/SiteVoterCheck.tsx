/**
 * Election Campaign OS — public site, voter details checklist
 * (`/tools/check-your-details`)
 *
 * WHAT THIS CAN AND CANNOT DO
 *
 * It cannot look anybody up on the voters' roll. The roll is the Electoral
 * Commission's, this site holds no voter, and asking a member of the public
 * for an ID number on a third-party site is the wrong thing to normalise.
 * So the tool does what it can do honestly: a checklist that sends the
 * personal checks to the Commission, the dates from the published
 * timetable, and a ward and voting-station search where this build holds
 * the Municipal Demarcation Board's records (JB Marks only).
 *
 * The page never asks for an ID number, and says so.
 */
import { useState } from 'react';
import { Eyebrow, SiteCard, SiteSection } from '../SiteChrome';
import { StationSearch } from './StationSearch';

const IEC = 'https://www.elections.org.za';
const MDB = 'https://www.demarcation.org.za';

const STEPS = [
  {
    id: 'registered',
    title: 'Confirm you are on the voters’ roll',
    body: 'Only the Electoral Commission can tell you this. Use its voter registration status service. This site never asks for your ID number.',
    href: IEC,
    label: 'Open elections.org.za',
  },
  {
    id: 'address',
    title: 'Check the address or voting district it has for you',
    body: 'Your voting station depends on where you registered. The roll closed to new registrations and changes on 7 August 2026, so if it is wrong now, ask the Electoral Commission what your options are.',
  },
  {
    id: 'ward',
    title: 'Find your ward and voting station',
    body: 'JB Marks has a search below. For any other municipality, ward information comes from the Municipal Demarcation Board and the Electoral Commission.',
    href: MDB,
    label: 'Municipal Demarcation Board',
  },
  {
    id: 'id',
    title: 'Have your identity document ready',
    body: 'Take the document you registered with to the voting station on 4 November 2026.',
  },
  {
    id: 'special',
    title: 'Special votes',
    body: 'Applications closed on 12 October 2026. Special votes are cast on 2 and 3 November 2026 for people who applied.',
  },
];

const DATES = [
  ['7 August 2026', 'Roll closed to new registrations and changes'],
  ['14 August 2026', 'List of voting stations published'],
  ['16 September 2026', 'Final list of successful candidates published'],
  ['2–3 November 2026', 'Special votes'],
  ['4 November 2026', 'Election day'],
];

export function SiteVoterCheck() {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const finished = STEPS.filter((s) => done[s.id]).length;

  return (
    <>
      <SiteSection className="pb-8 pt-[88px]">
        <div className="flex max-w-[760px] flex-col gap-4">
          <Eyebrow>Voter tool</Eyebrow>
          <h1 className="m-0 font-site-display text-site-h3 md:text-site-h2">
            Check your voter details
          </h1>
          <p className="m-0 text-site-lead">
            A checklist for polling week. The personal checks happen on the Electoral Commission’s
            own service, so nothing about you passes through this page.
          </p>
        </div>
      </SiteSection>

      <SiteSection labelledBy="steps-h" className="pb-10">
        <div className="flex max-w-[760px] flex-col gap-4">
          <h2 id="steps-h" className="m-0 font-site-display text-site-h4">
            Your checklist{' '}
            <span className="font-mono text-site-sm text-slate" role="status" aria-live="polite">
              {finished} of {STEPS.length} done
            </span>
          </h2>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {STEPS.map((s) => (
              <li key={s.id} className="rounded-[10px] border border-line bg-white p-5">
                <label className="flex min-h-[48px] cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    id={`step-${s.id}`}
                    className="mt-1 h-5 w-5 flex-none accent-teal"
                    checked={!!done[s.id]}
                    onChange={(e) => setDone((d) => ({ ...d, [s.id]: e.target.checked }))}
                  />
                  <span className="min-w-0">
                    <span className="block font-semibold">{s.title}</span>
                    <span className="mt-1 block text-site-sm text-slate">{s.body}</span>
                  </span>
                </label>
                {s.href && (
                  <a href={s.href} className="ml-8 mt-1 inline-block font-semibold text-teal">
                    {s.label} →
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      </SiteSection>

      <SiteSection labelledBy="find-h" className="pb-10">
        <SiteCard className="flex max-w-[760px] flex-col gap-4 p-8">
          <h2 id="find-h" className="m-0 font-site-display text-site-h4">
            Find your ward and voting station in JB Marks
          </h2>
          <p className="m-0 text-site-sm text-slate">
            Type a ward number (for example 12) or part of a voting station’s name. This covers JB
            Marks Local Municipality only.
          </p>
          <StationSearch idPrefix="vc" />
        </SiteCard>
      </SiteSection>

      <SiteSection labelledBy="dates-h" className="pb-[88px]">
        <h2 id="dates-h" className="mb-4 mt-0 font-site-display text-site-h4">
          Key dates, 2026 election
        </h2>
        <dl className="m-0 grid max-w-[760px] grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-x-6 gap-y-3">
          {DATES.map(([d, t]) => (
            <div key={d} className="border-l-[3px] border-ink pl-4">
              <dt className="font-mono text-site-sm">{d}</dt>
              <dd className="m-0 text-site-sm text-slate">{t}</dd>
            </div>
          ))}
        </dl>
        <p className="mb-0 mt-4 max-w-[48em] text-site-caption text-slate">
          From the Electoral Commission’s published 2026 election timetable. This is a summary, not
          the Government Gazette. Check dates at elections.org.za before relying on them.
        </p>
      </SiteSection>
    </>
  );
}
