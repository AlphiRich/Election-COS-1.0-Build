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
import { SiteVideo } from '../SiteVideo';
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
import { IEC_LINK } from '../officialSources';

export function SiteCodeOfConduct() {
  return (
    <>
      <PageIntro
        eyebrow="Know the Rules"
        title="The Electoral Code of Conduct"
        lead="Every party contesting an election and every party and ward candidate is bound by it. It is the reason a canvasser may knock on your door and the reason nobody may buy or bully your vote."
      >
        <p className="m-0 text-site-sm text-slate">{CODE_CAVEAT}</p>
        <nav
          aria-label="On This Page"
          className="flex flex-wrap gap-x-5 gap-y-1 text-site-sm font-semibold"
        >
          <a href="#voters" className="text-teal">
            For Voters
          </a>
          <a href="#parties" className="text-teal">
            For Parties and Candidates
          </a>
          <a href="#station" className="text-teal">
            Inside a Voting Station
          </a>
          <a href="#penalties" className="text-teal">
            If the Code Is Broken
          </a>
        </nav>
      </PageIntro>

      <SiteSection className="pb-8">
        <div className="grid gap-6 ">
          <SiteVideo id="canvasser-knocks" className="max-w-[560px]" />
        </div>
      </SiteSection>

      <SiteSection id="voters" labelledBy="v-h" className="pb-10">
        <div className="flex max-w-[760px] flex-col gap-6">
          <h2 id="v-h" className="m-0 font-site-display text-site-h3">
            For Voters
          </h2>
          <div className="flex flex-col gap-3">
            <h3 className="m-0 font-site-display text-site-h5">What the Code Says You May Do</h3>
            <p className="m-0 text-site-sm text-slate">
              Every party and candidate must publicly state that everyone has the right to:
            </p>
            <RuleList lines={STATED_RIGHTS} />
          </div>
          <div className="flex flex-col gap-3">
            <h3 className="m-0 font-site-display text-site-h5">What Protects You</h3>
            <RuleList lines={VOTER_PROTECTIONS} />
          </div>
          <div className="flex flex-col gap-3">
            <h3 className="m-0 font-site-display text-site-h5">On Voting Day</h3>
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
              Parties and Candidates Must
            </h2>
            <RuleList lines={PARTY_MUST} />
          </div>
          <div className="flex min-w-0 flex-col gap-3">
            <h2 className="m-0 font-site-display text-site-h3">Parties and Candidates Must Not</h2>
            <RuleList lines={PARTY_MUST_NOT} />
          </div>
        </div>
      </SiteSection>

      <SiteSection id="station" labelledBy="s-h" className="pb-10">
        <div className="flex max-w-[760px] flex-col gap-3">
          <h2 id="s-h" className="m-0 font-site-display text-site-h3">
            Agents and Candidates Inside a Voting Station
          </h2>
          <RuleList lines={AT_THE_STATION} />
        </div>
      </SiteSection>

      <SiteSection id="penalties" labelledBy="pen-h" className="pb-10">
        <SiteCard className="flex max-w-[760px] flex-col gap-2 p-8">
          <h2 id="pen-h" className="m-0 font-site-display text-site-h4">
            If the Code Is Broken
          </h2>
          <p className="m-0 text-site-base">{CONSEQUENCES}</p>
          <p className="m-0 font-mono text-site-micro text-slate">{CONSEQUENCES_REF}</p>
          <p className="m-0 text-site-sm">
            The Electoral Commission’s own page on the Code says the same in outline: it binds
            parties, their agents and candidates from the proclamation of the election until the
            results are announced, breach is an offence, and parties can be fined up to R200,000.
            Complaints about breaches go to the Electoral Court, whose Secretary’s number the
            Commission gives as 051 412-7400.
          </p>
          <p className="m-0 flex flex-wrap gap-x-5 gap-y-1 text-site-sm font-semibold">
            <a href={IEC_LINK.codeOfConduct} className="text-teal">
              Commission’s page on the Code →
            </a>
            <a href={IEC_LINK.laws} className="text-teal">
              Laws and regulations →
            </a>
          </p>
        </SiteCard>
      </SiteSection>

      <SiteSection id="disinformation" labelledBy="dis-h" className="pb-10">
        <SiteCard className="flex max-w-[760px] flex-col gap-2 p-8">
          <h2 id="dis-h" className="m-0 font-site-display text-site-h4">
            Seen Election Disinformation?
          </h2>
          <p className="m-0 text-site-base">
            The Commission sends reports to Real411, an independent platform for digital election
            complaints. Include a link or screenshot, and where and when you saw it. Complaints
            cannot be anonymous, though your identity is kept confidential in the outcome.
          </p>
          <p className="m-0 text-site-caption text-slate">
            The Commission describes disinformation as false or misleading information shared by
            someone who knows it is untrue, or has no reasonable basis to believe it, and meant to
            mislead voters or disrupt the election. It does not include satire, opinion, fair
            criticism or genuine political debate.
          </p>
          <p className="m-0 flex flex-wrap gap-x-5 gap-y-1 font-semibold">
            <a href={IEC_LINK.real411} className="text-teal">
              Report to Real411 →
            </a>
            <a href={IEC_LINK.disinformation} className="text-teal">
              The Commission’s page →
            </a>
            <a href={IEC_LINK.fraud} className="text-teal">
              Report electoral fraud →
            </a>
          </p>
        </SiteCard>
      </SiteSection>

      <SourceNote>Source: {CODE_SOURCE}</SourceNote>
    </>
  );
}
