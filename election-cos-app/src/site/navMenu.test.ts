import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SITE_NAV } from './siteContent';
import { MY_WARD_PATH, TRACKER_PATH } from './resultsPaths';
import { COALITION_PATH, SEATS_PATH } from './pages/SiteVoterTools';
import { FUNDING_CHECKER_PATH } from './pages/SiteFundingChecker';

const app = readFileSync(path.resolve(__dirname, 'SiteApp.tsx'), 'utf8');
const literal = new Set([...app.matchAll(/path="([^"]+)"/g)].map((m) => m[1]));
const served = new Set([...literal, TRACKER_PATH, MY_WARD_PATH, COALITION_PATH, SEATS_PATH, FUNDING_CHECKER_PATH]);

describe('the primary menu', () => {
  it('every link goes to a page the site serves', () => {
    for (const g of SITE_NAV) for (const i of g.items) expect(served.has(i.href), `${g.label} → ${i.href}`).toBe(true);
  });
  it('leads with the results, and no page appears twice', () => {
    expect(SITE_NAV[0].items.map((i) => i.href)).toEqual([TRACKER_PATH, MY_WARD_PATH, '/results']);
    const all = SITE_NAV.flatMap((g) => g.items.map((i) => i.href));
    expect(new Set(all).size).toBe(all.length);
  });
});
