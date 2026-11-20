/**
 * Ward-map constants, kept out of the component file so the component module only exports components (react-refresh).
 */
import { tokens } from '@/design/tokens';
import type { WardTier } from './voterIntelligence';

const C = tokens.color;

/** Tier → token colour. Safe (one-sided) through Contested (knife-edge). Design tokens only, never a party-brand hex. */
export const TIER_COLOR: Record<WardTier, string> = {
  Safe: C.green,
  Comfortable: C.teal,
  Marginal: C.gold,
  Contested: C.maroon,
};

const TILES_BASE = ((import.meta.env.VITE_WARD_TILES_BASE_URL as string | undefined) ?? '/ward-boundaries').replace(/\/$/, '');

/** Where a council's ward-boundary tile is served (scripts/ingest-ward-boundaries.ts output). */
export const wardTileUrl = (code: string): string => `${TILES_BASE}/${code}.geojson`;
