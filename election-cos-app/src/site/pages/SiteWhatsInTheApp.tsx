/**
 * Election Campaign OS — public site, what the app includes
 * (`/whats-in-the-app`)
 *
 * A plain list of what the software does, read from the same content the
 * rest of the site uses, so a claim here cannot differ from the claim on
 * the compliance page. Built things say Built. Nothing roadmap is
 * presented as available, and nothing is named that the build does not
 * contain.
 */
import { Link } from 'react-router-dom';
import { CASEWORK_FEATURES, CASE_STEPS, PILLARS, whatsAppHref } from '../siteContent';
import { Eyebrow, SiteCard, SiteSection, StatusBadge } from '../SiteChrome';

export function SiteWhatsInTheApp() {
  return (
    <>
      <SiteSection className="pb-8 pt-[88px]">
        <div className="flex max-w-[760px] flex-col gap-4">
          <Eyebrow>For councillors, ward offices and parties</Eyebrow>
          <h1 className="m-0 font-site-display text-site-h3 md:text-site-h2">What is in the app</h1>
          <p className="m-0 text-site-lead">
            The voter tools on this site are free. The app behind them is what a ward office or a
            party uses between elections, and what residents notice as faster answers.
          </p>
        </div>
      </SiteSection>

      <SiteSection labelledBy="pill-h" className="pb-10">
        <h2 id="pill-h" className="mb-6 mt-0 font-site-display text-site-h4">
          Five capabilities
        </h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-4">
          {PILLARS.map((p) => (
            <article
              key={p.name}
              className="flex min-w-0 flex-col gap-2.5 rounded-[10px] border border-line bg-white p-6"
            >
              <StatusBadge status={p.status} />
              <h3 className="m-0 font-site-display text-site-h6">{p.name}</h3>
              <p className="m-0 text-site-sm">{p.does}</p>
              <p className="mb-0 mt-auto border-t border-line pt-2.5 text-site-caption text-slate">
                <span className="font-semibold text-ink">Proof:</span> {p.proof}
              </p>
            </article>
          ))}
        </div>
      </SiteSection>

      <SiteSection labelledBy="case-h" className="pb-10">
        <SiteCard className="flex flex-col gap-5 p-8">
          <h2 id="case-h" className="m-0 font-site-display text-site-h4">
            What a resident’s complaint goes through
          </h2>
          <ol className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-4 p-0">
            {CASE_STEPS.map((s) => (
              <li key={s.n} className="min-w-0 border-l-[3px] border-ink pl-4">
                <p className="m-0 font-semibold">{s.title}</p>
                <p className="mb-0 mt-1 text-site-sm text-slate">{s.body}</p>
              </li>
            ))}
          </ol>
        </SiteCard>
      </SiteSection>

      <SiteSection labelledBy="safe-h" className="pb-10">
        <h2 id="safe-h" className="mb-6 mt-0 font-site-display text-site-h4">
          Built to work in the field and to keep data safe
        </h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-4">
          {CASEWORK_FEATURES.map((f) => (
            <div key={f.title} className="min-w-0 rounded-[10px] border border-line bg-white p-6">
              <p className="m-0 font-semibold">{f.title}</p>
              <p className="mb-0 mt-1 text-site-sm text-slate">{f.body}</p>
            </div>
          ))}
        </div>
      </SiteSection>

      <SiteSection className="pb-[88px]">
        <div className="flex flex-wrap gap-3">
          <Link to="/for-campaigns" className="site-btn-primary">
            See the software and prices
          </Link>
          <a href={whatsAppHref('Election Campaign OS enquiry')} className="site-btn-outline-ink">
            Talk to us on WhatsApp
          </a>
        </div>
      </SiteSection>
    </>
  );
}
