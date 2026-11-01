/**
 * Election Campaign OS — the domain estate
 *
 * ONE REGISTRY for every public hostname Innovation Consult serves, which
 * platform serves it, and the rules a new one must obey. The company
 * website, each application and each Agentic / Generative AI product line
 * get their own subdomain of the corporate zone; this is where they are
 * written down, so a guard test can fail when one is wrong instead of a
 * campaign finding out from a dead link.
 *
 * ARRANGEMENT (decided 1 Nov 2026)
 *   - `innovationconsult.co.za` is on Cloudflare. EVERY hostname below is
 *     proxied through it: DNS, TLS, WAF, rate limits.
 *   - The company website is hosted on Google Cloud Platform OR Cloudflare.
 *     Which is not yet decided, so it is recorded as UNDECIDED, not guessed.
 *   - Applications run on Firebase Hosting behind the Cloudflare proxy.
 *   - The company website is the acquisition and conversion instrument:
 *     "Book a demo", and research reports on named customer pain points.
 *
 * NO PRODUCT SUBDOMAIN IS INVENTED HERE
 * The product lines have not been named to this build. `proposeSubdomain`
 * checks a candidate name against the rules; it does not make one up.
 * Entries are added when a name is decided, with their platform.
 *
 * THE ONE ISOLATION RULE THAT MUST SURVIVE EVERY CHANGE
 * Pages that carry advertising (the public voter-tools site) must never
 * share an origin with campaign data (the war-room application). A
 * subdomain is a different origin; a path is not. See
 * `src/site/ads/adPolicy.ts`, point 3.
 */
import { APP_DOMAIN, CORPORATE_DOMAIN, SITE_DOMAIN, SUPERSEDED_DOMAINS } from './publicDomain';

export type Platform = 'FIREBASE_HOSTING' | 'CLOUDFLARE' | 'GCP' | 'UNDECIDED_GCP_OR_CLOUDFLARE';
export type Role = 'COMPANY_SITE' | 'PUBLIC_SITE' | 'APP' | 'API';
export type Status = 'CONFIGURED' | 'PLANNED';

export interface EstateEntry {
  host: string;
  role: Role;
  platform: Platform;
  /** Always true: nothing is served around Cloudflare. Kept as a field so a test can refuse a false. */
  cloudflareProxied: boolean;
  /** Carries third-party advertising code. */
  carriesAds: boolean;
  /** Reads or writes campaign data. */
  handlesCampaignData: boolean;
  status: Status;
}

export const ESTATE: EstateEntry[] = [
  {
    host: CORPORATE_DOMAIN,
    role: 'COMPANY_SITE',
    platform: 'UNDECIDED_GCP_OR_CLOUDFLARE',
    cloudflareProxied: true,
    carriesAds: false,
    handlesCampaignData: false,
    status: 'PLANNED',
  },
  {
    host: SITE_DOMAIN,
    role: 'PUBLIC_SITE',
    platform: 'CLOUDFLARE',
    cloudflareProxied: true,
    carriesAds: true,
    handlesCampaignData: false,
    status: 'CONFIGURED',
  },
  {
    host: APP_DOMAIN,
    role: 'APP',
    platform: 'FIREBASE_HOSTING',
    cloudflareProxied: true,
    carriesAds: false,
    handlesCampaignData: true,
    status: 'CONFIGURED',
  },
];

/** Zones Innovation Consult controls. A hostname outside these is not ours to list. */
export const ZONES = [CORPORATE_DOMAIN, SITE_DOMAIN] as const;

/** Labels that may not be a product or service subdomain. */
export const RESERVED_LABELS = [
  'www',
  'mail',
  'smtp',
  'imap',
  'ftp',
  'admin',
  'root',
  'ns1',
  'ns2',
  'autodiscover',
  'cpanel',
  'webmail',
  'api',
  'status',
  'staging',
  'test',
  'dev',
] as const;

export interface SubdomainCheck {
  ok: boolean;
  host: string;
  problems: string[];
}

/**
 * Is `label` an acceptable subdomain of the corporate zone for a new
 * service or product line? Checks syntax and collisions; chooses nothing.
 */
export function proposeSubdomain(
  label: string,
  taken: string[] = ESTATE.map((e) => e.host),
): SubdomainCheck {
  const l = label.trim().toLowerCase();
  const host = `${l}.${CORPORATE_DOMAIN}`;
  const problems: string[] = [];
  if (!/^[a-z0-9]([a-z0-9-]{0,28}[a-z0-9])?$/.test(l)) {
    problems.push(
      'Use 1–30 lowercase letters, digits or hyphens, not starting or ending with a hyphen.',
    );
  }
  if ((RESERVED_LABELS as readonly string[]).includes(l)) {
    problems.push(`"${l}" is reserved (mail, DNS and infrastructure names).`);
  }
  if (taken.includes(host)) problems.push(`${host} is already in the estate.`);
  if ((SUPERSEDED_DOMAINS as readonly string[]).includes(host)) {
    problems.push(`${host} is a superseded name and must not come back.`);
  }
  // A party or candidate name in a hostname would put a political
  // identifier in a certificate-transparency log and on printed material.
  if (/(anc|da-?party|eff|mk-?party|ifp|actionsa|pa-?party)/.test(l) && l.length <= 12) {
    problems.push(
      'Do not put a party name in a hostname: the platform is neutral between parties.',
    );
  }
  return { ok: problems.length === 0, host, problems };
}

/** Origins allowed to POST an enquiry to the site's enquiry endpoint. */
export function enquiryOrigins(): string[] {
  return ESTATE.filter((e) => e.role === 'COMPANY_SITE' || e.role === 'PUBLIC_SITE').map(
    (e) => `https://${e.host}`,
  );
}
