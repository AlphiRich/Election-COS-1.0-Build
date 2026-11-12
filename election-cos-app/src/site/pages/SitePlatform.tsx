/** Election Campaign OS — public site, Platform (`/platform`). */
import { Link } from 'react-router-dom';
import { PILLARS } from '../siteContent';
import { PLATFORM_ROLES } from '../platformContent';
import { Eyebrow, SiteCard, SiteSection, StatusBadge } from '../SiteChrome';
import { PageIntro } from './pageParts';

export function SitePlatform() {
  return (
    <>
      <PageIntro
        eyebrow="Platform"
        title="One Platform, Seven Roles, Every Ward."
        lead="Each person sees only the wards they are assigned to. Every capability below is marked built or roadmap."
      />
      <SiteSection labelledBy="pf-pillars" className="pb-14">
        <h2 id="pf-pillars" className="mb-5 mt-0 font-site-display text-site-h4">
          What It Does
        </h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-5">
          {PILLARS.map((p) => (
            <SiteCard key={p.name} className="flex flex-col gap-2 p-6">
              <StatusBadge status={p.status} />
              <h3 className="m-0 font-site-display text-site-h6">{p.name}</h3>
              <p className="m-0">{p.does}</p>
            </SiteCard>
          ))}
        </div>
      </SiteSection>
      <SiteSection labelledBy="pf-roles" className="pb-[88px]">
        <Eyebrow>Roles</Eyebrow>
        <h2 id="pf-roles" className="mb-5 mt-2 font-site-display text-site-h4">
          Who Does What
        </h2>
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-4 p-0">
          {PLATFORM_ROLES.map((r) => (
            <li key={r.label}>
              <SiteCard className="h-full p-5">
                <h3 className="m-0 font-site-display text-site-h6">{r.label}</h3>
                <p className="mb-0 mt-1.5">{r.does}</p>
              </SiteCard>
            </li>
          ))}
        </ul>
        <p className="mt-8">
          <Link to="/book-a-demo" className="site-btn-primary">
            Book a Demo
          </Link>
        </p>
      </SiteSection>
    </>
  );
}
