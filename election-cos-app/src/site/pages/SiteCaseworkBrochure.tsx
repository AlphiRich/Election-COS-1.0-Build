/**
 * Election Campaign OS — public site, the Councillor Casework Tracker brochure (`/casework-tracker/brochure`)
 *
 * The "Download the Brochure" buttons on the Casework page used to open the contact form: there was no brochure. This is
 * one, laid out for A4 and saved as a PDF from the browser's print dialog ("Save as PDF"), so there is no separate file to
 * fall out of date. Every line comes from the same constants the Casework page renders (`siteContent.ts`): the steps, the
 * features, the questions, the published price and the contact details. Nothing here is written only for the brochure, so
 * the brochure cannot claim what the page does not.
 *
 * Print styles: the site header and footer carry `print:hidden`, and this page's buttons do too.
 */
import { Link } from 'react-router-dom';
import { CASEWORK_FAQ, CASEWORK_FEATURES, CASE_STEPS, PACKAGES, SITE, VAT_NOTE } from '../siteContent';
import { SiteSection } from '../SiteChrome';
import { answeredQuestions } from '../claimsGate';

const TRACKER = PACKAGES.find((p) => p.pkg === 'Councillor Casework Tracker')!;
const FAQ = answeredQuestions(CASEWORK_FAQ);
const SALES = SITE.mailboxes.find((m) => m.address.startsWith('sales@'))!.address;

export function SiteCaseworkBrochure() {
  return (
    <SiteSection className="pb-[88px] pt-10 print:p-0">
      <div className="mb-6 flex flex-wrap items-center gap-3 print:hidden">
        <button type="button" onClick={() => window.print()} className="site-btn-primary">
          Save as PDF
        </button>
        <Link to="/casework-tracker" className="site-btn-outline-ink">
          Back to the Casework Tracker
        </Link>
        <span className="text-site-caption text-slate">In the print dialog, choose &ldquo;Save as PDF&rdquo; as the printer.</span>
      </div>

      <article className="mx-auto flex max-w-[210mm] flex-col gap-8 rounded-[10px] border border-line bg-white p-10 print:max-w-none print:border-0 print:p-0">
        <header className="flex flex-col gap-3 border-b-2 border-ink pb-6">
          <p className="m-0 text-site-caption font-semibold uppercase tracking-wide text-slate">
            Election Campaign OS · Councillor Casework Tracker
          </p>
          <h1 className="m-0 font-site-display text-site-h2">Every Case, Followed Through.</h1>
          <p className="m-0 text-site-lead">
            A resident raises a problem at the door. Your office triages it, you authorise it, and a signed referral goes to
            the municipality, tracked until it is resolved.
          </p>
        </header>

        <section aria-labelledby="b-flow">
          <h2 id="b-flow" className="m-0 mb-4 font-site-display text-site-h4">
            How a Case Moves
          </h2>
          <ol className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-5 print:grid-cols-5">
            {CASE_STEPS.map((s) => (
              <li key={s.n} className="flex flex-col gap-1 rounded-md border border-line p-3">
                <span className="font-mono text-site-caption text-slate">{s.n}</span>
                <span className="font-site-display text-site-h6">{s.title}</span>
                <span className="text-site-sm">{s.body}</span>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="b-ref">
          <h2 id="b-ref" className="m-0 mb-2 font-site-display text-site-h4">
            The Signed Referral
          </h2>
          <p className="m-0">
            Each referral is a PDF the municipality can file and act on. It carries an integrity hash, so anyone can check it
            has not been altered since your office signed it. It states on its face that it is a party document with no state
            authority. It asks; it does not instruct.
          </p>
        </section>

        <section aria-labelledby="b-feat">
          <h2 id="b-feat" className="m-0 mb-4 font-site-display text-site-h4">
            Built for the Ward
          </h2>
          <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-3 print:grid-cols-3">
            {CASEWORK_FEATURES.map((f) => (
              <li key={f.title} className="rounded-md border border-line p-4">
                <h3 className="m-0 font-site-display text-site-h6">{f.title}</h3>
                <p className="m-0 mt-1 text-site-sm">{f.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="b-price" className="rounded-md bg-ink p-6 text-paper print:break-inside-avoid">
          <h2 id="b-price" className="m-0 font-site-display text-site-h4">
            {TRACKER.price} {TRACKER.unit}
          </h2>
          <p className="m-0 mt-1 text-site-sm text-line">{VAT_NOTE}</p>
        </section>

        <section aria-labelledby="b-faq" className="print:break-before-page">
          <h2 id="b-faq" className="m-0 mb-3 font-site-display text-site-h4">
            Questions
          </h2>
          <dl className="m-0 flex flex-col gap-4">
            {FAQ.map((item) => (
              <div key={item.q} className="print:break-inside-avoid">
                <dt className="font-semibold">{item.q}</dt>
                <dd className="m-0 mt-1 text-site-sm">{item.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <footer className="flex flex-col gap-1 border-t border-line pt-6 text-site-sm">
          <p className="m-0 font-semibold">Start with one ward.</p>
          <p className="m-0">
            WhatsApp {SITE.whatsApp.display} ({SITE.whatsApp.role.toLowerCase()}) · {SALES} · electioncos.co.za/casework-tracker
          </p>
          <p className="m-0 text-slate">{SITE.address}</p>
        </footer>
      </article>
    </SiteSection>
  );
}
