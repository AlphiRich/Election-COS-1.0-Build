/** Election Campaign OS — public site, /legal/privacy | terms | cookies. */
import { LEGAL_PAGES, type LegalKind } from '../platformContent';
import { INFORMATION_OFFICER } from '../siteContent';
import { SiteSection } from '../SiteChrome';
import { PageIntro } from './pageParts';

export function SiteLegal({ kind }: { kind: LegalKind }) {
  const page = LEGAL_PAGES[kind];
  return (
    <>
      <PageIntro eyebrow="Legal" title={page.title} lead={page.lead} />
      <SiteSection className="pb-[88px]">
        <ul className="m-0 flex list-disc flex-col gap-2 pl-5">
          {page.facts.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        <p className="mt-6 rounded-[10px] border border-line bg-white p-4 text-site-caption">
          {page.pending}
        </p>
        {kind === 'privacy' && <p>Information Officer: {INFORMATION_OFFICER}</p>}
      </SiteSection>
    </>
  );
}
