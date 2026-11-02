/**
 * Age from a masked ID number, age bands, and small-cell suppression. Shared by the reference-data
 * generator and its tests so the rule that protects people exists in exactly one place.
 */
export const POLL_DAY = new Date('2026-11-04T00:00:00Z');
export const MIN_CELL = 10;
export const BANDS = ['18-29', '30-39', '40-49', '50-59', '60-69', '70+'];

/** Age on polling day from the first six digits (YYMMDD) of a masked ID; null if not a plausible voter. */
export function ageFromMask(mask) {
  const m = /^\s*(\d{2})(\d{2})(\d{2})/.exec(mask ?? '');
  if (!m) return null;
  const yy = +m[1];
  const mm = +m[2];
  const dd = +m[3];
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const ageIn = (year) => {
    let a = POLL_DAY.getUTCFullYear() - year;
    const pm = POLL_DAY.getUTCMonth() + 1;
    if (mm > pm || (mm === pm && dd > POLL_DAY.getUTCDate())) a--;
    return a;
  };
  // Everyone on a certified roll is at least 18 on polling day, which fixes the century.
  let a = ageIn(2000 + yy);
  if (a < 18) a = ageIn(1900 + yy);
  return a >= 18 && a <= 110 ? a : null;
}

export const bandOf = (a) =>
  a < 30
    ? '18-29'
    : a < 40
      ? '30-39'
      : a < 50
        ? '40-49'
        : a < 60
          ? '50-59'
          : a < 70
            ? '60-69'
            : '70+';

/** Hide cells under MIN_CELL; if exactly one would be hidden, hide the smallest other too (the total is published). */
export function suppress(counts) {
  const hidden = BANDS.filter((b) => counts[b] < MIN_CELL);
  if (hidden.length === 1) {
    const rest = BANDS.filter((b) => b !== hidden[0]).sort((x, y) => counts[x] - counts[y]);
    hidden.push(rest[0]);
  }
  return Object.fromEntries(BANDS.map((b) => [b, hidden.includes(b) ? null : counts[b]]));
}
