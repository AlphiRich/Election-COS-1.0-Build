/**
 * Election Campaign OS — public site, Research (`/research`)
 *
 * The site's job is to convert: a visitor who is a councillor, a
 * treasurer or a caucus office arrives with a problem, not with a product
 * in mind. This page is for them. It lists the researched explainers the
 * site already publishes, and offers one thing more: a research report on
 * a customer pain point, commissioned through an enquiry.
 *
 * NOTHING HERE IS INVENTED
 * No report title, figure or "downloads" count appears that does not exist.
 * The published research is the explainers, each with its sources and date.
 * A commissioned report is a service offered, described as one; it is not
 * a catalogue of reports that have been written. The pain points listed
 * are the three the product is built around, in the product's own terms.
 */
import { Link } from 'react-router-dom';
import { EXPLAINERS } from '../explainers';
import { Eyebrow, SiteCard, SiteSection } from '../SiteChrome';

const PAIN_POINTS = [
  {
    title: 'Keeping Funding Inside the Law',
    body: 'Donor totals that must be added up across payments, a disclosure line that moved, and a quarterly return somebody has to sign.',
    interest: 'report:party-funding-compliance',
  },
  {
    title: 'Following a Resident’s Complaint Through to the Municipality',
    body: 'Complaints raised at the door that never reach the right department, and a councillor’s office with no record of what was asked or when.',
    interest: 'report:casework-follow-through',
  },
  {
    title: 'Running a Canvass Without Breaking POPIA',
    body: 'Consent, the voters’ roll, volunteers working offline, and what you may and may not keep about a person.',
    interest: 'report:canvassing-and-popia',
  },
] as const;

export function SiteResearch() {
  return (
    <>
      <SiteSection className="flex flex-col gap-4 pb-10 pt-[88px]">
        <Eyebrow>Research</Eyebrow>
        <h1 className="m-0 font-site-display text-site-h3 md:text-site-h1">
          Research on the Problems You Actually Have
        </h1>
        <p className="m-0 max-w-[36em] text-site-lead">
          Plain-language analysis, with sources and a date on every page. Where we have not
          researched your question yet, we will say so, and you can commission it.
        </p>
      </SiteSection>

      <SiteSection labelledBy="rs-pub" className="flex flex-col gap-6 pb-12">
        <h2 id="rs-pub" className="m-0 font-site-display text-site-h4">
          Published Now
        </h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-5">
          {EXPLAINERS.map((e) => (
            <SiteCard key={e.slug} className="flex flex-col gap-3 p-6">
              <h3 className="m-0 font-site-display text-site-h5">
                <Link to={e.path}>{e.title}</Link>
              </h3>
              <p className="m-0 text-site-sm">{e.standfirst}</p>
              <span className="mt-auto text-site-micro text-slate">
                {e.sources.length} sources · updated {e.updated}
              </span>
            </SiteCard>
          ))}
        </div>
      </SiteSection>

      <SiteSection labelledBy="rs-cmn" className="flex flex-col gap-6 pb-[88px]">
        <h2 id="rs-cmn" className="m-0 font-site-display text-site-h4">
          Commission a Report on Your Pain Point
        </h2>
        <p className="m-0 max-w-[40em] text-site-base">
          Tell us the problem and your wards. We reply within one working day to scope it. A report
          is analysis of public law and public data, not legal advice, and it never uses a voter’s
          personal details.
        </p>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-5">
          {PAIN_POINTS.map((p) => (
            <SiteCard key={p.interest} className="flex flex-col gap-3 p-6">
              <h3 className="m-0 font-site-display text-site-h5">{p.title}</h3>
              <p className="m-0 text-site-sm">{p.body}</p>
              <Link
                to={`/contact?interest=${encodeURIComponent(p.interest)}`}
                className="site-btn-outline-ink mt-auto self-start"
              >
                Ask for This Report
              </Link>
            </SiteCard>
          ))}
        </div>
        <p className="m-0 text-site-base">
          Prefer to see the platform first? <Link to="/book-a-demo">Book a demo</Link>.
        </p>
      </SiteSection>
    </>
  );
}
