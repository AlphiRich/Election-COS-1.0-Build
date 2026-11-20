// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { WardMap } from './WardMap';
import { TIER_COLOR, wardTileUrl } from './wardMapData';
import { voterIntelligence } from './voterIntelligence';
import { tokens } from '@/design/tokens';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ward tile url and tier colours', () => {
  it('builds the per-council tile path (default same-origin base)', () => {
    expect(wardTileUrl('NW405')).toBe('/ward-boundaries/NW405.geojson');
  });
  it('maps every tier to a design token, never a raw colour', () => {
    const tokenValues = new Set<string>(Object.values(tokens.color));
    for (const c of Object.values(TIER_COLOR)) expect(tokenValues.has(c)).toBe(true);
    // Safe and Contested must read differently, or the map says nothing.
    expect(TIER_COLOR.Safe).not.toBe(TIER_COLOR.Contested);
  });
});

describe('WardMap component', () => {
  it('shows the tier legend and, with no Maps key configured, the honest unavailable state (never a broken frame)', async () => {
    const vi = await voterIntelligence('NW405');
    const el = document.createElement('div');
    document.body.appendChild(el);
    await act(async () => {
      createRoot(el).render(<WardMap vi={vi} />);
    });
    const t = el.textContent ?? '';
    expect(t).toContain('Ward map');
    for (const tier of Object.keys(TIER_COLOR)) expect(t).toContain(tier);
    expect(t).toContain('Municipal Demarcation Board');
    // No VITE_GOOGLE_MAPS_API_KEY in the test env → GoogleMapsWrapper renders its message, not a map.
    expect(t.toLowerCase()).toContain("map view isn't available".toLowerCase());
  });
});
