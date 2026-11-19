/**
 * Election Campaign OS — second sign-in factor over WhatsApp
 * Owner's rule (session 54): staff above canvasser enter a one-time code.
 * "If the SMS approach is arduous then use WhatsApp; with the same number."
 *
 * @deployable fails-closed
 *
 * So this is the login code's delivery channel, reusing the SAME WhatsApp
 * Business credential as the membership OTP (WHATSAPP_API_TOKEN /
 * WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_GRAPH_VERSION from
 * membershipOtpDelivery) — one number, as asked. The template is its own:
 * a login code is an AUTHENTICATION-category template, whose body carries
 * the code as a parameter and whose button echoes it for one-tap copy.
 *
 * Without the credential this refuses by throwing `SmsNotConfigured` — the
 * error `requestSecondFactor` already understands as NOT_CONFIGURED — so
 * with no account configured, every role above canvasser stays locked out
 * (no silent downgrade), exactly as the SMS seam did.
 *
 * The code is NEVER logged. On a failed send only Meta's status and request
 * id are recorded; the response body can echo the recipient's number.
 */
import { defineString } from 'firebase-functions/params';
import { logger } from 'firebase-functions/v2';
import {
  DELIVERY_TIMEOUT_MS,
  WHATSAPP_API_TOKEN,
  WHATSAPP_GRAPH_VERSION,
  WHATSAPP_PHONE_NUMBER_ID,
} from './membershipOtpDelivery';
import { SmsNotConfigured, type SmsSender } from './secondFactor';

/** The approved AUTHENTICATION template for the login code. A template name is config, not a secret. */
export const SECOND_FACTOR_WHATSAPP_TEMPLATE = defineString('SECOND_FACTOR_WHATSAPP_TEMPLATE', {
  default: 'election_cos_login_code',
});
export const SECOND_FACTOR_WHATSAPP_LANG = defineString('SECOND_FACTOR_WHATSAPP_TEMPLATE_LANG', {
  default: 'en',
});

export interface WhatsAppConfig {
  token: string;
  phoneNumberId: string;
  template: string;
  lang: string;
  graphVersion: string;
}

/**
 * The Graph API message body for an authentication-category template: the
 * code once in the body, once on the one-tap/copy button (Meta requires the
 * button parameter to echo the code). Pure, so it is tested directly.
 */
export function buildAuthTemplateBody(toE164: string, code: string, template: string, lang: string) {
  return {
    messaging_product: 'whatsapp',
    to: toE164,
    type: 'template',
    template: {
      name: template,
      language: { code: lang },
      components: [
        { type: 'body', parameters: [{ type: 'text', text: code }] },
        { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
      ],
    },
  };
}

type FetchLike = (url: string, init: RequestInit) => Promise<{ ok: boolean; status: number; headers: { get(k: string): string | null }; json(): Promise<unknown> }>;

/**
 * Post one login code to WhatsApp. Returns whether Meta accepted it.
 * Throws `SmsNotConfigured` when the credential is absent (fail closed) —
 * never a send that did not happen reported as one.
 */
export async function postWhatsAppLoginCode(
  config: WhatsAppConfig,
  toE164: string,
  code: string,
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
): Promise<boolean> {
  if (!config.token || !config.phoneNumberId) throw new SmsNotConfigured();

  const url = `https://graph.facebook.com/${config.graphVersion}/${config.phoneNumberId}/messages`;
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(buildAuthTemplateBody(toE164, code, config.template, config.lang)),
    signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
  });

  if (!response.ok) {
    // Status and request id only — the body can echo the recipient's number, and the code must never land in a log.
    logger.error('WhatsApp login-code delivery failed', {
      status: response.status,
      requestId: response.headers.get('x-fb-request-id') ?? null,
    });
    return false;
  }
  const payload = (await response.json()) as { messages?: Array<{ id?: string }> };
  return Boolean(payload.messages?.[0]?.id);
}

/** True when the shared WhatsApp credential is present, so the callable can pick this channel over the unconfigured SMS seam. */
export function whatsAppConfigured(): boolean {
  return Boolean(WHATSAPP_API_TOKEN.value() && WHATSAPP_PHONE_NUMBER_ID.value());
}

/** The `SmsSender` the second-factor flow calls. Ignores the text `message`; the template carries the `code`. */
export const whatsAppSecondFactorSender: SmsSender = async (toE164, _message, code) =>
  postWhatsAppLoginCode(
    {
      token: WHATSAPP_API_TOKEN.value(),
      phoneNumberId: WHATSAPP_PHONE_NUMBER_ID.value(),
      template: SECOND_FACTOR_WHATSAPP_TEMPLATE.value(),
      lang: SECOND_FACTOR_WHATSAPP_LANG.value(),
      graphVersion: WHATSAPP_GRAPH_VERSION.value(),
    },
    toE164,
    code,
  );
