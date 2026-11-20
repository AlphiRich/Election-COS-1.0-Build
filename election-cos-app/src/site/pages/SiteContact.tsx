/**
 * Election Campaign OS — public site, Contact (`/contact`)
 *
 * From the canvas artboard `Contact.dc.html`, 1280×1900, fluid.
 *
 * HOW A REQUEST REACHES US
 *
 * With the enquiry service configured (`enquiryClient.ts`), the form posts
 * to `submitEnquiry` behind a Turnstile check. Without it, the form never
 * shows a thank-you for a request that went nowhere (the
 * `CanvassingIntake` mistake from §37.10): it writes the request out and
 * hands it to the visitor's own email app or WhatsApp to send
 * (`enquiryHandoff.ts`). Either way a submitted request reaches a person.
 *
 * WHAT THE FORM REFUSES TO COLLECT
 *
 * The message field carries the canvas's own warning: no party, no
 * political views, no voter's details. Political opinion is special
 * personal information under POPIA section 26, and a marketing enquiry
 * form is the last place that should be gathered. The warning is tied
 * to the field with `aria-describedby`, so it is announced rather than
 * merely printed next to it.
 *
 * Consent is a real checkbox, required, with its wording version
 * recorded — the same discipline `Voter.popiaConsentMethod` applies in
 * the application, for the same reason: the burden of showing consent
 * was given sits with the responsible party.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CONSENT_VERSION,
  CONTACT_INTERESTS,
  CONTACT_ROLES,
  MESSAGE_WARNING,
  SITE,
  whatsAppHref,
} from '../siteContent';
import { Eyebrow, SiteCard, SiteSection, WhatsAppIcon } from '../SiteChrome';
import whatsAppQr from '../assets/whatsapp-qr.svg';
import {
  enquiryConfig,
  enquiryPayload,
  mountTurnstile,
  sendEnquiry,
} from '../enquiryClient';
import { handoff, type Handoff } from '../enquiryHandoff';

const CONFIG = enquiryConfig(import.meta.env as Record<string, string | undefined>);
const DEMO = 'Book a Demo';

function Field({
  id,
  label,
  required,
  children,
  hint,
}: {
  id: string;
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-site-sm font-semibold">
        {label}{' '}
        <span className="font-normal text-slate">({required ? 'required' : 'optional'})</span>
      </label>
      {children}
      {hint && <span className="text-site-micro text-slate">{hint}</span>}
    </div>
  );
}

export function SiteContact({ variant = 'contact' }: { variant?: 'contact' | 'demo' }) {
  const demo = variant === 'demo';
  const [params] = useSearchParams();
  // A link from the Research page can pre-select a report request. Only a
  // known interest or a well-formed report slug is honoured; anything else
  // in the URL is ignored, never rendered.
  const asked = params.get('interest') ?? '';
  const askedOk = /^report:[a-z0-9-]{1,60}$/.test(asked) || CONTACT_INTERESTS.includes(asked);
  const startInterest = demo ? DEMO : askedOk ? asked : CONTACT_INTERESTS[0];
  const [sent, setSent] = useState(false);
  const [ready, setReady] = useState<Handoff | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const widget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!CONFIG || sent || !widget.current) return;
    return mountTurnstile(widget.current, CONFIG.siteKey, setToken);
  }, [sent]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!CONFIG) {
      // No enquiry service on this deployment: hand the written-out request to the visitor's email or WhatsApp.
      setReady(handoff(new FormData(e.currentTarget), demo, CONSENT_VERSION));
      return;
    }
    if (!token) {
      setError('Please wait for the security check to finish, then send again.');
      return;
    }
    setBusy(true);
    const r = await sendEnquiry(CONFIG, enquiryPayload(new FormData(e.currentTarget), CONSENT_VERSION, token));
    setBusy(false);
    if (r.ok) setSent(true);
    else setError(r.message);
  }

  return (
    <>
      <SiteSection className="flex flex-col gap-4 pb-10 pt-[88px]">
        <Eyebrow>{demo ? 'Demo' : 'Contact'}</Eyebrow>
        <h1 className="m-0 font-site-display text-site-h3 md:text-site-h1">
          {demo ? 'Book a Demo' : 'Talk to Us'}
        </h1>
        <p className="m-0 max-w-[36em] text-site-lead">
          {demo
            ? 'See the platform on invented data, for your role and your wards. Tell us when suits you; we reply within one working day to confirm.'
            : 'Tell us your role and your wards. We reply within one working day.'}
        </p>
        {demo && (
          <div className="mt-4 grid max-w-[60em] grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-5">
            <SiteCard className="p-6">
              <h2 className="m-0 font-site-display text-site-h4">What Happens Next</h2>
              <ol className="mb-0 mt-3 flex list-decimal flex-col gap-2 pl-5">
                <li>You send the request below, by email or WhatsApp.</li>
                <li>We reply within one working day to confirm a time that suits you.</li>
                <li>We walk through the platform on invented data, showing the screens your role and your wards would use.</li>
              </ol>
            </SiteCard>
            <SiteCard className="p-6">
              <h2 className="m-0 font-site-display text-site-h4">Before the Demo</h2>
              <ul className="mb-0 mt-3 flex list-disc flex-col gap-2 pl-5">
                <li>
                  See every module and what it does: <Link to="/whats-in-the-app">What&rsquo;s in the App</Link>.
                </li>
                <li>
                  Compare the packages and their prices: <Link to="/packages">Packages</Link>.
                </li>
                <li>
                  Try the public tools now, no account needed: <Link to="/tools">Voter Tools</Link>.
                </li>
              </ul>
            </SiteCard>
          </div>
        )}
      </SiteSection>

      <SiteSection className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] items-start gap-10 pb-[88px]">
        {/* ------------------------------------------------- the form */}
        <SiteCard className="p-8">
          {ready ? (
            <div className="flex flex-col gap-4">
              <h2 className="m-0 font-site-display text-site-h4">Your Request Is Ready to Send</h2>
              <p className="m-0">
                This page does not send it for you. Choose email or WhatsApp: your request opens there, already written
                out, for you to send. We reply within one working day.
              </p>
              <div className="flex flex-wrap gap-3">
                <a href={ready.mailto} className="site-btn-primary">
                  Send by Email
                </a>
                <a href={ready.whatsApp} target="_blank" rel="noopener noreferrer" className="site-btn-outline-ink">
                  <WhatsAppIcon />
                  Send on WhatsApp
                </a>
              </div>
              <details>
                <summary className="cursor-pointer text-site-sm font-semibold">What will be sent</summary>
                <pre className="mt-2 whitespace-pre-wrap rounded-md border border-line bg-paper p-3 font-body text-site-sm">
                  {ready.body}
                </pre>
              </details>
              <button type="button" onClick={() => setReady(null)} className="site-btn-outline-ink self-start">
                Back to the form
              </button>
            </div>
          ) : sent ? (
            <div className="flex flex-col gap-4">
              <h2 className="m-0 font-site-display text-site-h4">
                Thank You. We Have Your Enquiry.
              </h2>
              {CONFIG ? (
                <p className="m-0">
                  We will reply within one working day. For something urgent, message us on
                  WhatsApp.
                </p>
              ) : (
                <>
                  <p className="m-0">
                    This is the confirmation the design specifies. Nothing has been sent: the
                    enquiry service is not switched on for this deployment yet, and a form that
                    said otherwise would be telling you something untrue.
                  </p>
                  <p className="m-0">
                    To reach somebody now, use WhatsApp or email{' '}
                    <a href={`mailto:${SITE.mailboxes[0].address}`}>{SITE.mailboxes[0].address}</a>.
                  </p>
                </>
              )}
              <button
                type="button"
                onClick={() => setSent(false)}
                className="site-btn-outline-ink self-start"
              >
                Back to the form
              </button>
            </div>
          ) : (
            <form
              className="flex flex-col gap-5"
              onSubmit={onSubmit}
            >
              <h2 className="m-0 font-site-display text-site-h4">
                {demo ? 'Your Demo Request' : 'Your Enquiry'}
              </h2>
              {/* Honeypot: hidden from people and from assistive technology. */}
              <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                <label>
                  Leave This Empty
                  <input type="text" name="website" tabIndex={-1} autoComplete="off" />
                </label>
              </div>

              <Field id="f-name" label="Name" required>
                <input id="f-name" name="name" type="text" required className="site-field" />
              </Field>

              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-5">
                <Field id="f-mobile" label="Mobile">
                  <input id="f-mobile" name="mobile" type="tel" className="site-field" />
                </Field>
                <Field id="f-email" label="Email">
                  <input id="f-email" name="email" type="email" className="site-field" />
                </Field>
              </div>
              <p className="m-0 text-site-caption text-slate">
                Give us at least one way to reach you: mobile or email.
              </p>

              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-5">
                <Field id="f-role" label="Your Role" required>
                  <select id="f-role" name="role" required defaultValue="" className="site-field">
                    <option value="">Choose one</option>
                    {CONTACT_ROLES.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </Field>
                <Field id="f-interest" label="Interested In" required>
                  <select
                    id="f-interest"
                    name="interest"
                    required
                    defaultValue={startInterest}
                    className="site-field"
                  >
                    {[DEMO, ...CONTACT_INTERESTS.filter((i) => i !== DEMO)].map((i) => (
                      <option key={i}>{i}</option>
                    ))}
                    {startInterest.startsWith('report:') && (
                      <option value={startInterest}>
                        Research report: {startInterest.slice(7).replace(/-/g, ' ')}
                      </option>
                    )}
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-5">
                <Field id="f-muni" label="Municipality">
                  <input id="f-muni" name="municipality" type="text" className="site-field" />
                </Field>
                <Field id="f-ward" label="Ward Number">
                  <input
                    id="f-ward"
                    name="ward"
                    type="text"
                    inputMode="numeric"
                    className="site-field"
                  />
                </Field>
              </div>
              <p className="m-0 text-site-caption text-slate">
                Needed for the Casework Tracker and ward packages.
              </p>

              {demo && (
                <Field id="f-window" label="When Suits You" hint="For example: weekday mornings, or after 17:00.">
                  <input id="f-window" name="demoWindow" type="text" maxLength={120} className="site-field" />
                </Field>
              )}

              <div className="flex flex-col gap-1.5">
                <label htmlFor="f-msg" className="text-site-sm font-semibold">
                  Message <span className="font-normal text-slate">(optional)</span>
                </label>
                <p
                  id="f-msg-warn"
                  className="m-0 flex items-start gap-2 text-site-sm text-ink"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    strokeWidth="2"
                    strokeLinecap="round"
                    aria-hidden="true"
                    className="mt-1 flex-none stroke-ink"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 8v5" />
                    <path d="M12 16h.01" />
                  </svg>
                  <span>{MESSAGE_WARNING}</span>
                </p>
                <textarea
                  id="f-msg"
                  name="message"
                  rows={5}
                  maxLength={1000}
                  aria-describedby="f-msg-warn"
                  className="site-field"
                />
                <span className="text-site-micro text-slate">Up to 1,000 characters</span>
              </div>

              <fieldset className="m-0 rounded-md border border-line p-4">
                <legend className="px-1.5 text-site-sm font-semibold">Consent</legend>
                <div className="flex flex-col gap-3">
                  <label className="flex cursor-pointer items-start gap-3 text-site-sm">
                    <input type="checkbox" name="consent" required className="mt-1" />
                    <span>
                      Innovation Consult may contact me about this enquiry.{' '}
                      <span className="text-slate">
                        (Required. Wording version {CONSENT_VERSION}.)
                      </span>
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-3 text-site-sm">
                    <input type="checkbox" name="marketing" className="mt-1" />
                    <span>
                      Send me occasional product updates.{' '}
                      <span className="text-slate">(Optional.)</span>
                    </span>
                  </label>
                </div>
              </fieldset>

              <div className="flex flex-wrap items-center justify-between gap-4">
                <span className="text-site-micro text-slate">
                  {CONFIG
                    ? 'Protected by a Cloudflare Turnstile check.'
                    : 'Next, you choose to send it by email or on WhatsApp.'}
                </span>
                <button type="submit" disabled={busy} className="site-btn-primary">
                  {busy ? 'Sending…' : CONFIG ? (demo ? 'Request a Demo' : 'Send Enquiry') : 'Prepare My Request'}
                </button>
              </div>
              {CONFIG && <div ref={widget} />}
              {error && (
                <p role="alert" className="m-0 text-site-sm font-semibold text-ink">
                  {error}
                </p>
              )}
            </form>
          )}
        </SiteCard>

        {/* ------------------------------------------------ other ways */}
        <div className="flex flex-col gap-5">
          <article className="flex flex-col gap-3 rounded-[10px] bg-ink p-8 text-paper">
            <h2 className="m-0 font-site-display text-site-h4">Faster: Message Us</h2>
            <p className="m-0 text-line">
              {SITE.whatsApp.role}: <strong>WhatsApp {SITE.whatsApp.display}</strong>. It reaches a person
              directly during working hours.
            </p>
            <img
              src={whatsAppQr}
              alt={`QR code for WhatsApp ${SITE.whatsApp.display}, the ${SITE.whatsApp.role.toLowerCase()}`}
              width={144}
              height={144}
              className="rounded bg-paper p-1.5"
            />
            <a href={whatsAppHref('Election Campaign OS enquiry')} className="site-btn-primary mt-auto self-start">
              <WhatsAppIcon />
              Talk to Us on WhatsApp
            </a>
          </article>

          <SiteCard className="flex flex-col gap-2 p-8">
            <h2 className="m-0 font-site-display text-site-h5">By Email</h2>
            {SITE.mailboxes.map((box) => (
              <p key={box.address} className="m-0 text-site-base">
                <a href={`mailto:${box.address}`}>{box.address}</a>
                <br />
                <span className="text-site-sm text-slate">{box.purpose}</span>
              </p>
            ))}
          </SiteCard>

          <SiteCard className="flex flex-col gap-2 p-8">
            <h2 className="m-0 font-site-display text-site-h5">Already a Customer?</h2>
            <p className="m-0 text-site-base">
              Sign in to the application at{' '}
              <a href={SITE.appOrigin}>app.electioncos.co.za</a>.
            </p>
          </SiteCard>
        </div>
      </SiteSection>
    </>
  );
}
