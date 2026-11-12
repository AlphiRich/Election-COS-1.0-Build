/**
 * Election Campaign OS — public site, voter poll (`/poll/:pollId`).
 *
 * The question and every option come from the poll itself, fetched at run time. This page's
 * source carries no party name, logo or colour: the site stays neutral, and the organiser who
 * wrote the poll is named on the page. Anonymous by design; see src/modules/polls/pollModel.ts.
 */
import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Eyebrow, SiteCard, SiteSection } from '../SiteChrome';
import { mountTurnstile } from '../enquiryClient';
import { loadPoll, pollConfig, sendAnswer, type PublicPoll } from '../pollClient';
import { CHANNELS, POLL_NOTICE_VERSION } from '@/modules/polls/pollModel';

const CONFIG = pollConfig(import.meta.env as Record<string, string | undefined>);
const label = (o: string) =>
  o === 'UNDECIDED' ? 'Undecided' : o === 'PREFER_NOT_TO_SAY' ? 'Prefer not to say' : o;
const doneKey = (id: string) => `ecos-poll-done:${id}`;

function alreadyAnswered(id: string): boolean {
  try {
    return localStorage.getItem(doneKey(id)) === '1';
  } catch {
    return false;
  }
}

export function SitePoll() {
  const { pollId = '' } = useParams();
  const [params] = useSearchParams();
  const channelParam = params.get('c') ?? '';
  const channel = (CHANNELS as readonly string[]).includes(channelParam) ? channelParam : 'website';
  const token = params.get('t') ?? undefined;

  const [poll, setPoll] = useState<PublicPoll | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [choice, setChoice] = useState('');
  const [consent, setConsent] = useState(false);
  const [ts, setTs] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(() => alreadyAnswered(pollId));
  const widget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!CONFIG) return;
    let live = true;
    loadPoll(CONFIG, pollId).then((r) => {
      if (!live) return;
      if (r.ok) setPoll(r.poll);
      else setLoadError(r.message);
    });
    return () => {
      live = false;
    };
  }, [pollId]);

  useEffect(() => {
    if (!CONFIG || !poll?.open || done || !widget.current) return;
    return mountTurnstile(widget.current, CONFIG.siteKey, setTs);
  }, [poll, done]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!CONFIG || !poll) return;
    if (!choice) return setError('Please choose an answer.');
    if (!consent) return setError('Please confirm that you have read the notice.');
    if (!ts) return setError('Please wait for the security check to finish, then send again.');
    setBusy(true);
    const honeypot = String(new FormData(e.currentTarget).get('website') ?? '');
    const r = await sendAnswer(CONFIG, {
      pollId,
      option: choice,
      channel,
      token,
      consent,
      turnstileToken: ts,
      website: honeypot,
    });
    setBusy(false);
    if (r.ok) {
      try {
        localStorage.setItem(doneKey(pollId), '1');
      } catch {
        /* a private window: the server still counts once per link where it matters */
      }
      setDone(true);
    } else setError(r.message);
  }

  return (
    <SiteSection className="pb-[88px] pt-[88px]">
      <div className="mx-auto flex max-w-[640px] flex-col gap-4">
        <Eyebrow>Poll</Eyebrow>
        {!CONFIG ? (
          <SiteCard className="p-8">
            <h1 className="m-0 font-site-display text-site-h4">Polling Is Not Switched on Yet.</h1>
            <p className="mb-0">Nothing you do on this page is sent anywhere.</p>
          </SiteCard>
        ) : loadError ? (
          <SiteCard className="p-8">
            <h1 className="m-0 font-site-display text-site-h4">This Poll Is Not Available.</h1>
            <p className="mb-0">{loadError}</p>
          </SiteCard>
        ) : !poll ? (
          <p>Loading…</p>
        ) : done ? (
          <SiteCard className="p-8">
            <h1 className="m-0 font-site-display text-site-h4">
              Thank You. Your Answer Is Counted.
            </h1>
            <p className="mb-0">It is anonymous: nothing links it to you.</p>
          </SiteCard>
        ) : !poll.open ? (
          <SiteCard className="p-8">
            <h1 className="m-0 font-site-display text-site-h4">This Poll Is Closed.</h1>
          </SiteCard>
        ) : (
          <SiteCard className="p-8">
            <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
              <h1 className="m-0 font-site-display text-site-h4">{poll.question}</h1>
              <p className="m-0 text-site-caption text-slate">
                Run by {poll.organiser}. Election Campaign OS does not take a side in any poll.
              </p>
              <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
                <legend className="sr-only">Your Answer</legend>
                {[...poll.options, 'UNDECIDED', 'PREFER_NOT_TO_SAY'].map((o) => (
                  <label key={o} className="flex min-h-[44px] items-center gap-3">
                    <input
                      type="radio"
                      name="option"
                      value={o}
                      checked={choice === o}
                      onChange={() => setChoice(o)}
                    />
                    {label(o)}
                  </label>
                ))}
              </fieldset>
              <label className="flex items-start gap-3 text-site-caption">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-1"
                />
                <span>
                  I understand that my answer is anonymous and is counted with others. No name,
                  number or ID is collected. Notice {POLL_NOTICE_VERSION}.
                </span>
              </label>
              <div aria-hidden className="absolute left-[-9999px]">
                <input type="text" name="website" tabIndex={-1} autoComplete="off" />
              </div>
              <div ref={widget} />
              {error && (
                <p role="alert" className="m-0 text-maroon">
                  {error}
                </p>
              )}
              <button type="submit" className="site-btn-primary self-start" disabled={busy}>
                {busy ? 'Sending…' : 'Send my answer'}
              </button>
            </form>
          </SiteCard>
        )}
      </div>
    </SiteSection>
  );
}
