/**
 * Election Campaign OS — public site router
 *
 * `/` is the public front door; the selling pages sit under `/for-campaigns`.
 * Seven routes before that: the five the canvas names (`/`, `/casework-tracker`,
 * `/compliance`, `/packages`, `/contact`) plus the explainer index and
 * its articles.
 *
 * Separate from `src/app/routes.tsx` on purpose. That router sits behind
 * the auth gate and its nav is fixed at nine items (§3.2); this one is
 * public. They share tokens and conventions, not chrome.
 *
 * ADVERTISING CONSENT LIVES HERE
 *
 * One piece of state for the whole site, read once on mount. It is held
 * at the router rather than inside the slot because three things need
 * it and they are on different pages: the slot on an explainer, the
 * banner that asks, and the withdrawal control in the footer that must
 * be reachable from everywhere including the pages that never show an
 * advert.
 *
 * The banner decides for itself whether to appear; see
 * `ads/ConsentBanner.tsx`. It is rendered unconditionally here and
 * returns null off the eligible pages, so the router does not carry a
 * second copy of the policy that could drift from the first.
 */
import { Route, Routes, useLocation } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import { SiteShell } from './SiteChrome';
import { SiteHome } from './pages/SiteHome';
import { SiteForCampaigns } from './pages/SiteForCampaigns';
import { SiteCasework } from './pages/SiteCasework';
import { SiteCompliance } from './pages/SiteCompliance';
import { SitePackages } from './pages/SitePackages';
import { SiteContact } from './pages/SiteContact';
import { SiteExplainer, SiteExplainers } from './pages/SiteExplainers';
import { SiteFundingChecker } from './pages/SiteFundingChecker';
import {
  COALITION_PATH,
  COUNCIL_PATH,
  DETAILS_PATH,
  SEATS_PATH,
  SiteVoterTools,
} from './pages/SiteVoterTools';
import { SiteCouncilFinder } from './pages/SiteCouncilFinder';
import { SiteVoterCheck } from './pages/SiteVoterCheck';
import { SiteSeatTool } from './pages/SiteSeatTool';
import { SiteCoalitionTool } from './pages/SiteCoalitionTool';
import { SiteWhatsInTheApp } from './pages/SiteWhatsInTheApp';
import { SiteCodeOfConduct } from './pages/SiteCodeOfConduct';
import { SiteElectionDay } from './pages/SiteElectionDay';
import { SiteResults } from './pages/SiteResults';
import { SiteManifestos } from './pages/SiteManifestos';
import { SiteCandidates } from './pages/SiteCandidates';
import { SiteAreaStats } from './pages/SiteAreaStats';
import { SiteAgentTool } from './pages/SiteAgentTool';
import { SiteForms } from './pages/SiteForms';
import { ConsentBanner } from './ads/ConsentBanner';
import { AD_CLIENT_ID } from './ads/adPolicy';
import {
  clearAdConsent,
  hasAdConsent,
  readAdConsent,
  writeAdConsent,
  type AdConsentState,
} from './ads/adConsent';

/** Per-page enquiry subject, so a WhatsApp message arrives with context. */
const SUBJECTS: Record<string, string> = {
  '/': 'Election Campaign OS enquiry',
  '/for-campaigns': 'Election Campaign OS enquiry',
  '/casework-tracker': 'Casework Tracker enquiry',
  '/compliance': 'Compliance enquiry',
  '/packages': 'Packages enquiry',
  '/contact': 'Election Campaign OS enquiry',
  '/explainers': 'Election Campaign OS enquiry',
  '/tools/party-funding-checker': 'Election Campaign OS enquiry',
};

/**
 * A client-side route change does not move focus or the scroll
 * position, so without this a visitor who follows a link from the
 * footer lands at the bottom of the next page. An in-page `#hash` is
 * left alone: that link means "go to this part of the page".
 */
function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView();
      return;
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

export function SiteApp() {
  const { pathname } = useLocation();

  /*
   * Read once, lazily. `readAdConsent` touches localStorage, which can
   * throw rather than return empty in a private window — it handles
   * that itself and returns `unasked`, which is the safe side.
   */
  const [consent, setConsent] = useState<AdConsentState>(() => readAdConsent());

  const choose = useCallback((choice: 'granted' | 'refused') => {
    writeAdConsent(choice);
    setConsent(choice);
  }, []);

  const withdraw = useCallback(() => {
    clearAdConsent();
    setConsent('unasked');
  }, []);

  const consented = hasAdConsent(consent);

  return (
    <SiteShell
      enquirySubject={SUBJECTS[pathname] ?? SUBJECTS['/']}
      onWithdrawAdConsent={withdraw}
      // A withdrawal link for something that is not running would imply it is.
      adsEnabled={AD_CLIENT_ID !== null}
    >
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<SiteHome />} />
        <Route path="/for-campaigns" element={<SiteForCampaigns />} />
        <Route path="/casework-tracker" element={<SiteCasework />} />
        <Route path="/compliance" element={<SiteCompliance />} />
        <Route path="/packages" element={<SitePackages />} />
        <Route path="/contact" element={<SiteContact />} />
        <Route path="/explainers" element={<SiteExplainers />} />
        <Route
          path="/explainers/:slug"
          element={<SiteExplainer hasConsent={consented} />}
        />
        <Route
          path="/tools/party-funding-checker"
          element={<SiteFundingChecker hasConsent={consented} />}
        />
        <Route path="/tools" element={<SiteVoterTools />} />
        <Route path={COUNCIL_PATH} element={<SiteCouncilFinder />} />
        <Route path={DETAILS_PATH} element={<SiteVoterCheck />} />
        <Route path={SEATS_PATH} element={<SiteSeatTool />} />
        <Route path={COALITION_PATH} element={<SiteCoalitionTool />} />
        <Route path="/whats-in-the-app" element={<SiteWhatsInTheApp />} />
        <Route path="/code-of-conduct" element={<SiteCodeOfConduct />} />
        <Route path="/election-day" element={<SiteElectionDay />} />
        <Route path="/results" element={<SiteResults />} />
        <Route path="/tools/party-manifestos" element={<SiteManifestos />} />
        <Route path="/tools/know-your-candidates" element={<SiteCandidates />} />
        <Route path="/for-campaigns/voters-in-your-area" element={<SiteAreaStats />} />
        <Route path="/for-campaigns/agent-tool" element={<SiteAgentTool />} />
        <Route path="/for-campaigns/forms" element={<SiteForms />} />
        <Route path="*" element={<SiteHome />} />
      </Routes>

      {consent === 'unasked' && <ConsentBanner pathname={pathname} onChoice={choose} />}
    </SiteShell>
  );
}
