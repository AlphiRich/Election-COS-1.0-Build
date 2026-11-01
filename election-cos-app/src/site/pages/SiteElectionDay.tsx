/**
 * Election Campaign OS — public site, election-day guide (`/election-day`)
 *
 * Hours, what to take, what to do about a lost ID, and how to get to your
 * station. The ID guidance is what earlier elections accepted, stated as
 * that, because this build has no 2026 notice from the Commission or Home
 * Affairs to cite and will not present last cycle's rule as this one's.
 */
import { Link } from 'react-router-dom';
import { SiteCard, SiteSection } from '../SiteChrome';
import { PageIntro, SourceNote } from './pageParts';
import { StationSearch } from './StationSearch';
import { HOURS_BASIS } from '../electionDay';
import { IEC_VOTER_EDUCATION_VIDEOS } from '../tools/manifestoLinks';

const IEC = 'https://www.elections.org.za';
const DHA = 'https://www.dha.gov.za';

export function SiteElectionDay() {
  return (
    <>
      <PageIntro
        eyebrow="Wednesday 4 November 2026"
        title="Election day guide"
        lead="What to take, when to go, what to do if your ID is lost, and how to find your voting station."
      />

      <SiteSection labelledBy="hrs-h" className="pb-8">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-5">
          <SiteCard className="flex min-w-0 flex-col gap-2 p-6">
            <h2 id="hrs-h" className="m-0 font-site-display text-site-h5">
              Voting hours
            </h2>
            <p className="m-0 font-mono text-site-h3 font-medium">07:00 – 21:00</p>
            <p className="m-0 text-site-sm">
              Stations close at 21:00. Everyone in the queue by then who is entitled to vote at that
              station must be allowed to vote. Nobody can join after it has closed.
            </p>
            <p className="m-0 text-site-caption text-slate">
              {HOURS_BASIS} Check the Commission’s announcements for your station.
            </p>
          </SiteCard>
          <SiteCard className="flex min-w-0 flex-col gap-2 p-6">
            <h2 className="m-0 font-site-display text-site-h5">Take with you</h2>
            <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-site-sm">
              <li>Your identity document (see below).</li>
              <li>The address of the voting station where you are registered.</li>
            </ul>
            <p className="m-0 text-site-caption text-slate">
              Do not wear or carry party clothing or material into the station: nobody may campaign
              inside it.
            </p>
          </SiteCard>
        </div>
      </SiteSection>

      <SiteSection id="lost-id" labelledBy="id-h" className="pb-8">
        <SiteCard className="flex max-w-[760px] flex-col gap-3 p-8">
          <h2 id="id-h" className="m-0 font-site-display text-site-h4">
            Lost your ID?
          </h2>
          <p className="m-0 text-site-base">
            At earlier elections the Electoral Commission accepted a green bar-coded ID book, a
            smart ID card, or a valid temporary identity certificate. Home Affairs issues the
            temporary certificate, and at earlier elections it kept offices open for this on voting
            days.
          </p>
          <ol className="m-0 flex list-decimal flex-col gap-1.5 pl-5 text-site-base">
            <li>
              Go to a Home Affairs office as early as you can and ask for a temporary identity
              certificate.
            </li>
            <li>
              Take it to the station where you are registered. Your registration does not change.
            </li>
            <li>Not sure? Ask the Electoral Commission before you travel.</li>
          </ol>
          <p className="m-0 flex flex-wrap gap-x-5 gap-y-1 font-semibold">
            <a href={DHA} className="text-teal">
              Department of Home Affairs →
            </a>
            <a href={IEC} className="text-teal">
              Electoral Commission →
            </a>
          </p>
          <p className="m-0 text-site-caption text-slate">
            This describes earlier elections. No 2026 notice on accepted documents or Home Affairs
            opening hours was available when this page was written, so confirm both with those
            offices.
          </p>
        </SiteCard>
      </SiteSection>

      <SiteSection id="station" labelledBy="st-h" className="pb-8">
        <SiteCard className="flex max-w-[760px] flex-col gap-4 p-8">
          <h2 id="st-h" className="m-0 font-site-display text-site-h4">
            Find your voting station and get there
          </h2>
          <p className="m-0 text-site-sm text-slate">
            Search for your ward number or station name in JB Marks, then open directions in the map
            app you use. For other municipalities, use the Electoral Commission’s list of voting
            stations.
          </p>
          <StationSearch idPrefix="ed" />
        </SiteCard>
      </SiteSection>

      <SiteSection labelledBy="more-h" className="pb-10">
        <h2 id="more-h" className="mb-4 mt-0 font-site-display text-site-h4">
          More to read and watch
        </h2>
        <ul className="m-0 flex list-none flex-col gap-2 p-0 font-semibold">
          <li>
            <Link to="/code-of-conduct" className="text-teal">
              What parties may and may not do →
            </Link>
          </li>
          <li>
            <Link to="/tools/check-your-details" className="text-teal">
              Voter details checklist →
            </Link>
          </li>
          <li>
            <Link to="/results" className="text-teal">
              Results →
            </Link>
          </li>
          <li>
            <a href={IEC_VOTER_EDUCATION_VIDEOS} className="text-teal">
              Electoral Commission voter-education videos on YouTube →
            </a>
          </li>
        </ul>
      </SiteSection>

      <SourceNote>
        Voting hours and station rules: Local Government: Municipal Electoral Act 27 of 2000,
        sections 40 and 45. Identity documents: as accepted at earlier elections, not a 2026 notice.
      </SourceNote>
    </>
  );
}
