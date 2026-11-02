/**
 * Election Campaign OS — public site: answering a poll.
 *
 * Build-time configuration, like the enquiry form:
 *   VITE_POLL_URL            https://africa-south1-<project>.cloudfunctions.net/poll
 *   VITE_TURNSTILE_SITE_KEY  the public Turnstile site key
 * With either missing, the page says plainly that polling is not switched on and sends nothing.
 *
 * The only things sent are the poll id, the chosen option, a channel tag, an optional ward code,
 * the notice acknowledgement, an optional single-use token and the Turnstile token. No name, no
 * number, no free text.
 */
export interface PollConfig {
  url: string;
  siteKey: string;
}

export function pollConfig(env: Record<string, string | undefined>): PollConfig | null {
  const url = env.VITE_POLL_URL?.trim();
  const siteKey = env.VITE_TURNSTILE_SITE_KEY?.trim();
  if (!url || !siteKey || !/^https:\/\//.test(url)) return null;
  return { url, siteKey };
}

export interface PublicPoll {
  open: boolean;
  question: string;
  options: string[];
  organiser: string;
  tokenMode: 'single' | 'open';
}

export type LoadResult = { ok: true; poll: PublicPoll } | { ok: false; message: string };

export async function loadPoll(
  cfg: PollConfig,
  pollId: string,
  f: typeof fetch = fetch,
): Promise<LoadResult> {
  try {
    const r = await f(`${cfg.url}?poll=${encodeURIComponent(pollId)}`);
    const j = (await r.json().catch(() => ({}))) as Partial<PublicPoll> & {
      ok?: boolean;
      message?: string;
    };
    if (r.ok && j.ok && j.question && Array.isArray(j.options)) {
      return {
        ok: true,
        poll: {
          open: j.open === true,
          question: j.question,
          options: j.options,
          organiser: j.organiser ?? '',
          tokenMode: j.tokenMode === 'single' ? 'single' : 'open',
        },
      };
    }
    return { ok: false, message: j.message ?? 'This poll could not be found.' };
  } catch {
    return { ok: false, message: 'We could not reach the server. Please try again later.' };
  }
}

export interface AnswerInput {
  pollId: string;
  option: string;
  channel: string;
  ward?: string;
  token?: string;
  consent: boolean;
  turnstileToken: string;
  website?: string;
}

export type SendResult = { ok: true } | { ok: false; message: string };

export async function sendAnswer(
  cfg: PollConfig,
  a: AnswerInput,
  f: typeof fetch = fetch,
): Promise<SendResult> {
  try {
    const r = await f(cfg.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(a),
    });
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; message?: string };
    return r.ok && j.ok
      ? { ok: true }
      : { ok: false, message: j.message ?? 'Your answer was not sent.' };
  } catch {
    return { ok: false, message: 'We could not reach the server. Your answer was not sent.' };
  }
}
