/**
 * Election Campaign OS — the survey invitation: a dialog on the landing page, never a wall.
 * Appears once per browser after a few seconds; Esc, "Not now" and a click outside all close it, and the choice is
 * remembered. It says plainly what the form is, where the answers go and when consent is asked. No sound, no autoplay.
 */
import { useEffect, useRef, useState } from 'react';
import { PromoPlayer } from './PromoPlayer';
import { SURVEY_DELAY_MS, SURVEY_URL, rememberDismissal, wasDismissed } from './surveyInvite';

export function SurveyInvite({ url = SURVEY_URL, delayMs = SURVEY_DELAY_MS }: { url?: string | null; delayMs?: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    if (!url || wasDismissed()) return;
    const t = window.setTimeout(() => {
      opener.current = document.activeElement;
      setOpen(true);
    }, delayMs);
    return () => window.clearTimeout(t);
  }, [url, delayMs]);

  const close = () => {
    rememberDismissal();
    setOpen(false);
    (opener.current as HTMLElement | null)?.focus?.();
  };

  useEffect(() => {
    if (!open) return;
    ref.current?.querySelector<HTMLElement>('a,button')?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'Tab' && ref.current) {
        const f = [...ref.current.querySelectorAll<HTMLElement>('a[href],button,video[controls]')];
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [open]);

  if (!url || !open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/60 p-3 sm:items-center" onClick={close}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="survey-invite-title"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-[14px] bg-paper p-5 shadow-xl"
      >
        <h2 id="survey-invite-title" className="m-0 font-site-display text-site-h3 text-ink">Share Your Ward&rsquo;s Priorities</h2>
        <p className="mt-2 text-site-base text-ink">
          A short post-election survey on voting, service delivery and governance: 15 questions, about four minutes.
        </p>
        <PromoPlayer id="landing-survey" className="mt-3" />
        <p className="mt-3 text-site-sm text-slate">
          It opens in Google Forms, so Google stores the answers. We ask for your email, municipality and ward. Your consent is
          asked at the bottom of the form, before anything is recorded. We do not sell personal information (POPIA), and you
          can ask for your records to be suppressed at electioncos.co.za/contact.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a href={url} target="_blank" rel="noopener noreferrer" onClick={() => rememberDismissal()} className="site-btn-primary">
            Take the survey
          </a>
          <button type="button" onClick={close} className="site-btn-outline-ink">
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
