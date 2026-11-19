# Marketing asset integration — local pass brief

A handoff for a **local** Claude Code session on the machine that holds the
marketing assets (they are on the desktop, in a marketing-assets folder and a
few unnamed folders, and could not be reached from a cloud session). Follow
this brief; it carries the design-system and claims rules the cloud session
reviewed so the local pass stays consistent with the rest of the product.

## The task

Search the desktop — the marketing-assets folder **and the unnamed folders** —
for asset files of these types only: **`.png`, `.jpeg`/`.jpg`, `.mp4`, `.svg`**.
Sort them, apply the gate below, integrate what is appropriate, and record what
was used and what was held back and why. You have discretion to choose what fits.

```bash
# From the desktop root, list candidate assets (adjust the path to the real desktop):
find "$HOME/Desktop" -type f \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.mp4' -o -iname '*.svg' \) 2>/dev/null
```

Copy chosen assets **into the repo** (never reference a path on the desktop); see
placement below. Keep originals on the desktop; commit copies.

## Two hard gates — reject on either (this is the product's own discipline)

Eight supplied promo videos were already rejected under these rules
(`src/site/promoVideos.ts` HELD list). Apply the same bar:

1. **Party neutrality.** No party name, logo or colour anywhere on a marketing
   surface. (The only party emblems in the repo, `public/party-emblems/`, are
   used factually in results, not marketing.)
2. **Claims discipline.** Nothing that states what the product cannot back:
   no "free trial" (there is none), no "live WhatsApp engine", no price that
   differs from the published one (`src/site/siteContent.ts` PACKAGES / VAT_NOTE),
   no garbled on-screen text, and **no realistic person who is not real without
   disclosure**. Examples must be invented and labelled.

Anything that fails either gate: do not integrate it; note it in the change log
with the reason, so the decision is visible and not re-litigated.

## Design system (must hold)

- **Palette** (tokens only — `src/design/tokens.ts`): ink `#1A2246`, gold
  `#B7913F`, paper `#F7F4EE`, teal `#33427E`, maroon `#7E1F2E`, green `#2F7E4A`,
  rule line `#DCD6C8`. No gradients, no blue-purple, one teal action colour.
  Imagery should sit inside this palette.
- **Type:** public site = **Archivo** (not Narrow) + Public Sans + IBM Plex Mono.
- **The brand mark is a vector drawn in code** (`src/components/brandMarkSvg.ts`)
  and generates the favicon + PWA icons (`scripts/build-icons.mjs`). **Do NOT
  replace it** with a supplied logo unless the owner explicitly asks; if they do,
  update `brandMarkSvg.ts` and re-run the icon build, and check every icon size.

## Where each asset type goes

| Type | Repo home | Use | Spec |
|---|---|---|---|
| **mp4** | `election-cos-app/site-assets/videos/` | Promo cuts on `/` and `/for-campaigns`. Register in `src/site/promoVideos.ts` with the on-screen words as `readIt` and a poster frame. A video is "hosted" only when its file is in that folder (a test checks). | H.264, portrait 1080×1920 or landscape 1920×1080, ≤~15s, with a matching poster `.jpg` |
| **png / jpeg** | `election-cos-app/public/` (or `site-assets/`) | Hero/section imagery; and a **social `og:image`**, which the site currently lacks — a real gap to fill (wire in `src/site/seo.ts`). | og:image 1200×630; hero ≥1600px wide; party-neutral |
| **svg** | `election-cos-app/src/site/assets/` | Icons, diagrams, decorative marks (not a replacement logo). | Clean vector; `currentColor` or token hexes |

## Integration points (files to read)

- `src/site/promoVideos.ts`, `src/site/explainerVideos.ts`, `src/site/SiteVideo.tsx`,
  `src/site/PromoPlayer.tsx` — video registries and players.
- `src/site/pages/SiteHome.tsx`, `src/site/pages/SiteForCampaigns.tsx` — where
  videos/imagery render (`<SiteVideo id=… />`).
- `src/site/seo.ts` — social/OG metadata (og:image slot).
- `src/site/pages/SiteAbout.tsx`, `src/site/platformContent.ts` — the corporate page.
- `src/site/assets/` — SVG assets.

## Workflow

1. `git checkout claude/election-campaign-os-jlzsw3 && git pull` (it equals `main`).
   Branch off it, or work on it, per the repo's branch policy.
2. Copy chosen assets into the repo paths above; wire them into the registries/pages.
3. Record what was used / held back (with reasons) in
   `docs/design-decision-and-change-log.md`.
4. **Gate before commit:**
   ```bash
   cd election-cos-app
   npm run check:all          # lint, typecheck, hex guard, type-scale, headers, fonts, tests
   npm run build:site         # the public-site build
   npm run check:site-budget  # keep the site within its asset budget — large media can break this
   ```
   Note the **site asset budget**: big mp4/png files can blow it. Compress; prefer
   poster + on-demand video (the explainer pattern loads players only after a click).
5. Commit and open a PR. If the owner wants it live, the deploys are
   `deploy-site-gcp.yml` (public site) and `deploy-ecos.yml` (app) via workflow_dispatch.
