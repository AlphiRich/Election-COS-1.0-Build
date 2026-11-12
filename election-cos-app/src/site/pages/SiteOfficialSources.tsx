/**
 * Election Campaign OS — public site, official Electoral Commission sources
 * (`/official-sources`)
 *
 * One page that points at the Commission's own pages for each process, so
 * that anything this site summarises can be checked at the source.
 */
import { SiteCard, SiteSection } from '../SiteChrome';
import { PageIntro } from './pageParts';
import { OFFICIAL_GROUPS } from '../officialSources';

export function SiteOfficialSources() {
  return (
    <>
      <PageIntro
        eyebrow="Check It at the Source"
        title="Official Electoral Commission Sources"
        lead="This site summarises. The Electoral Commission decides. These are its own pages for each process, grouped by who needs them."
      />
      <SiteSection className="pb-[88px]">
        <div className="flex flex-col gap-8">
          {OFFICIAL_GROUPS.map((g) => (
            <section key={g.id} aria-labelledby={`os-${g.id}`} className="flex flex-col gap-3">
              <h2 id={`os-${g.id}`} className="m-0 font-site-display text-site-h4">
                {g.title}
              </h2>
              <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-3 p-0">
                {g.links.map((l) => (
                  <li key={l.url} className="min-w-0">
                    <SiteCard className="flex h-full flex-col gap-1 p-4">
                      <a href={l.url} className="font-semibold text-teal">
                        {l.label} →
                      </a>
                      <span className="text-site-sm text-slate">{l.about}</span>
                    </SiteCard>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <p className="m-0 max-w-[48em] text-site-caption text-slate">
            These links open the Commission’s and its partners’ own sites. This site is not part of
            the Electoral Commission. Each address was checked on 1 November 2026; pages move, so if
            one has, use the Commission’s home page.
          </p>
        </div>
      </SiteSection>
    </>
  );
}
