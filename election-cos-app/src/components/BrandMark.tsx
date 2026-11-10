/**
 * Election-COS brand mark: a ballot box with a gold ballot and a check,
 * joined to a small node network.
 *
 * The one mark for the public site, the application and every icon
 * (scripts/build-icons.mjs renders the favicon and PWA icons from
 * BRAND_MARK_SVG in brandMarkSvg.ts). It was supplied 31 Oct 2026 as the "Election-COS1.0" lockup
 * and is drawn here as vector so it stays crisp at the 24 px digital
 * minimum. Decorative: the product name beside it carries the meaning.
 *
 * A paper tile sits behind the mark so it reads on the Ink header as well
 * as on Paper; the tile is part of the mark's footprint, not extra chrome.
 */
import { BRAND_MARK_COLOURS as C } from './brandMarkSvg';

export function BrandMark({ size = 36, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="-12 -23 154 154"
      aria-hidden="true"
      className={`flex-none ${className}`.trim()}
    >
      <rect x="-12" y="-23" width="154" height="154" rx="22" fill={C.paper} />
      <path d="M5 33V78H62V33 M5 33H20 M62 33H47" fill="none" stroke={C.ink} strokeWidth="10" />
      <path d="M85.3 17H88.7V100H85.3Z M38 56.3H121V59.7H38Z" fill={C.ink} />
      <path d="M37 2L65 10L53 45H17Z" fill={C.gold} />
      <path
        d="M31 23L38 30L50 17"
        fill="none"
        stroke={C.paper}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M77 50H97V70H77Z" fill={C.node} />
      <circle cx="87" cy="18" r="7.3" fill={C.gold} />
      <circle cx="87" cy="99" r="7.3" fill={C.gold} />
      <circle cx="121" cy="59" r="7.3" fill={C.gold} />
    </svg>
  );
}
