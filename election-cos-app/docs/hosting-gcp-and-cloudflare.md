# Hosting the public site and the application

Built 2 Nov 2026. Nothing here has been deployed by this build: it has no Google Cloud or Cloudflare credential.

## What is built

| Output | Command | Contents |
|---|---|---|
| `dist-site/` | `npm run build:site` then `npm run check:site-budget` | The public website, 119 files, 8.6 MB: pages, the ten short explainer videos (MP4, WebVTT captions, poster) served from the site itself, candidate lists for 18 municipalities, fonts, `_headers`. No application service worker. |
| `dist/` | `npm run build` | The application: production Firebase config for `electioncos1-0`, no emulator, service worker precaching 27 assets. |

The site loads nothing from third parties (no YouTube, no analytics, no cookies before consent). A video downloads only when someone presses play.

## Google Cloud (the site)

Files: `site-hosting/gcp/Dockerfile`, `site-hosting/gcp/nginx.conf` (the security headers are the same as `site-hosting/_headers`; `src/site/gcpHosting.test.ts` fails if they differ).

```
npm ci && npm run build:site && npm run check:site-budget
docker build -f site-hosting/gcp/Dockerfile -t REGION-docker.pkg.dev/PROJECT/REPO/ecos-site:1 .
docker push REGION-docker.pkg.dev/PROJECT/REPO/ecos-site:1
gcloud run deploy ecos-site --image REGION-docker.pkg.dev/PROJECT/REPO/ecos-site:1 \
  --region africa-south1 --allow-unauthenticated --port 8080
```

Then map `electioncos.co.za` to the service in the Cloud Run console and point DNS at it. Check that domain mapping is offered in your chosen region; if not, put a load balancer in front.

**Tested here:** `nginx.conf` passes `nginx -t` and served `dist-site` correctly on nginx 1.24: client routes fall back to `index.html`, videos return `video/mp4` and honour range requests, captions are `text/vtt`, the headers are present, a missing asset is a 404. A Chromium run at 390 and 1280 px showed no console errors, no failed requests and no sideways scroll on four pages.
**Docker image tested 2 Nov 2026:** built from this Dockerfile and run locally. `/` and a client route return the page; a video returns `206 video/mp4` for a range request; captions are `text/vtt`; `/assets/*` carries the one-year immutable cache header; a missing asset is a 404; all five security headers are present. The 23 site test files (176 tests) pass. **Not tested here:** the Cloud Run deploy itself (no Google credential in the build environment).

### Deploying it (GitHub Actions, keyless)

1. Once, in Cloud Shell on `electioncos1-0`: `bash election-cos-app/scripts/setup-gcp-site.sh`. It enables the APIs, creates the `ecos` image repository in `africa-south1`, a deployer and a runtime service account, and a Workload Identity Federation provider that only this repository can use. No key is created or stored. Billing must already be linked.
2. GitHub → Actions → **Deploy public site (Cloud Run)** → Run workflow. It builds `dist-site`, runs the site tests and the header check, builds and pushes the image, deploys `ecos-site` (0 to 4 instances, 256 MiB), then checks the live URL returns 200 with its CSP header. The URL is in the run summary.

The workflow never touches the application, Firebase Hosting, Firestore or Functions.

### Custom domain on Cloud Run

Cloud Run's built-in domain mapping is offered in ten regions and `africa-south1` is not one of them; Google also describes it as preview and not recommended for production ([Mapping custom domains](https://docs.cloud.google.com/run/docs/mapping-custom-domains)). Choose one:

- **Firebase Hosting in front (lowest cost):** add a second Hosting site on `electioncos1-0` whose only rule rewrites `**` to the `ecos-site` service, and connect the domain to that site. Free tier applies. Keep it a separate site so the application's Hosting config is not changed.
- **Global external Application Load Balancer (Google's recommendation):** serverless NEG to `ecos-site`, Google-managed certificate. Most control (Cloud CDN, Cloud Armor), but it has a standing monthly charge; check current pricing in your console.
- **Leave it on the `run.app` URL** until after the election.

**Cloud Storage alone is not enough:** a bucket can serve the files but cannot set the security headers or the single-page fallback for the site's own routes without a load balancer in front of it, which carries a standing charge. Cloud Run with this container avoids that. Check current Cloud Run pricing and free allowance in your own console before relying on it being free.

## Google Cloud or Firebase (the application)

`dist/` is a single-page app with a service worker and needs its own security headers (the set in `src/config/securityHeaders.ts`, which `firebase.json` already applies). An nginx file for the application has not been written. On Firebase Hosting the headers come with `firebase deploy`, which still needs billing linked (Blaze) and a deploy credential: see `npm run preflight`.

## Does Cloudflare have free hosting? Yes, with limits.

Checked on 2 Nov 2026 against Cloudflare's own documentation (not from memory):
- **Static assets on Workers:** the Workers static-assets page says "Requests to static assets are free and unlimited" and that there is no cost for storing assets. [Billing and limitations](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/).
- **Limits on the Free plan:** 20,000 static asset files per Worker version and 25 MiB per file. [Workers limits](https://developers.cloudflare.com/workers/platform/limits/). `dist-site` is 119 files, the largest about 0.5 MB, and `dist` is far inside both.
- **One thing the docs do not settle:** the Workers Free plan has a separate cap of 100,000 requests a day for Worker script invocations. The pages above do not say whether static-asset requests count towards it. `wrangler.site.jsonc` has no Worker script, so only static assets are served, and the documentation says those are free and unlimited. Confirm in the dashboard after the first week of real traffic.
- **Pages** (the older product) also has a free plan with a 20,000-file limit; Cloudflare is steering new projects to Workers static assets.
- **What it does not give you:** the application's backend (Firestore, Auth, Functions) is not hosted by Cloudflare; it stays on Firebase and still needs Blaze billing for the functions.

To use it: `npm run build:site && npx wrangler deploy --config wrangler.site.jsonc`. It needs a Cloudflare account and the domain on Cloudflare. `_headers` is read as-is.

## Recommendation

Whichever you choose, the site is the same `dist-site`. Cloudflare static assets is the lowest-cost route for the website on the evidence above. GCP Cloud Run is the route if the site must sit with the rest of your Google estate. The application's functions need Firebase Blaze either way.

## Billing configuration

- **Blaze is required** for the application's 2nd-gen Cloud Functions. The public site (`dist-site`) needs no billing on Cloudflare static assets.
- `scripts/setup-billing-budget.sh` links `electioncos1-0` to your billing account and creates a budget with alerts at R500, R1,000, R1,800 and R2,000 (25, 50, 90 and 100 per cent of R2,000), matching `docs/phase-0-infra-plan.md`. Run it once: `BILLING_ACCOUNT=XXXXXX-XXXXXX-XXXXXX scripts/setup-billing-budget.sh`. It has not been run; it needs your billing account id and a signed-in `gcloud`.
- A budget alert only emails. It does not stop spending. The in-app hard stop is `functions/src/costGuard.ts` (R500 a month for paid sends unless the founder records an approval).

## Adverts on the public site

Adverts are built in (`src/site/ads/`) and stay off until all three of `VITE_AD_CLIENT_ID`, `VITE_AD_SLOT_ID` and `VITE_AD_CATEGORY_BLOCKS_CONFIRMED=true` are set at `npm run build:site` time. They show only on explainer pages and only after consent. The site CSP and the nginx copy now allow Google's ad hosts by exact name (no wildcard, no `unsafe-*`). Set the variables in the build environment for whichever host you use; do not add an ad script to `site.html` by hand, which would bypass the consent gate.
