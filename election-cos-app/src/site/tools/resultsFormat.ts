/**
 * Election Campaign OS — public site, formatting shared by the 2026 results pages.
 */
import { PROVINCES, type CouncilSeats } from '@/modules/lge2026/nationalResults';

export const nf = new Intl.NumberFormat('en-ZA');
export const provinceName = (p: CouncilSeats['province']): string => PROVINCES[p];
export const kindOf = (c: Pick<CouncilSeats, 'category'>): string => (c.category === 'A' ? 'Metro' : 'Local municipality');

/** "RABODIBA DAVID MALOGANYE" -> "Rabodiba David Maloganye"; keeps hyphenated and apostrophised parts. */
export function titleCase(s: string): string {
  return s.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase());
}
