/**
 * Switching advertising on, as configuration
 *
 * Proved by injection, each separately, then reverted clean:
 *
 *  - dropping the confirmation check → "an id with no confirmation stays off" fails.
 *  - loosening the id pattern        → "refuses anything that is not a publisher id" fails.
 *  - banner probing with a dummy id  → "does not ask for consent to adverts that cannot be served" fails.
 *  - emitting ads.txt unconditionally → "no ads.txt without a publisher id" fails.
 */
import { describe, expect, it } from 'vitest';
import { adsTxtFor, adsenseAccountMetaFor, resolveAdClientId, resolveAdSlotId, resolvePublisherId } from './adConfig';
import { AD_CLIENT_ID, AD_SLOT_ID, AD_ELIGIBLE_PATHS, AD_FORBIDDEN_PATHS, shouldAskConsent } from './adPolicy';

const GOOD = 'ca-pub-1234567890123456';

describe('both variables are required', () => {
  it('turns on with a publisher id AND the confirmation', () => {
    expect(resolveAdClientId(GOOD, 'true')).toBe(GOOD);
  });

  it('an id with no confirmation stays off', () => {
    // The confirmation is the owner stating that the political and
    // election category blocks are applied in the console. An id alone
    // must not be enough to serve uncategorised inventory.
    expect(resolveAdClientId(GOOD, undefined)).toBeNull();
    expect(resolveAdClientId(GOOD, '')).toBeNull();
    expect(resolveAdClientId(GOOD, 'false')).toBeNull();
    expect(resolveAdClientId(GOOD, 'TRUE')).toBeNull();
    expect(resolveAdClientId(GOOD, '1')).toBeNull();
  });

  it('a confirmation with no id stays off', () => {
    expect(resolveAdClientId(undefined, 'true')).toBeNull();
    expect(resolveAdClientId('', 'true')).toBeNull();
  });

  it('refuses anything that is not a publisher id', () => {
    for (const bad of [
      'pub-1234567890123456',          // missing ca-
      'ca-pub-123',                     // too short
      'ca-pub-12345678901234567890123', // too long
      'ca-pub-12345abcde12345',         // letters
      'ca-app-pub-1234567890123456',    // an AdMob id, not AdSense
      `${GOOD}&evil=1`,                 // would be spliced into a script URL
      `${GOOD}"><script>`,
      'ca-pub-1234567890123456\nx',
    ]) {
      expect(resolveAdClientId(bad, 'true'), JSON.stringify(bad)).toBeNull();
    }
  });

  it('trims surrounding whitespace from a pasted value', () => {
    expect(resolveAdClientId(`  ${GOOD}\n`, 'true')).toBe(GOOD);
  });
});

describe('the ad unit is a numeric id from the console, not a name', () => {
  it('accepts a numeric unit id', () => {
    expect(resolveAdSlotId('1234567890')).toBe('1234567890');
    expect(resolveAdSlotId(' 1234567890\n')).toBe('1234567890');
  });

  it('refuses a slug, which is what the first draft passed and AdSense cannot resolve', () => {
    for (const bad of ['party-funding-thresholds', 'slot-1', '12', '', undefined, '123456 7890', '1234567890"']) {
      expect(resolveAdSlotId(bad), JSON.stringify(bad)).toBeNull();
    }
  });

  it('ships unset', () => {
    expect(AD_SLOT_ID).toBeNull();
  });
});

describe('ads.txt', () => {
  it('no ads.txt without a publisher id', () => {
    expect(adsTxtFor(null)).toBeNull();
    expect(adsTxtFor(resolvePublisherId(undefined))).toBeNull();
    expect(adsTxtFor(resolvePublisherId('pub-1234567890123456'))).toBeNull();
  });

  it('is published from the id alone, so the AdSense review can find it before the blocks can be set', () => {
    // AdSense opens its blocking controls only after it approves the site,
    // and approves the site only once it finds ads.txt. The confirmation
    // still gates serving: the same id with no confirmation serves nothing.
    expect(adsTxtFor(resolvePublisherId(GOOD))).toBe('google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n');
    expect(resolveAdClientId(GOOD, undefined)).toBeNull();
  });

  it('the verification tag carries only a well-formed id', () => {
    expect(adsenseAccountMetaFor(resolvePublisherId(GOOD))).toBe('<meta name="google-adsense-account" content="ca-pub-1234567890123456" />');
    expect(adsenseAccountMetaFor(resolvePublisherId(`${GOOD}"><script>`))).toBeNull();
    expect(adsenseAccountMetaFor(null)).toBeNull();
  });

  it('declares exactly one DIRECT relationship, with the id Google expects', () => {
    expect(adsTxtFor(GOOD)).toBe('google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n');
  });
});

describe('this build, as shipped', () => {
  it('has advertising off, so nothing is served and nothing is asked', () => {
    expect(AD_CLIENT_ID).toBeNull();
  });

  it('does not ask for consent to adverts that cannot be served', () => {
    /**
     * The first draft probed with a dummy client id, so the banner told
     * every explainer visitor "we show adverts on our pages" while none
     * were ever served. That is a false statement to the public.
     */
    for (const p of AD_ELIGIBLE_PATHS) {
      expect(shouldAskConsent(p), p).toBe(false);
    }
  });

  it('asks on every eligible page, and on no forbidden page, once configured', () => {
    for (const p of AD_ELIGIBLE_PATHS) expect(shouldAskConsent(p, GOOD), p).toBe(true);
    for (const p of AD_FORBIDDEN_PATHS) expect(shouldAskConsent(p, GOOD), p).toBe(false);
  });
});
