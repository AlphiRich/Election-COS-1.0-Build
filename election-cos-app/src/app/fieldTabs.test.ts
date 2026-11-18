import { describe, expect, it } from 'vitest';
import { SEED_ROLES } from '@/auth/seedRoles';
import { FIELD_TABS, visibleFieldTabs } from './fieldTabs';
import { PRIMARY_NAV } from './nav';
import { router } from './routes';

const capsOf = (id: string) => SEED_ROLES.find((r) => r.id === id)!.defaultCaps;
const routePaths = (router.routes[0].children ?? []).map((r) => `/${r.path ?? ''}`);

describe('the phone tab bar', () => {
  it('leaves the nine-item nav alone (§3.2): tabs are shortcuts, and Menu still opens all nine', () => {
    expect(PRIMARY_NAV).toHaveLength(9);
    expect(FIELD_TABS.length).toBeLessThanOrEqual(4); // plus Menu: five fit a phone
  });

  it('only links to screens that exist', () => {
    for (const t of FIELD_TABS) expect(routePaths, t.route).toContain(t.route);
  });

  it('gates each tab on the same capability as the nav item for its screen', () => {
    for (const t of FIELD_TABS) {
      const nav = PRIMARY_NAV.find((n) => n.route === t.route);
      if (nav) expect(t.capability, t.route).toBe(nav.capability);
    }
  });

  it('shows a canvasser Today and Round, and no Wards tab they cannot open', () => {
    expect(visibleFieldTabs(capsOf('canvasser')).map((t) => t.label)).toEqual(['Today', 'Round']);
  });

  it('shows everyone Today', () => {
    for (const r of SEED_ROLES) expect(visibleFieldTabs(r.defaultCaps)[0]?.route, r.id).toBe('/today');
  });
});
