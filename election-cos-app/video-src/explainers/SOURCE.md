# Explainer video sources (Claude Design export)

HTML + React sources for the ten short explainers, exported from the Claude Design project and
checked in as the SOURCE of the videos. They are not part of any build: the site shows each
explainer from `src/site/explainerVideos.ts` (text and, once uploaded, the YouTube player).

- `explainers-data.js` holds the captions. `src/site/explainerVideos.sync.test.ts` fails if the
  captions here differ from `readIt` in the registry, so the video and the page cannot drift apart.
- To render the videos: serve this folder over HTTP (the in-browser Babel fetches the JSX), then
  `npm run render:explainers` (see `scripts/render-explainers.mjs`). Output is silent, captioned,
  1280x720 H.264. A voiceover is not included.
- The pages pull React and Babel from unpkg and fonts from Google at view time; they are for
  rendering, not for publishing as web pages.
