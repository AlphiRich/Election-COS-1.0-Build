/** Election Campaign OS — public site, About (`/about`), with the neutrality pledge. */
import { SITE } from '../siteContent';
import { NEUTRALITY_PLEDGE } from '../platformContent';
import { SiteSection } from '../SiteChrome';
import { PageIntro } from './pageParts';

export function SiteAbout() {
  return (
    <>
      <PageIntro
        eyebrow="About"
        title="Built by Innovation Consult."
        lead={`${SITE.productName} is made by ${SITE.entity}, ${SITE.registration}.`}
      />
      <SiteSection id="pledge" labelledBy="ab-pledge" className="pb-[88px]">
        <h2 id="ab-pledge" className="mb-4 mt-0 font-site-display text-site-h4">
          Neutrality Pledge
        </h2>
        <ul className="m-0 flex list-disc flex-col gap-2 pl-5">
          {NEUTRALITY_PLEDGE.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        <p className="mt-6">
          <a href={SITE.corporateUrl}>innovationconsult.co.za</a>
        </p>
      </SiteSection>
    </>
  );
}
