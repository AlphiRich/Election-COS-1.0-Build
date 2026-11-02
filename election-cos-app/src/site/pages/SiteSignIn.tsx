/** Election Campaign OS — public site, /sign-in: hands over to the app origin. */
import { useEffect } from 'react';
import { SITE } from '../siteContent';
import { SiteSection } from '../SiteChrome';
import { PageIntro } from './pageParts';

export function SiteSignIn() {
  useEffect(() => {
    window.location.replace(SITE.appOrigin);
  }, []);
  return (
    <>
      <PageIntro
        eyebrow="Sign in"
        title="Taking you to the application."
        lead="Sign-in happens on the application, not on this site."
      />
      <SiteSection className="pb-[88px]">
        <a href={SITE.appOrigin} className="site-btn-primary">
          Continue to {SITE.appOrigin.replace('https://', '')}
        </a>
      </SiteSection>
    </>
  );
}
