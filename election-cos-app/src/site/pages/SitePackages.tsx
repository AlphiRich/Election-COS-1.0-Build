/**
 * Election Campaign OS — public site, Packages (`/packages`)
 *
 * From the canvas artboard `Packages.dc.html`, 1280×2000, fluid.
 *
 * One published price list is the fourth line of the neutrality pledge,
 * so this page is the pledge made checkable: the same table, in the same
 * order, for everyone who loads it. The buyer column is a row header
 * (`<th scope="row">`) rather than a cell, so a screen reader announces
 * which package each price belongs to instead of reading five bare
 * numbers.
 */
import { Link } from 'react-router-dom';
import { PACKAGES, VAT_NOTE } from '../siteContent';
import { Eyebrow, SiteCard, SiteSection } from '../SiteChrome';

export function SitePackages() {
  return (
    <>
      <SiteSection className="flex flex-col gap-4 pb-12 pt-[88px]">
        <Eyebrow>Packages</Eyebrow>
        <h1 className="m-0 font-site-display text-site-h3 md:text-site-display">
          One Price List, Published for Everyone.
        </h1>
        <p className="m-0 max-w-[36em] text-site-lead">
          The same modules and terms for every party and every independent. Pilot prices on record,
          the full amount payable: no VAT is charged.
        </p>
      </SiteSection>

      {/* ----------------------------------------------------- the list */}
      <SiteSection labelledBy="pk-h" className="pb-[72px]">
        <h2 id="pk-h" className="sr-only">
          Five Buyer Packages
        </h2>
        <div className="overflow-x-auto rounded-[10px] border border-line bg-white">
          <table className="w-full min-w-[820px] border-collapse">
            <thead>
              <tr className="bg-ink text-left text-paper">
                <th scope="col" className="px-6 py-4">
                  Buyer
                </th>
                <th scope="col" className="px-6 py-4">
                  Package
                </th>
                <th scope="col" className="px-6 py-4">
                  Price on Record
                </th>
                <th scope="col" className="px-6 py-4">
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {PACKAGES.map((p) => (
                <tr key={p.buyer} className="border-t border-line align-middle">
                  <th
                    scope="row"
                    className="px-6 py-[22px] text-left font-site-display text-site-h6"
                  >
                    {p.buyer}
                  </th>
                  <td className="px-6 py-[22px] text-site-base">{p.pkg}</td>
                  <td className="px-6 py-[22px]">
                    <span className="font-mono text-site-h6 font-medium">{p.price}</span>
                    <span className="block text-site-caption text-slate">{p.unit}</span>
                  </td>
                  <td className="px-6 py-[22px] text-right">
                    <Link
                      to={p.href}
                      className="site-btn-outline-ink min-h-[44px] whitespace-nowrap px-[18px]"
                    >
                      Talk to Us
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mb-0 mt-3.5 text-site-caption text-slate">
          {VAT_NOTE} The PPFA Governance and Disclosure Add-on is priced after a scoping
          consultation with our engineering team.
        </p>
      </SiteSection>

      {/* ------------------------------------------------- tool + help */}
      <SiteSection className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-5 pb-[88px]">
        <SiteCard className="flex flex-col gap-3 p-8">
          <Eyebrow>Free Tool</Eyebrow>
          <h2 id="tool-h" className="m-0 font-site-display text-site-h4">
            Party-Funding Threshold Checker
          </h2>
          <p className="m-0">
            Check a donation against the disclosure line. It runs in your browser: nothing you type
            leaves your device.
          </p>
          <p className="m-0 text-site-caption text-slate">Illustrative, not legal advice.</p>
          <Link to="/tools/party-funding-checker" className="mt-2 self-start font-semibold">
            Open the Checker →
          </Link>
        </SiteCard>

        <article className="flex flex-col gap-3 rounded-[10px] bg-ink p-8 text-paper">
          <h2 className="m-0 font-site-display text-site-h4">Not Sure Which Package Fits?</h2>
          <p className="m-0 text-line">
            Tell us your role and wards. We reply within one working day.
          </p>
          <Link to="/contact" className="site-btn-primary mt-auto self-start">
            Send an Enquiry
          </Link>
        </article>
      </SiteSection>
    </>
  );
}
