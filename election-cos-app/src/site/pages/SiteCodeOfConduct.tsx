/**
 * Election Campaign OS — public site, the Electoral Code of Conduct
 * (`/code-of-conduct`)
 *
 * Two halves for two readers, on one page so each can see what the other
 * is held to: what a voter can expect, and what a party, candidate or
 * agent must and must not do. Content and sourcing are in
 * `codeOfConduct.ts`.
 */
import { SiteCard, SiteSection } from '../SiteChrome';
import { PageIntro, RuleList, SourceNote } from './pageParts';
import {
  AT_THE_STATION,
  CODE_CAVEAT,
  CODE_SOURCE,
  CONSEQUENCES,
  CONSEQUENCES_REF,
  PARTY_MUST,
  PARTY_MUST_NOT,
  STATED_RIGHTS,
  VOTER_PROTECTIONS,
  VOTING_DAY_RIGHTS,
} from '../codeOfConduct';

export function SiteCodeOfConduct() {
  return (
    <>
      <PageIntro
        eyebrow="Know the rules"
        title="The Electoral Code of Conduct"
        lead="Every party contesting an election and every party and ward candidate is bound by it. It is the reason a canvasser may knock on your door and the reason nobody may buy or bully your vote."
      >
        <p className="m-0 text-site-sm text-slate">{CODE_CAVEAT}</p>
        <nav
          aria-label="On this page"
          className="flex flex-wrap gap-x-5 gap-y-1 text-site-sm font-semibold"
        >
          <a href="#voters" className="text-teal">
            For voters
          </a>
          <a href="#parties" className="text-teal">
            For parties and candidates
          </a>
          <a href="#station" className="text-teal">
            Inside a voting station
          </a>
          <a href="#penalties" className="text-teal">
            If the Code is broken
          </a>
        </nav>
      </PageIntro>

      <SiteSection id="voters" labelledBy="v-h" className="pb-10">
        <div className="flex max-w-[760px] flex-col gap-6">
          <h2 id="v-h" className="m-0 font-site-display text-site-h3">
            For voters
          </h2>
          <div className="flex flex-col gap-3">
            <h3 className="m-0 font-site-display text-site-h5">What the Code says you may do</h3>
            <p className="m-0 text-site-sm text-slate">
              Every party and candidate must publicly state that everyone has the right to:
            </p>
            <RuleList lines={STATED_RIGHTS} />
          </div>
          <div className="flex flex-col gap-3">
            <h3 className="m-0 font-site-display text-site-h5">What protects you</h3>
            <RuleList lines={VOTER_PROTECTIONS} />
          </div>
          <div className="flex flex-col gap-3">
            <h3 className="m-0 font-site-display text-site-h5">On voting day</h3>
            <RuleList lines={VOTING_DAY_RIGHTS} />
          </div>
          <SiteCard className="p-6">
            <p className="m-0 font-semibold">If something is wrong at your station</p>
            <p className="mb-0 mt-1 text-site-sm">
              Tell the presiding officer. If you are refused a ballot paper, you may object, in
              writing, on the prescribed form. Complaints about breaches of the Code go to the
              Electoral Commission.
            </p>
          </SiteCard>
        </div>
      </SiteSection>

      <SiteSection id="parties" labelledBy="p-h" className="pb-10">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-8">
          <div className="flex min-w-0 flex-col gap-3">
            <h2 id="p-h" className="m-0 font-site-display text-site-h3">
              Parties and candidates must
            </h2>
            <RuleList lines={PARTY_MUST} />
          </div>
          <div className="flex min-w-0 flex-col gap-3">
            <h2 className="m-0 font-site-display text-site-h3">Parties and candidates must not</h2>
            <RuleList lines={PARTY_MUST_NOT} />
          </div>
        </div>
      </SiteSection>

      <SiteSection id="station" labelledBy="s-h" className="pb-10">
        <div className="flex max-w-[760px] flex-col gap-3">
          <h2 id="s-h" className="m-0 font-site-display text-site-h3">
            Agents and candidates inside a voting station
          </h2>
          <RuleList lines={AT_THE_STATION} />
        </div>
      </SiteSection>

      <SiteSection id="penalties" labelledBy="pen-h" className="pb-10">
        <SiteCard className="flex max-w-[760px] flex-col gap-2 p-8">
          <h2 id="pen-h" className="m-0 font-site-display text-site-h4">
            If the Code is broken
          </h2>
          <p className="m-0 text-site-base">{CONSEQUENCES}</p>
          <p className="m-0 font-mono text-site-micro text-slate">{CONSEQUENCES_REF}</p>
        </SiteCard>
      </SiteSection>

      <SourceNote>Source: {CODE_SOURCE}</SourceNote>
    </>
  );
}
