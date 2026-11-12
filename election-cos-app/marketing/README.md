
Election Campaign OS — marketing collateral renderer.

Renders the assets in the "Marketing Asset Architecture" manifest from the repo's own tokens,
self-hosted fonts and facts (prices, entity, number), so nothing here is typed twice:
  marketing/banners/*.png   BOFU + TOFU ad creative, every size in the manifest
  marketing/print/poster-a3.pdf, poster-a3.png
  marketing/video/lower-third-*.png   transparent, 1920x1080

Run: npx vite-node scripts/build-marketing.ts

The "Paid for by" line uses SITE.entity, the legal name settled 29 Oct 2026 (Just Be Trading 10
(Pty) Ltd t/a Innovation Consult). The manifest's "Innovation Consult (Pty) Ltd" is not that name.
 