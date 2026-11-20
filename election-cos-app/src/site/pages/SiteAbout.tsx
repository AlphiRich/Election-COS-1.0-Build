/**
 * Election Campaign OS — public site, About (`/about`): the Innovation Consult
 * corporate page. Built from the Company Profile 2026–2031; company identity,
 * registration and B-BBEE come from `SITE` (the one source), the narrative from
 * `CORPORATE`. Product maturity is stated explicitly so a future-dated product
 * never reads as available now.
 */
import { Link } from 'react-router-dom';
import { SITE } from '../siteContent';
import { CORPORATE, NEUTRALITY_PLEDGE } from '../platformContent';
import { Eyebrow, SiteCard, SiteSection } from '../SiteChrome';
import { PageIntro } from './pageParts';

export function SiteAbout() {
  return (
    <>
      <PageIntro eyebrow={`Innovation Consult · ${CORPORATE.tagline}`} title="Built by Innovation Consult." lead={CORPORATE.lead} />

      {/* Heritage + the three profile stats */}
      <SiteSection className="pb-6">
        <p className="m-0 max-w-[48em] text-site-base text-slate">{CORPORATE.heritage}</p>
        <dl className="mt-8 grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] gap-5">
          {CORPORATE.stats.map((s) => (
            <div key={s.label} className="rounded-[10px] border border-line bg-white p-6">
              <dt className="font-site-display text-site-h3">{s.value}</dt>
              <dd className="m-0 mt-1 text-site-sm text-slate">{s.label}</dd>
            </div>
          ))}
        </dl>
      </SiteSection>

      {/* How we work — the three non-negotiable norms */}
      <SiteSection labelledBy="ab-ethos" className="py-10">
        <h2 id="ab-ethos" className="mb-8 mt-0 font-site-display text-site-h3">
          How We Work
        </h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-5">
          {CORPORATE.ethos.map((e) => (
            <SiteCard key={e.name} className="flex flex-col gap-2 p-7">
              <span className="font-site-display text-site-h5">{e.name}</span>
              <span className="text-site-sm text-slate">{e.body}</span>
            </SiteCard>
          ))}
        </div>
      </SiteSection>

      {/* The product suite */}
      <SiteSection labelledBy="ab-suite" className="py-10">
        <h2 id="ab-suite" className="mb-2 mt-0 font-site-display text-site-h3">
          The Innovation Consult Suite
        </h2>
        <p className="mb-8 mt-0 max-w-[44em] text-site-base text-slate">
          Four independent products, each with an explicit maturity stage. Election Campaign OS is the one
          this site is about.
        </p>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-5">
          {CORPORATE.products.map((p) => {
            const inner = (
              <>
                <span className="font-mono text-site-micro uppercase tracking-[0.08em] text-teal">{p.stage}</span>
                <span className="font-site-display text-site-h5">{p.name}</span>
                <span className="text-site-sm text-slate">{p.body}</span>
                {p.href && <span className="mt-auto pt-2 font-semibold text-teal">See the product →</span>}
              </>
            );
            return p.href ? (
              <Link key={p.name} to={p.href} className="flex min-w-0 flex-col gap-2 rounded-[10px] border border-line bg-white p-7 text-ink no-underline">
                {inner}
              </Link>
            ) : (
              <article key={p.name} className="flex min-w-0 flex-col gap-2 rounded-[10px] border border-line bg-white p-7">
                {inner}
              </article>
            );
          })}
        </div>
      </SiteSection>

      {/* Leadership */}
      <SiteSection labelledBy="ab-lead" className="py-10">
        <h2 id="ab-lead" className="mb-8 mt-0 font-site-display text-site-h3">
          Leadership
        </h2>
        <div className="grid gap-5 md:grid-cols-2">
          {CORPORATE.leadership.map((l) => (
            <SiteCard key={l.name} className="flex flex-col gap-1.5 p-7">
              <span className="font-site-display text-site-h5">{l.name}</span>
              <span className="text-site-caption uppercase tracking-[0.06em] text-slate">{l.role}</span>
              <span className="mt-1 text-site-sm text-slate">{l.bio}</span>
            </SiteCard>
          ))}
        </div>
      </SiteSection>

      {/* Neutrality pledge — kept: it governs this product */}
      <SiteSection id="pledge" labelledBy="ab-pledge" className="py-10">
        <h2 id="ab-pledge" className="mb-4 mt-0 font-site-display text-site-h4">
          Neutrality Pledge
        </h2>
        <ul className="m-0 flex list-disc flex-col gap-2 pl-5 text-site-base">
          {NEUTRALITY_PLEDGE.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </SiteSection>

      {/* Corporate particulars — B-BBEE as a statutory footnote, never positioning */}
      <section aria-labelledby="ab-particulars" className="border-y border-line bg-white">
        <div className="mx-auto max-w-[1200px] px-6 py-[72px]">
          <Eyebrow>Corporate Particulars</Eyebrow>
          <h2 id="ab-particulars" className="mb-6 mt-3 font-site-display text-site-h4">
            Statutory and Contact Detail
          </h2>
          <dl className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-x-8 gap-y-4 text-site-sm">
            <div>
              <dt className="text-site-micro uppercase tracking-[0.06em] text-slate">Registered Entity</dt>
              <dd className="m-0 mt-1">{SITE.entity}</dd>
            </div>
            <div>
              <dt className="text-site-micro uppercase tracking-[0.06em] text-slate">Registration</dt>
              <dd className="m-0 mt-1 font-mono">{SITE.registration}</dd>
            </div>
            <div>
              <dt className="text-site-micro uppercase tracking-[0.06em] text-slate">Directors</dt>
              <dd className="m-0 mt-1">{CORPORATE.leadership.map((l) => l.name).join(' · ')}</dd>
            </div>
            <div>
              <dt className="text-site-micro uppercase tracking-[0.06em] text-slate">Head Office</dt>
              <dd className="m-0 mt-1">{CORPORATE.particulars.headOffice}</dd>
            </div>
            <div>
              <dt className="text-site-micro uppercase tracking-[0.06em] text-slate">Postal</dt>
              <dd className="m-0 mt-1">{CORPORATE.particulars.postal}</dd>
            </div>
            <div>
              <dt className="text-site-micro uppercase tracking-[0.06em] text-slate">Telephone</dt>
              <dd className="m-0 mt-1">
                <a href={CORPORATE.particulars.phoneHref} className="text-teal">
                  {CORPORATE.particulars.phone}
                </a>
              </dd>
            </div>
          </dl>
          <p className="mt-6 max-w-[52em] text-site-caption text-slate">{SITE.bbbee}</p>
          <p className="mt-2 text-site-sm">
            <a href={SITE.corporateUrl} className="text-teal">
              innovationconsult.co.za
            </a>
          </p>
        </div>
      </section>
    </>
  );
}
