/** Election Campaign OS — public site, 404. */
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { SiteSection } from '../SiteChrome';
import { PageIntro } from './pageParts';

export function SiteNotFound() {
  // A static host answers 200 for every path; tell crawlers it is not a page.
  useEffect(() => {
    const m = document.createElement('meta');
    m.name = 'robots';
    m.content = 'noindex';
    document.head.appendChild(m);
    return () => m.remove();
  }, []);
  return (
    <>
      <PageIntro
        eyebrow="404"
        title="That Page Is Not Here."
        lead="It may have moved, or the address may be mistyped."
      />
      <SiteSection className="pb-[88px]">
        <Link to="/" className="site-btn-primary">
          Back to the Home Page
        </Link>
      </SiteSection>
    </>
  );
}
