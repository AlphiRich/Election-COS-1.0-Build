/**
 * Election Campaign OS — public site, voter tools hub (`/tools`)
 *
 * The index of the free tools. Every card says what the tool uses as its
 * source, because the tools differ in how much they can know: the council
 * and seat tools run on the proclaimed delimitation, the details checker
 * sends people to the Electoral Commission for anything personal.
 */
import { Link } from 'react-router-dom';
import { Eyebrow, SiteSection } from '../SiteChrome';
import { FUNDING_CHECKER_PATH } from './SiteFundingChecker';

export const COUNCIL_PATH = '/tools/your-council';
export const DETAILS_PATH = '/tools/check-your-details';
export const SEATS_PATH = '/tools/how-seats-are-calculated';
export const COALITION_PATH = '/tools/how-coalitions-work';

const TOOLS = [
  {
    to: DETAILS_PATH,
    title: 'Check your voter details',
    body: 'A short checklist for polling week, and a search for your ward and voting station in JB Marks.',
    source: 'Electoral Commission for anything personal; MDB ward notice for JB Marks',
  },
  {
    to: COUNCIL_PATH,
    title: 'Your council and your ballot',
    body: 'Pick your municipality: how many councillors, how many wards, how many seats are proportional, and which ballots you will see.',
    source: 'Annexure A to IEC Circular 1 of 2025',
  },
  {
    to: SEATS_PATH,
    title: 'How seats are calculated',
    body: 'Step through how votes become council seats, starting from a real result, and try your own numbers.',
    source: 'Worked example: IEC seat calculation report, JB Marks 2021',
  },
  {
    to: COALITION_PATH,
    title: 'How coalitions work',
    body: 'Combine parties and see whether they pass half the seats. Lists every smallest group that does.',
    source: 'Arithmetic on seat numbers you choose',
  },
  {
    to: FUNDING_CHECKER_PATH,
    title: 'Party-funding threshold checker',
    body: 'Where one donor’s total sits against the disclosure line and the annual limit.',
    source: 'Government Gazette 53182, 18 August 2025',
  },
];

export function SiteVoterTools() {
  return (
    <>
      <SiteSection className="pb-8 pt-[88px]">
        <div className="flex max-w-[760px] flex-col gap-4">
          <Eyebrow>Free tools</Eyebrow>
          <h1 className="m-0 font-site-display text-site-h3 md:text-site-h1">Voter tools</h1>
          <p className="m-0 text-site-lead">
            Five tools, all free, none asking you to sign in. Nothing you type is sent anywhere.
            None of them tells you who to vote for.
          </p>
        </div>
      </SiteSection>
      <SiteSection labelledBy="tools-h" className="pb-[88px]">
        <h2 id="tools-h" className="sr-only">
          The tools
        </h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-5">
          {TOOLS.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              className="flex min-w-0 flex-col gap-3 rounded-[10px] border border-line bg-white p-7 text-ink no-underline"
            >
              <span className="font-site-display text-site-h5">{t.title}</span>
              <span className="text-site-base text-slate">{t.body}</span>
              <span className="font-mono text-site-micro text-slate">Source: {t.source}</span>
              <span className="mt-auto pt-2 font-semibold text-teal">Open →</span>
            </Link>
          ))}
        </div>
      </SiteSection>
    </>
  );
}
