# Hosting and the domain estate (decided 1 Nov 2026)

`innovationconsult.co.za` is on Cloudflare. Everything public sits behind it. The registry is
`src/config/estate.ts`; a guard test (`estate.test.ts`) fails if a hostname is outside our zones, not proxied, or
shares an origin between advertising and campaign data.

| Hostname | Role | Served from | Status |
|---|---|---|---|
| `innovationconsult.co.za` | company site: book a demo, research | **GCP or Cloudflare. Not decided.** | planned |
| `electioncos.co.za` | public voter-tools site (ads) | Cloudflare | configured |
| `app.electioncos.co.za` | the application (campaign data) | Firebase Hosting, target `app` | configured |

Product-line subdomains (`<name>.innovationconsult.co.za`) are added **when a name is decided**. None is invented here.
`proposeSubdomain()` checks a candidate: syntax, reserved labels (mail, api, admin, …), collisions, superseded names,
no party names in a hostname.

## Why the apex of the app and of the ad-carrying site stay on different origins
Advert code must never share an origin with campaign data (`src/site/ads/adPolicy.ts`, point 3). A subdomain is a
different origin; a path is not. Do not move the application under a path of the public site.

## Cloudflare in front of Firebase Hosting: the order matters
Existing guidance stands (`docs/deploy-credentials-request.md` §4.1): attach the custom domain in Firebase with the
records **DNS-only (grey cloud)** first, wait for Firebase to issue the certificate, **then** turn the proxy on and set
SSL/TLS to **Full (strict)**. Turning the proxy on first can fail certificate issuance and take sign-in down.
After proxying:
1. Add the new hostnames to **Firebase Auth → Authorised domains**.
2. Cache rules: bypass cache for `/sw.js`, `/index.html`, `/manifest.webmanifest` (Firebase already sends no-cache
   headers for them; Cloudflare must not override them). `/assets/*` and `/fonts/*` may be cached (immutable).
3. Leave Cloudflare's Auto Minify and Rocket Loader **off** for the app: they rewrite scripts and break the CSP.
4. WAF: rate-limit `submitEnquiry`'s URL (e.g. a handful per minute per IP) in addition to Turnstile.

## A decision that is yours, not a configuration detail: voter data through Cloudflare's edge
`src/config/securityHeaders.ts` records why the build preferred Cloudflare as **DNS only**: Rule 1 of the build spec is
`africa-south1` for voter data, and a proxy terminates and processes every request at the nearest point of presence,
possibly outside South Africa. Proxying `app.electioncos.co.za` means campaign traffic (including doorstep captures)
passes through that edge. That is processing by a further operator and possibly a cross-border transfer (POPIA
section 72). It needs a recorded decision and the attorney review that is already outstanding (register §11.1), not a
silent toggle. Options: proxy the company and public sites only (no campaign data) and keep the app DNS-only; or proxy
the app with that review done. The registry currently says `cloudflareProxied: true` for all three, as instructed.

## Book a demo and the enquiry service
- Pages: `/book-a-demo`, `/contact`, `/research` (site build).
- Service: Cloud Function `submitEnquiry` (`functions/src/enquiryHttp.ts`, `@deployable fails-closed`, africa-south1),
  writes `enquiries/{id}` (clients cannot read or write it).
- **Switch it on:** set secret `TURNSTILE_SECRET` on the project; build the site with `VITE_ENQUIRY_URL`
  (`https://…/submitEnquiry`) and `VITE_TURNSTILE_SITE_KEY`. Until both exist the form says plainly that nothing was
  sent and points to WhatsApp. Without the secret the function answers 503 and stores nothing.
- The site host's own CSP must allow `https://challenges.cloudflare.com` (script, frame) and the function URL
  (`connect-src`). `firebase.json`'s CSP is the **app's**, and deliberately does not.
- Refuses: unknown origins (the app's origin is excluded), no consent or wording version, no contact point, any
  13-digit ID number in free text, bots (honeypot + Turnstile). Stores no IP or user agent. Same contact + interest +
  day = one record.

## Not built
- Any product-line site or subdomain (names undecided); the company site's host (GCP vs Cloudflare).
- Email/WhatsApp notification of a new enquiry to staff; a console view of `enquiries`.
- A report library: reports are commissioned, not published; nothing is listed that has not been written.

## Running with no Google billing: the claims Worker (`worker/`, `wrangler.jsonc`)
Cloud Functions need the paid Blaze plan. `resolveCapabilities` (a Firestore trigger) is how a user gets the
`tenantId` / `caps` claims every rule reads, so on the free Spark plan **nobody can use the app**. The Worker does the
same job on request, on Cloudflare's free tier, in *route mode*: Cloudflare sends only `app.electioncos.co.za/api/*`
to it; everything else goes on to Firebase Hosting. It was adapted from a supplied Spark-plan build (that build also
contained a client-side "demo accounts" mode that grants every capability from a fake token; **that was not taken**).
To switch on:
1. Create a **dedicated** service account with only *Cloud Datastore User* and *Firebase Authentication Admin*. Do not
   use the default Admin SDK account: the key sits in a third party's secret store and whoever can read it can act as it.
2. `npx wrangler secret put FIREBASE_SERVICE_ACCOUNT` (whole JSON) and `npx wrangler secret put OWNER_EMAILS`
   (comma-separated verified emails allowed to create the first tenant). Neither goes in the repo.
3. `npx wrangler deploy` (needs a Cloudflare API token with the Workers template; the zone must be in the same account).
4. Build the app with `VITE_CLAIMS_WORKER=true` and `VITE_DEFAULT_TENANT_ID=<tenant>` (and optionally
   `VITE_DEFAULT_TENANT_NAME`). With either unset the app does not call the Worker.
5. Add the app hostname to Firebase Auth → Authorised domains.
Verified: 13 Worker tests against a faked Google (no token → 401; wrong project → 401; claims come from the staff record
and a request that asks for `team.manage` does not get it; inactive or missing staff are stripped; only a verified owner
email bootstraps, once; non-API paths pass to the origin). **Not verified:** a live deploy, the real Google endpoints
and scopes, and the cached access token across Worker isolates. Free-tier limits: Workers 100k requests a day;
Firestore Spark about 50k reads and 20k writes a day, with writes failing, not billing, past the limit — a real
constraint for a polling-day field team.

