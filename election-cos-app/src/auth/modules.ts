/**
 * Election Campaign OS — the module catalogue
 * IC-ECOS-BUILD-2026-V2 §4.4 (adjacent to, and deliberately separate from,
 * the capability model).
 *
 * CAPABILITY IS NOT ENTITLEMENT
 *
 * `Capability` answers *may this user do this*. It says nothing about
 * *has this campaign bought this*. They are orthogonal and both are
 * needed: a Finance Officer can hold `ppfa.export` in a tenant that never
 * subscribed to the PPFA module, and a tenant can hold the module while
 * a particular user still has no business touching it.
 *
 * Until now only the first half existed. This is the second.
 *
 * NOT EVERY MODULE IS TENANT-WIDE — the thing most likely to be got wrong
 *
 * The commercial material prices Ward-Sentiment Intelligence per *ward*
 * per cycle and Incident-Management Pro per *party* per cycle, and the
 * positioning paper is explicit that à-la-carte ward buying "is the
 * market's buying behaviour, not a pricing convenience layered on top of
 * it" — South African parties buy their strongest-support wards, not full
 * municipal coverage. A model that assumed every entitlement was
 * tenant-wide would be wrong on its first real sale, so `scope` is part
 * of the module definition rather than an afterthought.
 *
 * NO PRICES LIVE HERE, OR ANYWHERE NEAR A TENANT RECORD
 *
 * The platform is sold to competing parties in the same municipality on
 * published, flat, identical terms, and the commercial material is
 * emphatic that packaging "must never create even the appearance that one
 * party gets better terms than a competing party". A price stored against
 * a tenant is exactly that appearance, whatever the number says. An
 * entitlement records **what was bought and until when** — never what it
 * cost. `entitlements.test.ts` fails if a price, rate or amount field
 * appears on the record.
 */
import type { Capability } from './types';

export type ModuleKey =
  | 'core'
  | 'campaign-diary'
  | 'ppfa-disclosure'
  | 'ward-sentiment'
  | 'incident-pro'
  | 'casework'
  | 'voter-verification';

export type EntitlementScope = 'TENANT' | 'WARD';

export interface ModuleDefinition {
  key: ModuleKey;
  label: string;
  /** TENANT-scoped is bought once; WARD-scoped is bought per ward. */
  scope: EntitlementScope;
  /** Included in every subscription — never needs an entitlement record. */
  bundled: boolean;
  /**
   * Capabilities this module gates. A capability listed here is inert
   * unless the module is active for the tenant (and ward, where the
   * module is ward-scoped).
   *
   * Empty is a real and honest answer: a module can be defined and sold
   * before its surfaces exist here, and declaring the entitlement first is
   * the right order. `incident-pro` gates out-of-band escalation and
   * `ward-sentiment` gates NLP trend analysis — neither is built yet, so
   * neither gates anything today, and listing a capability they do not
   * actually govern would be a claim rather than a fact.
   */
  gatedCapabilities: Capability[];
  /**
   * How the module is charged. Absent means a flat subscription. 'PER_USE'
   * means each verification or capture is counted as a usage event and
   * invoiced from the count on the platform's published, identical terms.
   * The module still needs an entitlement (the campaign has switched it
   * on); the entitlement carries no price and neither do the events.
   */
  metering?: 'PER_USE';
  description: string;
}

export const MODULES: ModuleDefinition[] = [
  {
    key: 'core',
    label: 'Core Campaign Platform',
    scope: 'TENANT',
    bundled: true,
    gatedCapabilities: [],
    description:
      'The voter roll, wards, households, incidents, logistics, war room and settings. Always on — a subscription that did not include these would not be a subscription.',
  },
  {
    key: 'campaign-diary',
    label: 'Campaign Diary & IEC Timetable',
    scope: 'TENANT',
    bundled: true,
    gatedCapabilities: ['diary.view', 'diary.edit'],
    description:
      'Shared calendar for canvassing shifts and rally dates, alongside the published IEC timetable. Bundled at no charge — its marginal cost to serve is close to zero because it reads ward and tenant data the platform already holds. A scheduling tool, not a compliance tool: it does not track gatherings permits.',
  },
  {
    key: 'ppfa-disclosure',
    label: 'PPFA Disclosure',
    scope: 'TENANT',
    bundled: false,
    gatedCapabilities: ['ppfa.view', 'ppfa.edit', 'ppfa.export', 'ppfa.manage_thresholds'],
    description:
      'Donor ledger, threshold tracking and disclosure exports. An aggregation aid — it never blocks a donation and never files with the Electoral Commission.',
  },
  {
    key: 'ward-sentiment',
    label: 'Ward Sentiment Intelligence',
    scope: 'WARD',
    bundled: false,
    gatedCapabilities: [],
    description:
      'Per-ward social and keyword trend analysis. Bought ward by ward. Not built here yet — the entitlement exists ahead of the surface.',
  },
  {
    key: 'incident-pro',
    label: 'Incident Management Pro',
    scope: 'TENANT',
    bundled: false,
    gatedCapabilities: [],
    description:
      'Out-of-band escalation for critical incidents — reaching a named human by message with a fallback channel. Separately metered so that per-message costs sit with the parties that generate them rather than being spread across every ward licence. Not built here yet.',
  },
  {
    key: 'casework',
    label: 'Councillor Casework',
    scope: 'WARD',
    bundled: false,
    gatedCapabilities: [],
    description:
      'Post-election constituency casework, bought per ward. Not built here yet.',
  },
  {
    key: 'voter-verification',
    label: 'Voter Verification & Capture',
    scope: 'TENANT',
    bundled: false,
    metering: 'PER_USE',
    gatedCapabilities: ['roll.view', 'roll.capture'],
    description:
      'Lets canvassers check people against the certified voters\' roll for their own district and, with the voter\'s consent, capture them. Charged per verification and per capture, counted as they happen, so a party pays for the doors it actually works and for the day\'s statistics it reads.',
  },
];

const BY_KEY = new Map(MODULES.map((m) => [m.key, m]));

export function moduleDefinition(key: ModuleKey): ModuleDefinition {
  const found = BY_KEY.get(key);
  if (!found) throw new Error(`Unknown module: ${key}`);
  return found;
}

/**
 * The module gating a capability, or null when nothing does.
 *
 * Most capabilities are ungated — they belong to the core platform, and a
 * capability nobody sells separately should not need an entitlement to
 * work. Returning null for those is the common and correct case.
 */
export function gatingModule(capability: Capability): ModuleDefinition | null {
  return MODULES.find((m) => m.gatedCapabilities.includes(capability)) ?? null;
}
