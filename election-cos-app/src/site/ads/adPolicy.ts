/**
 * Election Campaign OS — where an advert may appear, and where it may not
 *
 * The instruction this implements, in full: "Consent-gated adverts on
 * explainer pages only, with political and election advertising
 * categories blocked."
 *
 * Every clause of that is a separate control, and two of them this
 * repository can enforce absolutely while one of them it cannot. Being
 * precise about which is which is the point of this file.
 *
 * WHAT THIS CODE ENFORCES, ABSOLUTELY
 *
 *  1. **Explainer pages only.** `adDecision` returns `false` for every
 *     path that is not in `AD_ELIGIBLE_PATHS`. The slot renders nothing
 *     and no network request is made, so a non-explainer page does not
 *     merely hide an advert — it never fetches one.
 *  2. **Consent first.** No ad script is injected, and no ad network is
 *     contacted, until a visitor has actively consented. Refusing and
 *     ignoring the banner are the same outcome: no advert. This is the
 *     opt-in that POPIA s 69 and the ordinary cookie-consent position
 *     both point at, and it is the default rather than the fallback.
 *  3. **Never inside the application.** The ad code lives under
 *     `src/site/**`, which is built by `vite.site.config.ts` into
 *     `dist-site/` and served from a different origin than the
 *     application. `adPolicy.test.ts` fails if any ad identifier appears
 *     outside `src/site/ads/**`, so this cannot be undone by a later
 *     edit that "just adds a slot" to a war-room screen.
 *
 * WHAT THIS CODE CANNOT ENFORCE, STATED PLAINLY
 *
 * **Category blocking is an ad-network account setting, not a tag
 * parameter.** Google's blocking controls for sensitive categories —
 * which is where "Politics" and the election-related categories live —
 * are configured in the AdSense or Ad Manager console against the
 * publisher account. No attribute on the script tag turns them off or
 * on, and any code claiming to do it would be decorative.
 *
 * So `REQUIRED_BLOCKED_CATEGORIES` is a specification of the account
 * configuration that must be in place before `AD_CLIENT_ID` is ever
 * filled in, and `docs/asset-control-sheet.md` §42 records it as an
 * owner action. The honest summary is: this repository guarantees that
 * adverts appear only on explainer pages and only after consent, and it
 * records — but cannot itself apply — the category blocks.
 *
 * WHAT IS REQUESTED ON EVERY SLOT
 *
 * Non-personalised ads. `requestNonPersonalizedAds` suppresses the
 * behavioural profiling half of the product entirely. Contextual
 * advertising against an article about the Political Party Funding Act
 * is an ordinary commercial transaction; building a behavioural profile
 * of somebody reading about election law, on a site run by an elections
 * software vendor, is not something this product should do to a reader
 * whatever the consent banner says.
 */

import { resolveAdClientId, resolveAdSlotId } from './adConfig';
import { COUNCIL_AD_CODES } from './councilAdPages';

/** Bumped when the wording changes; a stored consent below this is void. */
export const AD_CONSENT_VERSION = 2;

/**
 * The publisher id. `null` unless BOTH build variables are set — see
 * `adConfig.ts` for why there are two and why the second is a statement
 * rather than a control.
 *
 * `adDecision` refuses while this is null. A half-configured account is
 * the one state in which the category blocks might not be in force, so the
 * code declines to run at all rather than serve uncategorised inventory.
 */
export const AD_CLIENT_ID: string | null = resolveAdClientId(
  import.meta.env.VITE_AD_CLIENT_ID as string | undefined,
  import.meta.env.VITE_AD_CATEGORY_BLOCKS_CONFIRMED as string | undefined,
);

/** The numeric AdSense ad-unit id. See `resolveAdSlotId` for why it is not a name. */
export const AD_SLOT_ID: string | null = resolveAdSlotId(
  import.meta.env.VITE_AD_SLOT_ID as string | undefined,
);

/**
 * The explainer pages, and only these.
 *
 * Deliberately a literal allowlist rather than a prefix match. A prefix
 * would quietly extend advertising to every future page under
 * `/explainers/`, including ones nobody reviewed, and the review is the
 * control. Adding a page here is a decision somebody makes on purpose.
 */
export const AD_ELIGIBLE_PATHS: readonly string[] = [
  '/explainers',
  '/explainers/party-funding-thresholds',
  '/explainers/how-a-council-is-made-up',
  '/explainers/popia-and-voter-contact',
  // A free public tool with a written answer and sources. Added 31 Oct
  // 2026 when the site became useful to the public, not only to buyers.
  '/tools/party-funding-checker',
  // The certified 2026 results pages. Added 10 Nov 2026 by the owner's
  // decision to fund the site from advertising after the election. Counts and
  // names of elected office-bearers only; no form, no personal information
  // collected. The political categories below stay blocked, so no party's
  // advert sits beside a council's seats.
  '/coalitions',
  '/my-ward',
  // Lower case: normalisePath lower-cases before matching.
  ...COUNCIL_AD_CODES.map((c) => `/councils/${c.toLowerCase()}`),
];

/**
 * Pages that must never carry an advert, named rather than merely
 * omitted.
 *
 * Omission already excludes them — `adDecision` is an allowlist. These
 * are written out because each is a page where an advert would be a
 * specific wrong rather than merely off-policy, and a reviewer should
 * see the reasoning without reconstructing it:
 *
 *  - `/compliance` publishes the Capability and Limitations Statement.
 *    An advert beside a document whose entire purpose is to say what
 *    this product will not claim would undercut the document.
 *  - `/packages` publishes the one price list the neutrality pledge
 *    commits to. Paid placement next to it invites the question of who
 *    paid for position.
 *  - `/contact` collects personal information under an explicit consent.
 *    A third-party tag on a form page is how consent gets muddied.
 */
export const AD_FORBIDDEN_PATHS: readonly string[] = [
  '/',
  '/casework-tracker',
  '/compliance',
  '/packages',
  '/contact',
];

/**
 * The account configuration that must be in place before `AD_CLIENT_ID`
 * is filled in. Owner action — see the header.
 *
 * The first two are the instruction's own words. The rest are there
 * because an election-software site carries an obvious adjacency risk:
 * a reader of an explainer on party-funding law should not be shown a
 * campaign advert, an advocacy appeal, or a political donation solicit,
 * and "political" alone does not reliably cover all of those in a
 * network's taxonomy.
 */
export const REQUIRED_BLOCKED_CATEGORIES: readonly string[] = [
  'Politics',
  'Elections',
  'Political advocacy and issue campaigns',
  'Political fundraising and donation appeals',
  'Government and public administration services',
  'Religion and belief',
  'Gambling and betting',
];

export type AdRefusal =
  /** No consent recorded, consent refused, or a stale consent version. */
  | 'NO_CONSENT'
  /** This path is not an explainer page. */
  | 'PAGE_NOT_ELIGIBLE'
  /** No publisher account configured yet, so the category blocks cannot be assumed. */
  | 'NOT_CONFIGURED';

export interface AdDecision {
  /** Whether an ad network may be contacted for this slot, at all. */
  allowed: boolean;
  /** Why not. `null` when allowed. */
  refusal: AdRefusal | null;
}

export interface AdDecisionInput {
  pathname: string;
  /** True only when a visitor actively consented at the current version. */
  hasConsent: boolean;
  /** `AD_CLIENT_ID`; a parameter so the refusal is testable. */
  clientId?: string | null;
}

/**
 * May this page contact an ad network?
 *
 * Pure, allowlist-first, and it fails closed on every input it does not
 * recognise. The order of the checks is the order of the guarantees:
 * eligibility is a property of the page and is checked before anything
 * about the visitor, so a consented visitor on a war-room screen is
 * still refused.
 */
export function adDecision({
  pathname,
  hasConsent,
  clientId = AD_CLIENT_ID,
}: AdDecisionInput): AdDecision {
  // Trailing slashes and query strings must not be a way around the
  // allowlist: `/compliance/` and `/compliance?x=1` are `/compliance`.
  const path = normalisePath(pathname);

  if (!AD_ELIGIBLE_PATHS.includes(path)) {
    return { allowed: false, refusal: 'PAGE_NOT_ELIGIBLE' };
  }
  if (!hasConsent) {
    return { allowed: false, refusal: 'NO_CONSENT' };
  }
  if (!clientId) {
    return { allowed: false, refusal: 'NOT_CONFIGURED' };
  }
  return { allowed: true, refusal: null };
}

/**
 * Should the banner ask? Only where a "yes" would actually result in an
 * advert: an eligible page AND a configured account.
 *
 * The first draft probed `adDecision` with a dummy client id so the banner
 * showed even when advertising was not configured — and so told every
 * visitor to an explainer "we show adverts on our pages" while none were
 * ever served. Asking for consent to something that is not happening is a
 * false statement to the public, and it trains people to dismiss the
 * banner that will one day be real.
 */
export function shouldAskConsent(pathname: string, clientId: string | null = AD_CLIENT_ID): boolean {
  return adDecision({ pathname, hasConsent: true, clientId }).allowed;
}

/** `/explainers/`, `/explainers?utm=x` and `/EXPLAINERS` all normalise. */
export function normalisePath(pathname: string): string {
  const withoutQuery = pathname.split(/[?#]/)[0];
  const lowered = withoutQuery.toLowerCase();
  if (lowered.length > 1 && lowered.endsWith('/')) return lowered.slice(0, -1);
  return lowered;
}
