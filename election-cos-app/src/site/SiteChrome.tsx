/**
 * Election Campaign OS — public site chrome and primitives
 *
 * The header, footer and the handful of shapes every page on
 * electioncos.co.za repeats, implemented from the design canvas.
 *
 * WHY THESE ARE NOT `components/ui`
 *
 * The application's primitives are app chrome: `PageHeader` takes a
 * route slug and renders a breadcrumb, `StatTile` is sized for a war
 * room, `Pill` is a status word. They are right for a screen somebody
 * signs in to and wrong for a page somebody arrives at from a search
 * result. What is shared is what should be shared — the tokens, the
 * type scale, the accessibility rules and the no-hex discipline — and
 * `SiteCard` deliberately matches `Card`'s shape so the two systems
 * read as one family rather than two products.
 *
 * TWO TOKENS THIS NEEDED THAT THE APPLICATION DID NOT
 *
 *  - `line` (#DCD6C8), the warm border. The app uses `border-ink/10`,
 *    which is right on a dense screen and goes cold and grey at the
 *    scale a marketing page uses it.
 *  - `font-site-display` (Archivo, not Archivo Narrow). The app
 *    compresses headings because columns are scarce; a 56px narrow
 *    heading on a landing page reads as a poster.
 *
 * Both are in `src/design/tokens.ts` with their reasoning, and
 * `tokens.test.ts` holds them to `tailwind.config.js`.
 *
 * ACCESSIBILITY, AS DRAWN
 *
 * Every control here is the real element — `<a href>`, `<button>`,
 * `<input>` with a `<label>` — per rule 13. Icon-only buttons carry an
 * `aria-label`, decorative SVG is `aria-hidden`, and status is carried
 * by the word as well as the colour, which is the canvas's own rule.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { SITE, SITE_NAV, whatsAppHref, type NavGroup } from './siteContent';
import whatsAppQr from './assets/whatsapp-qr.svg';
import { AdConsentWithdrawLink } from './ads/ConsentBanner';
import { VotingRibbon } from './VotingRibbon';
import { BrandMark } from '@/components/BrandMark';
import { InstallAppButton } from './pwa/InstallAppButton';

/* ------------------------------------------------------------- mark */

/** The product mark, shared with the application and the icons (see BrandMark). */
export function SiteMark({ size = 36 }: { size?: number }) {
  return <BrandMark size={size} />;
}

/* ----------------------------------------------------------- header */

export function SiteHeader({ enquirySubject }: { enquirySubject: string }) {
  const { pathname, hash } = useLocation();
  const here = `${pathname}${hash}`;

  return (
    <header className="bg-ink text-paper">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-8 gap-y-4 px-6 py-4">
        <Link to="/" className="flex items-center gap-3 text-paper no-underline">
          <SiteMark />
          <span className="flex flex-col leading-tight">
            <span className="font-site-display text-site-h6">{SITE.productName}</span>
            <span className="text-site-nano text-line">{SITE.byline}</span>
          </span>
        </Link>

        <nav aria-label="Primary" className="flex-[1_1_480px]">
          <ul className="m-0 flex list-none flex-wrap gap-x-[22px] gap-y-1 p-0 text-site-sm font-semibold">
            {SITE_NAV.map((group) => (
              <NavMenu key={group.label} group={group} here={here} pathname={pathname} />
            ))}
          </ul>
        </nav>

        <div className="flex flex-wrap items-center gap-[18px]">
          <InstallAppButton />
          {/* The application is the staff workspace; the public never needs to sign in. */}
          <a href={SITE.appOrigin} className="text-site-sm font-semibold text-paper">
            Staff Sign-In
          </a>
          <Link to="/book-a-demo" className="site-btn-outline-paper text-site-sm">
            Book a Demo
          </Link>
          <a href={whatsAppHref(enquirySubject)} className="site-btn-primary text-site-sm">
            Talk to Us
          </a>
        </div>
      </div>
    </header>
  );
}

/**
 * One group of the primary menu: a button that opens a panel of links. A disclosure, not an ARIA menu: Tab moves
 * through the links, Escape closes and returns focus to the button, and the panel closes on a click outside or when
 * the page changes. The group reads as current when any of its pages is open.
 */
function NavMenu({ group, here, pathname }: { group: NavGroup; here: string; pathname: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLLIElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const isHere = (href: string) => href === here || pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));
  const current = group.items.some((i) => isHere(i.href)) || (group.label.startsWith('Results') && pathname.startsWith('/councils/'));

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <li ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex min-h-[44px] items-center gap-1.5 ${current ? 'text-gold underline underline-offset-[6px]' : 'text-paper hover:underline hover:underline-offset-[6px]'}`}
      >
        {group.label}
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" className={`transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="M1 3l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <ul
        id={id}
        hidden={!open}
        className="absolute left-0 top-full z-40 m-0 mt-1 flex w-[min(86vw,300px)] list-none flex-col gap-0.5 rounded-[10px] border border-line bg-white p-2 font-normal text-ink shadow-lg"
      >
        {group.items.map((item) => (
          <li key={item.href}>
            <Link
              to={item.href}
              aria-current={isHere(item.href) ? 'page' : undefined}
              className={`flex flex-col rounded-md px-3 py-2 no-underline hover:bg-paper ${isHere(item.href) ? 'bg-paper' : ''}`}
            >
              <span className="text-site-sm font-semibold text-ink">{item.label}</span>
              {item.hint && <span className="text-site-caption text-slate">{item.hint}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </li>
  );
}

/* ----------------------------------------------------------- footer */

export function SiteFooter({
  onWithdrawAdConsent,
  adsEnabled,
}: {
  onWithdrawAdConsent: () => void;
  adsEnabled: boolean;
}) {
  return (
    <footer className="bg-ink text-line text-site-sm">
      <div className="mx-auto grid max-w-[1200px] grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-8 px-6 pb-8 pt-14">
        <div className="flex flex-col gap-2">
          <span className="font-site-display text-site-h6 text-paper">
            {SITE.productName} {SITE.byline}
          </span>
          <span>{SITE.entity}</span>
          <span>{SITE.registration}</span>
          <span>{SITE.address}</span>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="font-semibold text-paper">Contact</span>
          <a href={whatsAppHref('Election Campaign OS enquiry')} className="text-line">
            {SITE.whatsApp.role}: WhatsApp {SITE.whatsApp.display}
          </a>
          <img
            src={whatsAppQr}
            alt={`QR code for WhatsApp ${SITE.whatsApp.display}, the ${SITE.whatsApp.role.toLowerCase()}`}
            width={112}
            height={112}
            className="rounded bg-paper p-1"
          />
          {SITE.mailboxes.map((box) => (
            <a key={box.address} href={`mailto:${box.address}`} className="text-line">
              {box.address}
            </a>
          ))}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="font-semibold text-paper">Legal</span>
          <Link to="/legal/privacy" className="text-line">
            Privacy Notice
          </Link>
          <Link to="/legal/terms" className="text-line">
            Terms
          </Link>
          <Link to="/legal/cookies" className="text-line">
            Cookie Notice
          </Link>
          <Link to="/about#pledge" className="text-line">
            Neutrality Pledge
          </Link>
          <Link to="/code-of-conduct" className="text-line">
            Electoral Code of Conduct
          </Link>
          <Link to="/results" className="text-line">
            Results
          </Link>
          <Link to="/official-sources" className="text-line">
            Official Commission Sources
          </Link>
          {/*
           * In the footer, on every page — including the ones where no
           * advert ever appears. Consent that is harder to withdraw than
           * it was to give is not consent, and somebody who said yes on
           * an explainer should not have to find that explainer again.
           */}
          {adsEnabled && <AdConsentWithdrawLink onWithdraw={onWithdrawAdConsent} />}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="font-semibold text-paper">Company</span>
          <Link to="/casework-tracker" className="text-line">
            Casework Tracker
          </Link>
          <Link to="/packages" className="text-line">
            Packages
          </Link>
          <Link to="/whats-in-the-app" className="text-line">
            What Is in the App
          </Link>
          <a href={SITE.corporateUrl} className="text-line">
            innovationconsult.co.za
          </a>
          <Link to="/platform" className="text-line">
            Platform
          </Link>
          <Link to="/about" className="text-line">
            About
          </Link>
          <a href={SITE.appOrigin} className="text-line">
            Staff Sign-In
          </a>
        </div>
      </div>
      <div className="mx-auto max-w-[1200px] border-t border-teal px-6 pb-8 pt-4 text-site-micro">
        {SITE.bbbee}
      </div>
    </footer>
  );
}

/* --------------------------------------------------------- the page */

export function SiteShell({
  children,
  enquirySubject,
  onWithdrawAdConsent,
  adsEnabled,
}: {
  children: ReactNode;
  enquirySubject: string;
  onWithdrawAdConsent: () => void;
  adsEnabled: boolean;
}) {
  return (
    <div className="min-h-screen bg-paper font-body text-site-body text-ink">
      <VotingRibbon />
      <SiteHeader enquirySubject={enquirySubject} />
      <main>{children}</main>
      <SiteFooter onWithdrawAdConsent={onWithdrawAdConsent} adsEnabled={adsEnabled} />
    </div>
  );
}

/** The 1200px measure every section sits inside. */
export function SiteSection({
  children,
  className = '',
  id,
  labelledBy,
  label,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  labelledBy?: string;
  label?: string;
}) {
  return (
    <section id={id} aria-labelledby={labelledBy} aria-label={label} className={className}>
      <div className="mx-auto max-w-[1200px] px-6">{children}</div>
    </section>
  );
}

/* ------------------------------------------------------- primitives */

/**
 * A white card on paper.
 *
 * Deliberately the same radius and border weight as the application's
 * `Card`, so somebody who sees both does not read them as two products.
 */
export function SiteCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-[10px] border border-line bg-white ${className}`}>{children}</div>
  );
}

/** A small uppercase mono label above a heading. */
export function Eyebrow({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'gold' }) {
  return (
    <p
      className={`m-0 font-mono text-site-micro uppercase tracking-[0.08em] ${
        tone === 'gold' ? 'text-gold' : 'text-slate'
      }`}
    >
      {children}
    </p>
  );
}

/**
 * Built / roadmap.
 *
 * The word carries the status and the marker only repeats it, which is
 * the canvas's rule and rule 13's: colour alone tells a screen-reader
 * user nothing, and the two markers also differ in shape (filled disc
 * against a ring on a dashed border) for anyone who cannot separate the
 * hues.
 */
export function StatusBadge({ status }: { status: 'built' | 'roadmap' }) {
  const built = status === 'built';
  return (
    <span
      className={`inline-flex items-center gap-1.5 self-start rounded-full px-2.5 py-0.5 text-site-micro font-semibold text-ink ${
        built ? 'border border-green' : 'border border-dashed border-maroon'
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-2 w-2 rounded-full ${built ? 'bg-green' : 'border-2 border-maroon'}`}
      />
      {built ? 'Built' : 'Roadmap'}
    </span>
  );
}

/** The dark band that closes most pages. */
export function CtaBand({
  heading,
  note,
  children,
  headingId,
}: {
  heading: string;
  note?: string;
  children: ReactNode;
  headingId: string;
}) {
  return (
    <SiteSection labelledBy={headingId} className="py-[72px]">
      <div className="flex flex-wrap items-center justify-between gap-6 rounded-xl bg-ink p-10 text-paper">
        <div>
          <h2 id={headingId} className="m-0 font-site-display text-site-h3">
            {heading}
          </h2>
          {note && <p className="mb-0 mt-1.5 text-site-base text-line">{note}</p>}
        </div>
        <div className="flex flex-wrap gap-3">{children}</div>
      </div>
    </SiteSection>
  );
}

/** The WhatsApp glyph used on every primary call to action. */
export function WhatsAppIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="flex-none"
    >
      <path d="M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.6-5.2A8.5 8.5 0 1 1 21 12z" />
    </svg>
  );
}
