import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { cpSync, existsSync } from 'node:fs';
import path from 'node:path';

// Copies the ward-boundary tiles (scripts/ingest-ward-boundaries.ts) into the build so the app serves them same-origin
// at /ward-boundaries/<CODE>.geojson. They are static GeoJSON, fetched on demand — not part of the JS bundle and never in
// Firestore. Build-only; does nothing in dev or test.
function wardBoundaries(): Plugin {
  return {
    name: 'ecos-ward-boundaries',
    apply: 'build',
    closeBundle() {
      const src = path.resolve(__dirname, 'site-assets/ward-boundaries');
      if (existsSync(src)) cpSync(src, path.resolve(__dirname, 'dist/ward-boundaries'), { recursive: true });
    },
  };
}

// Election Campaign OS — election-cos-app
// IC-ECOS-BUILD-2026-V2 §1
// Imports defineConfig from 'vitest/config' (which merges Vite's and
// Vitest's config types) so the `test` block below type-checks without an
// `as any` escape hatch.
export default defineConfig({
  plugins: [react(), wardBoundaries()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // functions/ is a separate package with its own vitest.config.ts and
    // its own `npm run test` — without 'functions/**' here, this app-root
    // run also swept into functions/src (redundant re-run of the same
    // suite) and functions/lib (tsc's compiled output, which crashes:
    // vitest is ESM-only and lib/ is CommonJS). Found session 9 when
    // functions/src/warRoomCounters.test.ts became that package's first
    // test file ever, exposing that this exclude had never been needed.
    // The rest of the list is vitest's own default (setting `exclude`
    // replaces it rather than appending, so it has to be repeated here).
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*',
      'functions/**',
    ],
  },
});
