/**
 * Election Campaign OS — public site: what each URL is, for search engines.
 *
 * WHY THIS EXISTS (Search Console page-indexing errors, 12 Nov 2026)
 *
 * The site is a single-page app, and its server answered every path with the same page: `/sitemap.xml`,
 * `/index.html`, and any made-up address all returned 200 and the home page. To Google that is unlimited duplicate
 * pages, soft 404s (a "not found" that says 200) and a sitemap that is not a sitemap. Every page also shared one
 * title, description and (absent) canonical.
 *
 * The fix is to say, once, what pages exist. The build (`scripts/build-seo-pages.ts`) reads this file and writes
 *  - one real HTML file per page, with its own title, description and canonical;
 *  - `sitemap.xml` of the indexable ones, and a `robots.txt` that names it;
 *  - `404.html`, returned with a real 404 for anything else (site-hosting/gcp/nginx.conf).
 * `seo.test.ts` fails the build if a route in SiteApp is neither listed here nor marked not-indexable, so a new page
 * cannot ship invisible or duplicated.
 *
 * Copy: titles and descriptions are each page's own heading and lead, not new claims. Council and explainer pages are
 * generated from their data.
 */
import { EXPLAINERS } from './explainers';
import { LEGAL_PAGES } from './platformContent';
import { NATIONAL_SEATS, PROVINCES } from '@/modules/lge2026/nationalResults';

/**
 * The host the site is served on and that every canonical names. Probed 12 Nov 2026: `electioncos.co.za` answers 301 to
 * `www.electioncos.co.za`, which answers 200. If that redirect is ever reversed, change this one constant.
 */
export const CANONICAL_ORIGIN = 'https://www.electioncos.co.za';
export const SITE_NAME = 'Election Campaign OS';

export interface PageMeta {
  path: string;
  title: string;
  description: string;
  /** In the sitemap and open to indexing. False = a real page that search engines are asked to leave out. */
  indexable: boolean;
}

const t = (name: string) => `${name} | ${SITE_NAME}`;

const HOME: PageMeta = {
  path: '/',
  title: `${SITE_NAME} — campaign and casework software for South African local government`,
  description:
    'Offline-first field operations, POPIA-by-design voter contact, party-funding tracking and signed council referrals. One published price list for every party and every independent.',
  indexable: true,
};

const page = (path: string, name: string, description: string, indexable = true): PageMeta => ({ path, title: t(name), description, indexable });

/** Every fixed page. Paths here must match SiteApp's routes (seo.test.ts checks both ways). */
export const STATIC_PAGES: PageMeta[] = [
  HOME,
  page('/for-campaigns', 'Campaign Software for Ward Candidates and Parties', 'Offline-first field operations, POPIA-by-design voter contact and party-funding tracking for ward candidates, parties and their teams.'),
  page('/casework-tracker', 'Every Case, Followed Through', 'A resident raises a problem at the door. Your office triages it, you authorise it, and a signed referral goes to the municipality, tracked until it is resolved.'),
  page('/compliance', 'What We Do, and What We Will Not Claim', 'For treasurers and compliance officers: the Capability and Limitations Statement, where every row points to the test that proves it.'),
  page('/packages', 'One Price List, Published for Everyone', 'The same modules and terms for every party and every independent. Pilot prices on record, the full amount payable: no VAT is charged.'),
  page('/contact', 'Talk to Us', 'Talk to Election Campaign OS about your role and your wards, by form, email or WhatsApp.'),
  page('/book-a-demo', 'Book a Demo', 'See the platform on invented data, for your role and your wards. Tell us when suits you; we reply within one working day to confirm.'),
  page('/research', 'Research on the Problems You Actually Have', 'Plain-language analysis, with sources and a date on every page. Where we have not researched your question yet, we will say so, and you can commission it.'),
  page('/tutorial', 'Election Campaign OS in 60 Seconds', 'From the doorstep to the seat calculation, in six steps. Pick a chapter, or go in order.'),
  page('/explainers', 'How the Rules Actually Work', 'Plain-language explainers on party funding, how a council is made up, and POPIA and voter contact.'),
  page('/tools', 'Voter Tools', 'Free voter tools, none asking you to sign in. Nothing you type is sent anywhere, and none of them tells you who to vote for.'),
  page('/tools/your-council', 'Your Council and Your Ballot', 'Find your municipality to see how many councillors it has, how many come from wards, and what you will be asked to vote on.'),
  page('/tools/check-your-details', 'Check Your Voter Details', 'A checklist for polling week. The personal checks happen on the Electoral Commission’s own service, so nothing about you passes through this page.'),
  page('/tools/how-seats-are-calculated', 'How Seats Are Calculated', 'In a council with wards, some councillors win a ward and the rest are filled from party lists so that the whole council reflects the vote. Change the numbers and watch each seat move.'),
  page('/tools/how-coalitions-work', 'How Coalitions Work', 'When no party holds more than half of a council’s seats, parties can agree to work together. Pick parties and see whether, between them, they pass half.'),
  page('/tools/party-funding-checker', 'Party-Funding Threshold Checker', 'Type the total one donor has given a party or candidate in a financial year and see where it sits against the disclosure line and the annual cap.'),
  page('/tools/party-manifestos', 'Read and Watch the Manifestos', 'Type any party or independent candidate’s name and open a web search or a video search for their manifesto.'),
  page('/tools/know-your-candidates', 'Know Your Ward Candidates', 'Choose your municipality, then your ward, to see who is standing for ward councillor.'),
  page('/whats-in-the-app', 'What Is in the App', 'The voter tools on this site are free. The app behind them is what a ward office or a party uses between elections.'),
  page('/code-of-conduct', 'The Electoral Code of Conduct', 'Every party contesting an election and every party and ward candidate is bound by it. It is the reason a canvasser may knock on your door.'),
  page('/election-day', 'Election Day Guide', 'What to take, when to go, what to do if your ID is lost, and how to find your voting station.'),
  page('/results', 'Certified Results', 'Every metro and local council elected on 4 November 2026: seats, parties and councillors, calculated from the Electoral Commission’s certified results.'),
  page('/coalitions', 'Who Will Run Your Council?', 'Which councils have no majority after 4 November 2026, and which parties could govern together, calculated from the Electoral Commission’s certified results.'),
  page('/my-ward', 'Your Ward and Your Councillor', 'Choose your municipality and ward to see who was elected, how every party did in your ward, and who now holds your council’s seats.'),
  page('/for-campaigns/voters-in-your-area', 'Registered Voters in Your Area', 'How many voters the delimitation counted in a municipality, how many wards and councillors it has, and how those voters are spread.'),
  page('/for-campaigns/agent-tool', 'Station Log for Party Agents', 'Keep a clean record at your voting station: voters seen each hour, incidents, objections, and the count.'),
  page('/for-campaigns/forms', 'Election-Day Documents and Forms', 'The documents an agent needs on election day, what the Act says each is for, and where to get the official versions.'),
  page('/for-campaigns/seat-model', 'Seat Allocation Model', 'Enter proportional-ballot votes and ward wins for a municipality and see how the seats fall.'),
  page('/official-sources', 'Official Electoral Commission Sources', 'This site summarises. The Electoral Commission decides. These are its own pages for each process, grouped by who needs them.'),
  page('/platform', 'One Platform, Seven Roles, Every Ward', 'Each person sees only the wards they are assigned to. Every capability is marked built or roadmap.'),
  page('/watch', 'Watch It in Ten Seconds', 'Short videos that each make one point, with the words on screen and captions on. The same words are under every video as text.'),
  page('/about', 'Built by Innovation Consult', 'Election Campaign OS is built by Innovation Consult.'),
  ...(Object.entries(LEGAL_PAGES) as Array<[string, { title: string; lead: string }]>).map(([kind, p]) =>
    page(`/legal/${kind}`, p.title, `${p.lead} For electioncos.co.za and Election Campaign OS.`),
  ),
  // A real page that only forwards to the application. Never useful as a search result.
  page('/sign-in', 'Sign In', 'Sign-in happens on the application, not on this site.', false),
];

/** Routes whose last segment is a parameter, generated from data. */
export const PARAM_ROUTES = ['/explainers/:slug', '/councils/:code', '/poll/:pollId'] as const;

export function explainerPages(): PageMeta[] {
  return EXPLAINERS.map((e) => ({ path: e.path, title: t(e.title), description: e.standfirst, indexable: true }));
}

/** One page per contested council, named by the Commission's code as the app's own links spell it. */
export function councilPages(): PageMeta[] {
  return Object.values(NATIONAL_SEATS.councils)
    .map((c) => {
      // Two councils are both called Emalahleni (Eastern Cape and Mpumalanga): the province keeps every title unique.
      const place = `${c.name}, ${PROVINCES[c.province as keyof typeof PROVINCES]}`;
      return {
        path: `/councils/${c.code}`,
        title: t(`${place}: 2026 Council Results`),
        description: `Seats won by each party in ${place} at the 4 November 2026 local government election, calculated from the Electoral Commission’s certified results.`,
        indexable: true,
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));
}

export const allPages = (): PageMeta[] => [...STATIC_PAGES, ...explainerPages(), ...councilPages()];

/** Poll links are issued individually and answered, never searched for. */
export const POLL_SHELL_FILE = 'poll-shell.html';
export const NOT_FOUND_FILE = '404.html';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const canonicalUrl = (p: string) => (p === '/' ? `${CANONICAL_ORIGIN}/` : `${CANONICAL_ORIGIN}${p}`);

/** Rewrites the built shell's head for one page. Throws rather than leave the shared title in place. */
export function renderPage(shell: string, meta: { title: string; description: string; canonical?: string; noindex?: boolean }): string {
  const titleRe = /<title>[\s\S]*?<\/title>/;
  const descRe = /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/;
  if (!titleRe.test(shell) || !descRe.test(shell)) throw new Error('The shell has no <title> or description meta to replace.');
  const extra = [
    meta.canonical ? `<link rel="canonical" href="${esc(meta.canonical)}" />` : '',
    meta.noindex ? '<meta name="robots" content="noindex" />' : '',
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    '<meta property="og:type" content="website" />',
    `<meta property="og:title" content="${esc(meta.title)}" />`,
    `<meta property="og:description" content="${esc(meta.description)}" />`,
    meta.canonical ? `<meta property="og:url" content="${esc(meta.canonical)}" />` : '',
  ]
    .filter(Boolean)
    .join('\n    ');
  return shell
    .replace(titleRe, `<title>${esc(meta.title)}</title>`)
    .replace(descRe, `<meta name="description" content="${esc(meta.description)}" />`)
    .replace('</head>', `    ${extra}\n  </head>`);
}

export function renderSitemap(pages: PageMeta[]): string {
  const urls = pages.filter((p) => p.indexable).map((p) => `  <url><loc>${esc(canonicalUrl(p.path))}</loc></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

export const ROBOTS_TXT = `User-agent: *\nAllow: /\n\nSitemap: ${CANONICAL_ORIGIN}/sitemap.xml\n`;
