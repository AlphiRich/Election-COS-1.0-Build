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
**Not tested here:** the Docker image build (this machine has no Docker daemon) and any Cloud Run deploy. The Dockerfile is five lines; run the build once before relying on it.

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
