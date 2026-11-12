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
import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { SiteShell } from './SiteChrome';
import { SiteHome } from './pages/SiteHome';
import { SurveyInvite } from './SurveyInvite';
const SiteForCampaigns = lazy(() =>
  import('./pages/SiteForCampaigns').then((m) => ({ default: m.SiteForCampaigns })),
);
const SiteCasework = lazy(() =>
  import('./pages/SiteCasework').then((m) => ({ default: m.SiteCasework })),
);
const SiteCompliance = lazy(() =>
  import('./pages/SiteCompliance').then((m) => ({ default: m.SiteCompliance })),
);
const SitePackages = lazy(() =>
  import('./pages/SitePackages').then((m) => ({ default: m.SitePackages })),
);
const SiteResearch = lazy(() =>
  import('./pages/SiteResearch').then((m) => ({ default: m.SiteResearch })),
);
const SiteTutorial = lazy(() =>
  import('./pages/SiteTutorial').then((m) => ({ default: m.SiteTutorial })),
);
const SiteContact = lazy(() =>
  import('./pages/SiteContact').then((m) => ({ default: m.SiteContact })),
);
const SiteExplainer = lazy(() =>
  import('./pages/SiteExplainers').then((m) => ({ default: m.SiteExplainer })),
);
const SiteExplainers = lazy(() =>
  import('./pages/SiteExplainers').then((m) => ({ default: m.SiteExplainers })),
);
const SiteFundingChecker = lazy(() =>
  import('./pages/SiteFundingChecker').then((m) => ({ default: m.SiteFundingChecker })),
);
import {
  COALITION_PATH,
  COUNCIL_PATH,
  DETAILS_PATH,
  SEATS_PATH,
  SiteVoterTools,
} from './pages/SiteVoterTools';
const SiteCouncilFinder = lazy(() =>
  import('./pages/SiteCouncilFinder').then((m) => ({ default: m.SiteCouncilFinder })),
);
const SiteVoterCheck = lazy(() =>
  import('./pages/SiteVoterCheck').then((m) => ({ default: m.SiteVoterCheck })),
);
const SiteSeatTool = lazy(() =>
  import('./pages/SiteSeatTool').then((m) => ({ default: m.SiteSeatTool })),
);
const SiteCoalitionTool = lazy(() =>
  import('./pages/SiteCoalitionTool').then((m) => ({ default: m.SiteCoalitionTool })),
);
const SiteWhatsInTheApp = lazy(() =>
  import('./pages/SiteWhatsInTheApp').then((m) => ({ default: m.SiteWhatsInTheApp })),
);
const SiteCodeOfConduct = lazy(() =>
  import('./pages/SiteCodeOfConduct').then((m) => ({ default: m.SiteCodeOfConduct })),
);
const SiteElectionDay = lazy(() =>
  import('./pages/SiteElectionDay').then((m) => ({ default: m.SiteElectionDay })),
);
const SiteResults = lazy(() =>
  import('./pages/SiteResults').then((m) => ({ default: m.SiteResults })),
);
const SiteManifestos = lazy(() =>
  import('./pages/SiteManifestos').then((m) => ({ default: m.SiteManifestos })),
);
const SiteCandidates = lazy(() =>
  import('./pages/SiteCandidates').then((m) => ({ default: m.SiteCandidates })),
);
const SiteAreaStats = lazy(() =>
  import('./pages/SiteAreaStats').then((m) => ({ default: m.SiteAreaStats })),
);
const SiteAgentTool = lazy(() =>
  import('./pages/SiteAgentTool').then((m) => ({ default: m.SiteAgentTool })),
);
const SiteForms = lazy(() => import('./pages/SiteForms').then((m) => ({ default: m.SiteForms })));
const SiteSeatModel = lazy(() =>
  import('./pages/SiteSeatModel').then((m) => ({ default: m.SiteSeatModel })),
);
const SiteOfficialSources = lazy(() =>
  import('./pages/SiteOfficialSources').then((m) => ({ default: m.SiteOfficialSources })),
);
const SitePlatform = lazy(() =>
  import('./pages/SitePlatform').then((m) => ({ default: m.SitePlatform })),
);
const SiteWatch = lazy(() => import('./pages/SiteWatch').then((m) => ({ default: m.SiteWatch })));
const SitePoll = lazy(() => import('./pages/SitePoll').then((m) => ({ default: m.SitePoll })));
const SiteAbout = lazy(() => import('./pages/SiteAbout').then((m) => ({ default: m.SiteAbout })));
const SiteLegal = lazy(() => import('./pages/SiteLegal').then((m) => ({ default: m.SiteLegal })));
const SiteNotFound = lazy(() =>
  import('./pages/SiteNotFound').then((m) => ({ default: m.SiteNotFound })),
);
const SiteSignIn = lazy(() =>
  import('./pages/SiteSignIn').then((m) => ({ default: m.SiteSignIn })),
);
const SiteCoalitionTracker = lazy(() =>
  import('./pages/SiteCoalitionTracker').then((m) => ({ default: m.SiteCoalitionTracker })),
);
const SiteCouncil = lazy(() => import('./pages/SiteCouncil').then((m) => ({ default: m.SiteCouncil })));
const SiteMyWard = lazy(() => import('./pages/SiteMyWard').then((m) => ({ default: m.SiteMyWard })));
import { COUNCIL_ROUTE, MY_WARD_PATH, TRACKER_PATH } from './resultsPaths';
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
      <Suspense fallback={<p className="p-6">Loading…</p>}>
        <Routes>
          <Route path="/" element={<SiteHome />} />
          <Route path="/for-campaigns" element={<SiteForCampaigns />} />
          <Route path="/casework-tracker" element={<SiteCasework />} />
          <Route path="/compliance" element={<SiteCompliance />} />
          <Route path="/packages" element={<SitePackages />} />
          <Route path="/contact" element={<SiteContact />} />
          <Route path="/book-a-demo" element={<SiteContact variant="demo" />} />
          <Route path="/research" element={<SiteResearch />} />
          <Route path="/tutorial" element={<SiteTutorial />} />
          <Route path="/explainers" element={<SiteExplainers />} />
          <Route path="/explainers/:slug" element={<SiteExplainer hasConsent={consented} />} />
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
          <Route path={TRACKER_PATH} element={<SiteCoalitionTracker hasConsent={consented} />} />
          <Route path={COUNCIL_ROUTE} element={<SiteCouncil hasConsent={consented} />} />
          <Route path={MY_WARD_PATH} element={<SiteMyWard hasConsent={consented} />} />
          <Route path="/tools/party-manifestos" element={<SiteManifestos />} />
          <Route path="/tools/know-your-candidates" element={<SiteCandidates />} />
          <Route path="/for-campaigns/voters-in-your-area" element={<SiteAreaStats />} />
          <Route path="/for-campaigns/agent-tool" element={<SiteAgentTool />} />
          <Route path="/for-campaigns/forms" element={<SiteForms />} />
          <Route path="/official-sources" element={<SiteOfficialSources />} />
          <Route path="/for-campaigns/seat-model" element={<SiteSeatModel />} />
          <Route path="/platform" element={<SitePlatform />} />
          <Route path="/watch" element={<SiteWatch />} />
          <Route path="/poll/:pollId" element={<SitePoll />} />
          <Route path="/about" element={<SiteAbout />} />
          <Route path="/legal/privacy" element={<SiteLegal kind="privacy" />} />
          <Route path="/legal/terms" element={<SiteLegal kind="terms" />} />
          <Route path="/legal/cookies" element={<SiteLegal kind="cookies" />} />
          <Route path="/sign-in" element={<SiteSignIn />} />
          <Route path="*" element={<SiteNotFound />} />
        </Routes>
      </Suspense>

      {consent === 'unasked' && <ConsentBanner pathname={pathname} onChoice={choose} />}
      {pathname === '/' && <SurveyInvite />}
    </SiteShell>
  );
}
