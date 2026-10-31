/**
 * Election Campaign OS — the public party-funding threshold checker
 *
 * A free tool for anyone: a donor, a journalist, a treasurer, a voter.
 * It compares ONE rand figure with the two lines in the current
 * proclamation and says where the figure sits. It runs in the browser;
 * nothing typed is sent anywhere or stored.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 *
 *  - It never says a donation is lawful, compliant, valid or permitted.
 *    It reports a position relative to a line. (Rule 3 of the build:
 *    this product does not give legal advice.)
 *  - It does not decide how donations are added together across a
 *    financial year. That aggregation question is open
 *    (`ppfaDefaults.ts`, §6.8.1 Q1/Q2), so the tool takes a total the
 *    visitor has already worked out and says so on the page.
 *
 * The figures are held to `ppfaDefaults.ts` by `fundingCheck.test.ts`,
 * the same way the site copy and the explainers are.
 */

/** R200,000, in cents. */
export const DISCLOSURE_LINE_CENTS = 200_000_00;
/** R30,000,000, in cents. */
export const ANNUAL_CAP_CENTS = 30_000_000_00;
/** The warning rung sits at 80% of the disclosure line (R160,000). */
export const WARNING_FRACTION = 0.8;

export type FundingBand =
  | 'BELOW_WARNING'
  | 'NEAR_DISCLOSURE'
  | 'AT_OR_ABOVE_DISCLOSURE'
  | 'ABOVE_ANNUAL_CAP';

export interface FundingResult {
  band: FundingBand;
  /** One neutral sentence. Never "compliant", "lawful" or "valid". */
  message: string;
  /** Cents to the next line up, or null when already above the cap. */
  centsToNextLine: number | null;
}

/**
 * Parse what a person types as a rand amount into integer cents.
 * Accepts "R184,500", "184 500.50", "R 1 000 000". Returns null for
 * anything that is not a non-negative amount with at most two decimals.
 */
export function parseRandToCents(input: string): number | null {
  const cleaned = input.replace(/[R\s,\u00a0]/gi, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ''] = cleaned.split('.');
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : null;
}

export function formatRand(cents: number): string {
  const rand = Math.floor(cents / 100);
  const c = cents % 100;
  const grouped = String(rand).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
  return c === 0 ? `R${grouped}` : `R${grouped}.${String(c).padStart(2, '0')}`;
}

export function checkTotal(totalCents: number): FundingResult {
  const warningLine = Math.round(DISCLOSURE_LINE_CENTS * WARNING_FRACTION);

  if (totalCents > ANNUAL_CAP_CENTS) {
    return {
      band: 'ABOVE_ANNUAL_CAP',
      message: `This total is above the ${formatRand(ANNUAL_CAP_CENTS)} annual donor line in the proclamation.`,
      centsToNextLine: null,
    };
  }
  if (totalCents >= DISCLOSURE_LINE_CENTS) {
    return {
      band: 'AT_OR_ABOVE_DISCLOSURE',
      message: `This total is at or above the ${formatRand(DISCLOSURE_LINE_CENTS)} disclosure line.`,
      centsToNextLine: ANNUAL_CAP_CENTS - totalCents,
    };
  }
  if (totalCents >= warningLine) {
    return {
      band: 'NEAR_DISCLOSURE',
      message: `This total is within 20% of the ${formatRand(DISCLOSURE_LINE_CENTS)} disclosure line.`,
      centsToNextLine: DISCLOSURE_LINE_CENTS - totalCents,
    };
  }
  return {
    band: 'BELOW_WARNING',
    message: `This total is below ${formatRand(warningLine)}, the point at which we start to flag nearness to the disclosure line.`,
    centsToNextLine: DISCLOSURE_LINE_CENTS - totalCents,
  };
}
