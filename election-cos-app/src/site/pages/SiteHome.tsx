/**
 * Election Campaign OS — public site, Home (`/`)
 *
 * The front door is for the public: a voter, a journalist, somebody who
 * heard a figure on the radio and wants to know whether it is right. The
 * selling pages (Casework Tracker, Packages, Compliance) are one step
 * away under `/for-campaigns`, because the people who pay for the
 * product are a small part of the people who will read this site, and
 * the site earns its keep by being useful to the rest.
 *
 * Everything claimed here is something the site actually does:
 * the checker runs in the browser and sends nothing, the explainers cite
 * their sources, and the neutrality line is the pledge on the
 * for-campaigns page.
 */
import { Link } from 'react-router-dom';
import { EXPLAINERS } from '../explainers';
import { FUNDING_CHECKER_PATH } from './SiteFundingChecker';
import { Eyebrow, SiteCard, SiteSection } from '../SiteChrome';

const IEC_URL = 'https://www.elections.org.za';

const WONT = [
  'Tell you who to vote for. This site does not endorse any party or candidate.',
  'Give legal advice. Each explainer says so, and says where to get it.',
  'State a figure it cannot source. Every figure lists its source.',
];

export function SiteHome() {
  return (
    <>
      <section className="border-t border-teal bg-ink text-paper">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-6 pb-[88px] pt-[80px]">
          <Eyebrow tone="gold">Municipal elections · polling day 4 November 2026</Eyebrow>
          <h1 className="m-0 max-w-[16em] font-site-display text-site-h3 md:text-site-hero">
            The rules of the election, in plain language.
          </h1>
          <p className="m-0 max-w-[36em] text-site-lead text-line">
            How a council is made up, what parties may be given, and what the law says about your
            personal details. Free to read, with the source beside every figure.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link to={FUNDING_CHECKER_PATH} className="site-btn-primary">
              Try the party-funding checker
            </Link>
            <Link to="/explainers" className="site-btn-outline-paper">
              Read the explainers
            </Link>
          </div>
        </div>
      </section>

      <SiteSection labelledBy="tool-h" className="pb-6 pt-[72px]">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] gap-5">
          <SiteCard className="flex min-w-0 flex-col gap-3 p-8">
            <Eyebrow>Free tool</Eyebrow>
            <h2 id="tool-h" className="m-0 font-site-display text-site-h4">
              Did a donation cross the disclosure line?
            </h2>
            <p className="m-0 text-site-base text-slate">
              Enter what one donor has given. It tells you which side of the published thresholds
              the total falls on. It runs in your browser and nothing you type is sent anywhere.
            </p>
            <Link to={FUNDING_CHECKER_PATH} className="mt-auto pt-2 font-semibold text-teal">
              Open the checker →
            </Link>
          </SiteCard>

          <SiteCard className="flex min-w-0 flex-col gap-3 p-8">
            <Eyebrow>Before polling day</Eyebrow>
            <h2 className="m-0 font-site-display text-site-h4">Check you are registered</h2>
            <p className="m-0 text-site-base text-slate">
              Registration is checked with the Electoral Commission, not here. This site holds no
              voters&rsquo; roll.
            </p>
            <a href={IEC_URL} className="mt-auto pt-2 font-semibold text-teal">
              Go to elections.org.za →
            </a>
          </SiteCard>
        </div>
      </SiteSection>

      <SiteSection labelledBy="ex-h" className="py-[56px]">
        <h2 id="ex-h" className="mb-8 mt-0 font-site-display text-site-h3">
          Questions people ask
        </h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-5">
          {EXPLAINERS.map((e) => (
            <Link
              key={e.slug}
              to={e.path}
              className="flex min-w-0 flex-col gap-3 rounded-[10px] border border-line bg-white p-7 text-ink no-underline"
            >
              <span className="font-mono text-site-micro text-slate">{e.question}</span>
              <span className="font-site-display text-site-h5">{e.title}</span>
              <span className="text-site-sm text-slate">{e.standfirst}</span>
              <span className="mt-auto pt-2 font-semibold text-teal">Read the answer →</span>
            </Link>
          ))}
        </div>
      </SiteSection>

      <section aria-labelledby="wont-h" className="border-y border-line bg-white">
        <div className="mx-auto grid max-w-[1200px] grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] items-start gap-10 px-6 py-[72px]">
          <div>
            <Eyebrow>What this site will not do</Eyebrow>
            <h2 id="wont-h" className="mb-0 mt-3 font-site-display text-site-h2">
              Informative, and nothing more.
            </h2>
          </div>
          <ul className="m-0 flex list-none flex-col gap-3 p-0 text-site-base">
            {WONT.map((item) => (
              <li key={item} className="border-l-[3px] border-ink pl-5">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <SiteSection labelledBy="who-h" className="py-[72px]">
        <div className="flex flex-wrap items-center justify-between gap-6 rounded-xl bg-ink p-10 text-paper">
          <div className="min-w-0 flex-[1_1_360px]">
            <h2 id="who-h" className="m-0 font-site-display text-site-h3">
              Run a ward office or a campaign?
            </h2>
            <p className="mb-0 mt-1.5 text-site-base text-line">
              Election Campaign OS is also the casework and compliance software behind this site,
              offered to every party and independent on the same terms.
            </p>
          </div>
          <Link to="/for-campaigns" className="site-btn-primary">
            See the software
          </Link>
        </div>
      </SiteSection>
    </>
  );
}
