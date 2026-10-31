/**
 * Election Campaign OS — turning advertising on, as configuration
 *
 * Until now the only way to enable adverts was to edit a constant in
 * `adPolicy.ts`, which a test deliberately fails on. That made "switch it
 * on" a code change and a test change, which is the wrong shape for a
 * decision that belongs to the account owner. It is now two build
 * variables, and BOTH are required:
 *
 *   VITE_AD_CLIENT_ID                        the AdSense publisher id
 *   VITE_AD_CATEGORY_BLOCKS_CONFIRMED=true   the owner's statement that the
 *                                            category blocks listed in
 *                                            `REQUIRED_BLOCKED_CATEGORIES`
 *                                            are applied in the console
 *
 * The second is not a technical control. Nothing in this repository can
 * see the ad-network console. It exists so that enabling adverts requires
 * somebody to type a sentence that says the thing the directive requires —
 * "political and election advertising categories blocked" — instead of
 * that being possible to forget. An id on its own resolves to `null`.
 *
 * No `import.meta` here, deliberately: `vite.site.config.ts` imports this
 * file to emit `ads.txt`, and a config file has no `import.meta.env`.
 */

/** AdSense publisher ids are `ca-pub-` and then digits. Anything else is refused. */
const PUBLISHER_ID = /^ca-pub-\d{10,20}$/;

/**
 * The client id to use, or `null`. Fails closed on every input it does not
 * recognise, including a well-formed id with no confirmation.
 */
export function resolveAdClientId(
  clientId: string | undefined,
  blocksConfirmed: string | undefined,
): string | null {
  if (blocksConfirmed !== 'true') return null;
  if (!clientId || !PUBLISHER_ID.test(clientId.trim())) return null;
  return clientId.trim();
}

/**
 * The AdSense ad-unit id: a NUMERIC id created in the console, not a name.
 *
 * The first draft passed the explainer's slug ("party-funding-thresholds")
 * as `data-ad-slot`. AdSense does not look up units by name, so a fully
 * approved account would have rendered an empty box and nobody would have
 * known why. `null` means no unit is configured, and the slot then
 * renders nothing and loads nothing.
 */
export function resolveAdSlotId(slotId: string | undefined): string | null {
  const v = slotId?.trim();
  return v && /^\d{6,15}$/.test(v) ? v : null;
}

/**
 * The body of `/ads.txt`. AdSense requires it at the site root and, without
 * it, serves less or nothing. `f08c47fec0942fa0` is Google's certification
 * authority id for the `DIRECT` relationship.
 *
 * `null` when advertising is not configured, so no `ads.txt` is emitted and
 * the site does not publish a claim to sell inventory it is not selling.
 */
export function adsTxtFor(clientId: string | null): string | null {
  if (!clientId) return null;
  return `google.com, ${clientId.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n`;
}
