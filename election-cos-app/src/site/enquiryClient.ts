/**
 * Election Campaign OS — public site: sending an enquiry
 *
 * The form posts to the `submitEnquiry` Cloud Function, behind a Cloudflare
 * Turnstile check. Both addresses are build-time configuration, because the
 * function URL and the Turnstile site key are not known to the source:
 *
 *   VITE_ENQUIRY_URL           https://africa-south1-<project>.cloudfunctions.net/submitEnquiry
 *                              (or a Cloudflare-routed path on the site's own domain)
 *   VITE_TURNSTILE_SITE_KEY    the public Turnstile site key
 *
 * With either missing, `enquiryConfig` returns null and the page keeps
 * saying plainly that nothing was sent (it never shows a thank-you for a
 * form that went nowhere).
 */
export interface EnquiryConfig {
  url: string;
  siteKey: string;
}

export function enquiryConfig(env: Record<string, string | undefined>): EnquiryConfig | null {
  const url = env.VITE_ENQUIRY_URL?.trim();
  const siteKey = env.VITE_TURNSTILE_SITE_KEY?.trim();
  if (!url || !siteKey) return null;
  if (!/^https:\/\//.test(url)) return null; // never post an enquiry over plain HTTP
  return { url, siteKey };
}

/** The wire payload. Field names are those `functions/src/enquiry.ts` validates. */
export function enquiryPayload(fd: FormData, consentVersion: string, turnstileToken: string) {
  const s = (k: string) => {
    const v = fd.get(k);
    return typeof v === 'string' ? v : '';
  };
  return {
    name: s('name'),
    mobile: s('mobile'),
    email: s('email'),
    role: s('role'),
    interest: s('interest'),
    municipality: s('municipality'),
    ward: s('ward'),
    message: s('message'),
    demoWindow: s('demoWindow'),
    consent: fd.get('consent') === 'on',
    marketingOptIn: fd.get('marketing') === 'on',
    consentVersion,
    website: s('website'), // honeypot
    turnstileToken,
  };
}

export type SendResult = { ok: true } | { ok: false; message: string };

export async function sendEnquiry(
  cfg: EnquiryConfig,
  payload: ReturnType<typeof enquiryPayload>,
  fetchImpl: typeof fetch = fetch,
): Promise<SendResult> {
  try {
    const r = await fetchImpl(cfg.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; message?: string };
    if (r.ok && j.ok) return { ok: true };
    return {
      ok: false,
      message: j.message ?? 'Something went wrong. Please use WhatsApp instead.',
    };
  } catch {
    return { ok: false, message: 'We could not reach the server. Please use WhatsApp instead.' };
  }
}

/** Loads Cloudflare's Turnstile script once and renders a widget; returns a remover. */
export function mountTurnstile(
  el: HTMLElement,
  siteKey: string,
  onToken: (t: string | null) => void,
): () => void {
  type TS = {
    render: (e: HTMLElement, o: Record<string, unknown>) => string;
    remove: (id: string) => void;
  };
  const w = window as unknown as { turnstile?: TS };
  let id: string | null = null;
  let cancelled = false;
  const draw = () => {
    if (cancelled || !w.turnstile) return;
    id = w.turnstile.render(el, {
      sitekey: siteKey,
      callback: (t: string) => onToken(t),
      'expired-callback': () => onToken(null),
      'error-callback': () => onToken(null),
    });
  };
  if (w.turnstile) draw();
  else {
    const existing = document.querySelector<HTMLScriptElement>('script[data-turnstile]');
    const s = existing ?? document.createElement('script');
    if (!existing) {
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true;
      s.dataset.turnstile = '1';
      document.head.appendChild(s);
    }
    s.addEventListener('load', draw);
  }
  return () => {
    cancelled = true;
    if (id && w.turnstile) w.turnstile.remove(id);
  };
}
