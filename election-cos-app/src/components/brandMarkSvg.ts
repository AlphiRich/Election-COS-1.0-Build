/**
 * The brand mark's colours and SVG source, shared by <BrandMark> and
 * scripts/build-icons.ts (see BrandMark.tsx for the mark itself).
 */
import { tokens } from '@/design/tokens';

/** The mark's four colours, all design tokens (the node square is `teal`). */
export const BRAND_MARK_COLOURS = {
  paper: tokens.color.paper,
  ink: tokens.color.ink,
  gold: tokens.color.gold,
  node: tokens.color.teal,
} as const;

const C = BRAND_MARK_COLOURS;

/** The mark's own shapes (no tile), in the -12 -23 154 154 coordinate box. */
export const BRAND_MARK_SHAPES = `<path d="M5 33V78H62V33 M5 33H20 M62 33H47" fill="none" stroke="${C.ink}" stroke-width="10"/>
<path d="M85.3 17H88.7V100H85.3Z M38 56.3H121V59.7H38Z" fill="${C.ink}"/>
<path d="M37 2L65 10L53 45H17Z" fill="${C.gold}"/>
<path d="M31 23L38 30L50 17" fill="none" stroke="${C.paper}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M77 50H97V70H77Z" fill="${C.node}"/>
<circle cx="87" cy="18" r="7.3" fill="${C.gold}"/>
<circle cx="87" cy="99" r="7.3" fill="${C.gold}"/>
<circle cx="121" cy="59" r="7.3" fill="${C.gold}"/>`;

/** The mark on its rounded paper tile, as a standalone SVG: public/icon.svg. */
export const BRAND_MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-12 -23 154 154" role="img" aria-label="Election-COS">
<rect x="-12" y="-23" width="154" height="154" rx="22" fill="${C.paper}"/>
${BRAND_MARK_SHAPES}
</svg>
`;

/**
 * The mark centred on a full-bleed paper square, for icons the platform
 * crops itself. `fill` is the share of the square the mark's width takes:
 * 0.7 for the Apple touch icon; 0.6 keeps the whole mark inside the
 * maskable safe zone (the central circle of 80 % diameter).
 */
export function brandMarkSquareSvg(px: number, fill: number): string {
  // The drawn mark spans x 0…128.3 and y 2…106.3 in its own coordinates.
  const scale = (px * fill) / 128.3;
  const tx = px / 2 - 64.15 * scale;
  const ty = px / 2 - 54.15 * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${px} ${px}" width="${px}" height="${px}">
<rect width="${px}" height="${px}" fill="${C.paper}"/>
<g transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${scale.toFixed(4)})">
${BRAND_MARK_SHAPES}
</g>
</svg>
`;
}
