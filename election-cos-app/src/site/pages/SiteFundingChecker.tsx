/**
 * Election Campaign OS — public site, party-funding threshold checker
 * (`/tools/party-funding-checker`)
 *
 * A free tool for the public. One input, one answer, no account, no
 * storage, no network request. See `tools/fundingCheck.ts` for what it
 * does and does not say. The advert, where consent allows one, sits
 * below the result and above the sources, as on the explainers: the
 * answer comes first.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Eyebrow, SiteCard, SiteSection } from '../SiteChrome';
import { AdSlot } from '../ads/AdSlot';
import { FUNDING_SOURCE } from '../siteContent';
import {
  ANNUAL_CAP_CENTS,
  DISCLOSURE_LINE_CENTS,
  checkTotal,
  formatRand,
  parseRandToCents,
} from '../tools/fundingCheck';

export const FUNDING_CHECKER_PATH = '/tools/party-funding-checker';

export function SiteFundingChecker({ hasConsent }: { hasConsent: boolean }) {
  const [text, setText] = useState('');
  const cents = text.trim() === '' ? null : parseRandToCents(text);
  const invalid = text.trim() !== '' && cents === null;
  const result = cents === null ? null : checkTotal(cents);

  return (
    <>
      <SiteSection className="flex max-w-[760px] flex-col gap-4 pb-8 pt-[88px]">
        <Eyebrow>Free tool</Eyebrow>
        <h1 className="m-0 font-site-display text-site-h3 md:text-site-h2">
          Party-funding threshold checker
        </h1>
        <p className="m-0 text-site-lead">
          Type the total one donor has given a party or candidate in a financial year. We show
          where it sits against the disclosure line ({formatRand(DISCLOSURE_LINE_CENTS)}) and the
          annual donor line ({formatRand(ANNUAL_CAP_CENTS)}). It runs in your browser: nothing you
          type leaves your device.
        </p>
      </SiteSection>

      <SiteSection className="flex max-w-[760px] flex-col gap-6 pb-10">
        <SiteCard className="flex flex-col gap-3 p-8">
          <label htmlFor="total" className="font-semibold">
            Total from one donor, in rand
          </label>
          <input
            id="total"
            inputMode="decimal"
            autoComplete="off"
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-invalid={invalid}
            aria-describedby="total-help"
            placeholder="R184,500"
            className="min-h-[48px] w-full min-w-0 rounded-[8px] border border-line bg-white px-4 font-site-mono text-site-base"
          />
          <p id="total-help" className="m-0 text-site-caption text-slate">
            {invalid
              ? 'That is not an amount we can read. Use digits, for example R184,500 or 184500.50.'
              : 'Spaces, commas and a leading R are fine.'}
          </p>

          <div role="status" aria-live="polite" className="min-h-[3em]">
            {result && cents !== null && (
              <p className="m-0 text-site-base">
                <strong className="font-site-mono">{formatRand(cents)}</strong>.{' '}
                {result.message}
                {result.centsToNextLine !== null && result.centsToNextLine > 0 && (
                  <>
                    {' '}
                    That is {formatRand(result.centsToNextLine)} short of the next line.
                  </>
                )}
              </p>
            )}
          </div>
        </SiteCard>

        <p className="m-0 text-site-sm text-slate">
          This compares one figure with the lines in the proclamation. It does not say whether a
          donation is permitted, and it does not decide how donations are added together across a
          financial year, because that is a legal question. Use the total you or your adviser have
          worked out.
        </p>
      </SiteSection>

      <SiteSection className="flex max-w-[760px] flex-col gap-6 pb-[88px]">
        <AdSlot pathname={FUNDING_CHECKER_PATH} hasConsent={hasConsent} />
        <SiteCard className="flex flex-col gap-2 p-6">
          <h2 className="m-0 font-site-display text-site-h6">Sources</h2>
          <p className="m-0 text-site-sm">{FUNDING_SOURCE}</p>
          <p className="m-0 text-site-caption text-slate">
            Illustrative, not legal advice. Read more in the{' '}
            <Link to="/explainers/party-funding-thresholds">party-funding explainer</Link>.
          </p>
        </SiteCard>
      </SiteSection>
    </>
  );
}
