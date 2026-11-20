/**
 * Election Campaign OS — the phone tab bar
 *
 * OWNER DECISION, 18 Nov 2026 ("rebuild the mobile application", from the supplied ElectionCOS Mobile prototype). Session
 * 38 chose a drawer over a tab bar because §3.2 fixes the nav at nine items. That stays true: `PRIMARY_NAV` is unchanged and
 * the full menu is one tap away behind "Menu". The tab bar adds three shortcuts to the screens a person in the field opens
 * most, each gated on the same capability as its nav item, so nobody gets a tab to a screen their role cannot open.
 *
 * Phone widths only (`md:hidden` in the Shell). The desktop sidebar is untouched.
 */
import type { Capability } from '@/auth/types';
import type { TenantEntitlement } from '@/dal/ports/entitlements';
import { navItemAccess, type NavItem } from './nav';

export interface FieldTab extends NavItem {
  /** SVG path data, 24 x 24, drawn with a stroke. */
  icon: string;
}

export const FIELD_TABS: FieldTab[] = [
  { label: 'Today', route: '/today', capability: 'always', icon: 'M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z' },
  {
    label: 'Wards',
    route: '/wards',
    capability: 'wards.view',
    icon: 'M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11zM12 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
  },
  { label: 'Round', route: '/round', capability: 'voters.view', icon: 'M9 4h6v3H9zM9 5.5H6V21h12V5.5h-3M9 13l2 2 4-4' },
];

export const MENU_ICON = 'M4 6h16M4 12h16M4 18h16';

/** The tabs this person may open, in order. "Menu" is always added after them by the Shell. */
export function visibleFieldTabs(caps: Capability[], entitlements?: TenantEntitlement[]): FieldTab[] {
  return FIELD_TABS.filter((t) => navItemAccess(t, caps, entitlements).allowed);
}
