# Website white paper ↔ build (1 Nov 2026)

Source: *Election Campaign OS 1.0 Website Technical and Design Architecture White Paper* (29 Oct 2026).

## Decision recorded: keep the Vite/React site, do not rebuild in Astro now
The site already exists, is tested, and goes live 5 Nov. A rebuild in Astro 5 + Preact days before launch adds risk for
no visitor-visible gain. The cost is stated: entry JS is **126 KB gzip against the paper's 50 KB target** (home page
133 KB gzip, inside the 500 KB budget). Route-level lazy loading cut it from 198 KB. Reaching 50 KB needs the Astro
rebuild; that is a founder decision for v1.1.

## Page map
| White paper | Status |
|---|---|
| Home, /casework-tracker, /compliance, /packages, /contact (+ Book a demo) | existed; prices checked against the paper (R1,800 / R2,500 per ward a month / R45,000 per cycle; PPFA add-on by consultation, no figure; provincial by agreement) |
| /platform (seven roles) | **new**, roles held to `seedRoles.ts` by test |
| /about + neutrality pledge | **new** |
| /legal/privacy, /terms, /cookies | **new**, facts only; binding text pending attorney (build rule 3). Footer previously pointed all three at the pledge: fixed |
| /sign-in | **new**, hands over to app.electioncos.co.za |
| /404 | **new** (noindex; static host answers 200, so not a true HTTP 404) |
| /tools/funding-threshold-checker | exists at /tools/party-funding-checker |
| /explainers, /tools/seat-calculator | exist; seat calculator passes IEC 2021 and Item 16 property tests (control sheet) |
| /downloads/[file] signed 24-hour links | **not built**: needs a Worker and a signing secret; nothing is gated yet because no file is published |
| Pagefind search | not built; only worth it once explainers are numerous |

## Controls added
- **Claims gate (C.7)** `src/site/claimsGate.ts`: a row with placeholder wording is hidden; one with an unfilled LEG-03 reference shows as "Draft: check pending". The sixth Compliance row is therefore not shown.
- **Forbidden-claim and neutrality lint** (`claimsGate.test.ts`) on the marketing files, comments stripped.
- **Headers/CSP** `site-hosting/_headers` (copied into `dist-site`), guarded by `siteHeaders.test.ts`; `wrangler.site.jsonc` for Workers static assets.
- **Size budget** `npm run check:site-budget`.

## Known divergences, surfaced not assumed
1. Advertising: the paper (ADR-06) says none in v1; the repo has a consent-gated ad framework that is **inert** (no client id configured). Left off; founder to choose A/B/C.
2. Voter-tool pages (manifestos, candidates, results) show party names from official data; the neutrality lint covers the marketing surfaces only.
3. Rate limit 5/min/IP and 8 KB body: enquiry function refuses oversize; the rate limit is a Cloudflare rule not yet set.
4. Cookieless analytics and Pagefind: not built. Hosting A vs B, Information Officer, nameservers: open founder decisions.
